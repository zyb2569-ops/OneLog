# WMS 模板 · 上下游生命周期

> 约束：Request → Job → Record 调用方向；只组装下游 Create VO 并调用公开 `create`。  
> 入口：[WMS 模板继承规范](./wms-template-inheritance-guidelines.md)  
> 业务类型快照字段见 [业务类型快照规范](./wms-business-type-snapshot-guidelines.md)（直达记录前必读）。

---

## 场景：六类对象与上下游生成

### 1. Scope / Trigger

- 处理申请生成任务、执行任务生成记录、或申请直达记录。
- 上游直接插下游表、复制下游校验/编号/事务。
- 业务裁剪链路（无 Job / 无 Request / 仅 Record）选型。

### 2. Signatures

标准完整链路（现行基类）：

```text
Request Main.handle
  -> beforeHandle
  -> 状态流转并落库
  -> generateJob(...)          // 父类内联调用，非业务 hook
       -> JobMainService.generateJob
            ├─ directCreateRecord=true  -> convertRequestToRecordVO -> Record.create
            └─ 否则 splitJob -> Job.create（可多单）
  -> afterHandle

Job Main.execute
  -> beforeExecute
  -> 状态置完成
  -> afterExecute（默认 convertJobToRecordVO -> Record.create）

Record Main.create
  -> 主子表落库 + trend
  -> 方向层 generateTransaction
  -> 业务 publish
```

相关签名：

```java
// Request
protected void beforeHandle(ReqMainDO main, String businessType);
protected void afterHandle(ReqMainDO main, String businessType);
protected String resolveHandleBusinessType(ReqMainDO main, List<ReqDetailDO> details, String businessType);
protected void generateJob(ReqMainDO main, List<ReqDetailDO> details, String businessType); // 默认委托 Job

// Job
public void generateJob(ReqMainDO, List<ReqDetailDO>, String businessType); // 内含 directCreateRecord 单决策点
protected void beforeExecute(...);
protected String afterExecute(...);           // 默认创建 Record
protected RecMainVO convertJobToRecordVO(...);
protected void mapRequestDetailToJobDetail(...);
protected void mapRequestDetailToRecordDetail(...);

// Record
protected abstract void generateTransaction(...);
protected void publish(...);
```

### 3. Contracts

#### 3.1 六类对象职责

| 对象 | 负责 | 禁止 |
|------|------|------|
| Request Main | 申请生命周期；决定下一阶段走 Job 或 Record | 直接插 Job/Record Mapper；库存事务；Record publish |
| Request Detail | 申请明细查询与数据载体 | 编排主流程或生成下游 |
| Job Main | 承接/放弃/关闭/执行；执行后生成 Record；承接 `generateJob` 拆分/直达 | 复制 Record 持久化/趋势/事务 |
| Job Detail | 任务明细查询与执行输入 | 独立改变主任务状态 |
| Record Main | 统一 `create`：落库、事务、趋势、`publish` | 接管 Request/Job 状态机 |
| Record Detail | 记录明细查询与展示 | 独立发布或独立生成事务主链 |

原则：**Main 做业务操作与生命周期；Detail 做明细查询与展示。**  
Detail 独立 CRUD 即使历史兼容暂留，也不是标准写入入口。

#### 3.2 上下游强制要求

- 上游只决定是否生成下游，并组装下游 **Create VO**。
- 下游必须调用公开 `service.create(...)`，由下游父类重跑转换、校验、编号、落库、趋势与后置。
- 禁止：上游直接调下游 Mapper；直接构造下游 DO 插库；调用已删除的 `handleCreate`；复制下游校验/编号。
- 字段差异用窄转换 hook，不能成为重写整个 `handle/execute/create` 的理由。
- 上游状态更新先成功落库，再创建下游；需原子性时靠事务，**禁止**把下游插库放进 `before*`。
- 只有多个业务共同需要且属于同一层职责时，才允许向 Base 增加窄 hook；不得为单一业务增加同义兼容方法。

#### 3.3 直达记录：快照 + 单决策点（原版保留，名称对齐现行）

标准申请处理默认生成 Job；主表快照字段 `directCreateRecord=true` 时走 `Request -> Record`：

```text
Request.handle
  -> 读取并固化规则快照（含 directCreateRecord 等）
  -> generateJob（唯一分支决策点）
      ├─ directCreateRecord=false：splitJob -> Job.create
      └─ directCreateRecord=true ：convertRequestToRecordVO -> Record.create
```

强制：

- 开关解析、默认值和规则快照属于 Request 父层 / 快照写入职责；见快照规范。
- **分支只能存在一个统一决策点**（现行为 `BaseJobMainService.generateJob` 内对 `directCreateRecord` 的判断）。禁止在 Controller、`handle`、`afterHandle`、业务 `generateJob` 重写中多处重复判断。
- 开关关闭（false）时不得生成 Record；开启（true）时不得先生成 Job 再补 Record。
- 两条分支都必须调用下游公开 `create`，不能因「直达记录」直接插 Record 表。
- 子业务只补充组装 Job/Record VO 时的特有字段，不重新实现规则解析和完整处理流程。
- 普通「生成 Job」与「直达 Record」必须互斥。

#### 3.4 合法裁剪链路

| 业务模型 | 合法链路 | 示例 | 实现要求 |
|----------|----------|------|----------|
| 完整链路 | Request → Job → Record | 常规申请任务 | handle→Job；execute→Record |
| 直达记录 | Request → Record | `directCreateRecord` 或天然无任务 | generateJob 内直达 Record.create |
| 无任务 | Request → Record | 盘点调整 | 不创建空 Job 类 |
| 无申请 | 外部 → Job → Record | 生产收料 | 上游调 Job 标准创建入口 |
| 仅记录 | 外部 → Record | 直接记账 | 组装 Record Create VO 调 create |

缺失阶段时，相关 Service/Controller/Mapper/VO/DO 不应虚构。父类也不得通过 `return null`、空 Service、抛 `UnsupportedOperationException` 假装阶段存在。

#### 3.5 Uni / Bi 在链路上的差异（摘要）

| 点 | Unidirectional | Bidirectional |
|----|----------------|---------------|
| Job/Record Detail | 单组库位字段 | `from*` / `to*` |
| `createExpectations` | 按业务类型 in/out | 始终 from→expectout、to→expectin |
| `generateTransaction` | 单库位 in/out | to 入库、from 出库 |
| Bi 专有 | — | 撤销事务、from/to 互换等 |

### 4. Validation & Error Matrix

| 场景 | 必须发生 | 禁止发生 |
|------|----------|----------|
| 标准 Request 处理 | 创建一个或多个 Job（拆分规则） | Request 直接插 Job DO；同时建 Job 和 Record |
| 直达记录开启 | 只创建一个 Record | 创建空 Job；绕过 Record Service |
| Job 执行 | 创建一个 Record | Job 复制 Record 持久化/趋势/事务 |
| 盘点调整 | Request → Record | 为套模板增加无意义 Job |
| 生产收料上游发料 | 外部 → Job → Record | 为对称增加无意义 Request |
| 子类增加字段 | 本业务层补查询和校验 | 把业务字段放入 Base/方向层；复制父层属性 |
| 下游 create 失败 | 按事务回滚 | 上游「已处理/已执行」但无下游单据 |

### 5. Good / Base / Bad Cases

- Good：`afterExecute` 默认路径调 `getRecordMainService().create(convertJobToRecordVO(...))`。
- Base：业务只 override `beforeExecute` 补执行字段；直达记录依赖快照字段，不在多处 if。
- Bad：Job 里 `recordMainMapper.insert` + 自写 trend。
- Bad：`getJobMainService() { return null; }` 掩盖无 Job 阶段。
- Bad：在 Controller 与 `afterHandle` 各写一遍「是否直达记录」。

### 6. Tests Required

- 分别验证完整链路、`directCreateRecord` 开/关：下游单据数量、类型、来源编号、状态。
- Job 执行只产生一次 Record；trend / transaction / publish 各一次（按业务）。
- 无 Job 业务未调用 Job Service；无 Request 业务不依赖 Request Service。
- 每层新增属性在分页/高级查询/创建/修改由本层生效，父子无重复远程校验。
- 任一步异常：主子表、趋势、库存事务不得部分提交；上游不得留下无下游单据的已处理状态。

### 7. Wrong vs Correct

```java
// Wrong：Job 直接插 Record
protected String afterExecute(...) {
    recordMainMapper.insert(recordMain);
    recordDetailMapper.insertBatch(...);
    return recordMain.getNumber();
}

// Correct：只组装 VO，下游自己 create
protected String afterExecute(...) {
    return getRecordMainService().create(convertJobToRecordVO(jobMainVo));
}
```

```java
// Wrong：用 null Service 伪装阶段
protected JobMainService getJobMainService() { return null; }

// Correct：链路选型为 Request→Record；快照写入 directCreateRecord=true，
// 由 Job.generateJob 唯一决策点直达 Record.create（或业务根本不建 Job 类型）
```
