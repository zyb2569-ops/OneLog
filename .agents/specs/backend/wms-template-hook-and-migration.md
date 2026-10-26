# WMS 模板 · Hook 与迁移

> 父类：`core/service/Base{Request|Job|Record}*Service`。  
> 入口：[WMS 模板继承规范](./wms-template-inheritance-guidelines.md)  
> 对照原版完整规范拆出；公开主流程以现行内联 `create/update/...` 为准（无 `handleCreate` 骨架）。

---

## 场景：公开流程只走 before/after

### 1. Scope / Trigger

- 子 Service 已继承模板父类，但仍 `@Override` 整段 `create/update/handle/execute/getPage`。
- 历史代码残留 `handleCreate/handleUpdate/doXxx/*Lifecycle/should*`。
- 需要把业务差异迁入 hook，并按「一条业务链」完成迁移。

### 2. Signatures

#### 2.1 单操作双 hook（业务子类唯一扩展面）

每一个公开业务操作只允许向业务子类开放一对扩展点：`beforeXxx` 和 `afterXxx`。父类内部编排不属于扩展契约。

```text
# Request
public create   -> beforeCreate   -> 父类内联创建骨架   -> afterCreate
public update   -> beforeUpdate   -> 父类内联更新骨架   -> afterUpdate
public submit   -> beforeSubmit   -> ...                -> afterSubmit
public agree    -> beforeAgree    -> ...                -> afterAgree
public refused  -> beforeRefused  -> ...                -> afterRefused
public handle   -> beforeHandle   -> ...                -> afterHandle
public close    -> beforeClose    -> ...                -> afterClose
public reAdd    -> beforeReAdd    -> ...                -> afterReAdd

# Job
public create   -> beforeCreate   -> ...                -> afterCreate
public update   -> beforeUpdate   -> ...                -> afterUpdate
public accept   -> beforeAccept   -> ...                -> afterAccept
public abandon  -> beforeAbandon  -> ...                -> afterAbandon
public close    -> beforeClose    -> ...                -> afterClose
public execute  -> beforeExecute  -> ...                -> afterExecute

# Record
public create   -> beforeCreate   -> ...                -> afterCreate
public update   -> beforeUpdate   -> ...                -> afterUpdate
public delete   -> beforeDelete   -> ...                -> afterDelete
```

Request 创建骨架（现行源码，无 `handleCreate`）：

```text
convertMainDO → convertDetailList → beforeCreate → validateDetailMethod
→ insert 主/子 → (status=HANDLING 则 generateJob) → afterCreate → createTrend
```

Job 执行骨架：

```text
beforeExecute → 状态置完成 → afterExecute
  （默认：convertJobToRecordVO → getRecordMainService().create）
```

Record 创建骨架：

```text
beforeCreate → convertMainDO/convertDetailList → insert
→ afterCreate → generateTransaction → publish → createTrend
```

#### 2.2 操作—hook 全矩阵（业务可覆写）

| 链 | 公开操作 | before/after | 备注 |
|----|----------|--------------|------|
| Request | create/update/submit/agree/refused/handle/close/reAdd | 均有 | handle 另有 `resolveHandleBusinessType` |
| Request | getPage/getSenior | after* 常用；before* 仅确有参数转换时用 | 见 [查询与 Mapper](./wms-template-query-mapper-businesstype.md) |
| Request | import/export | `beforeImport*` / `beforeExport*` + Config | 见 [导入导出](./wms-template-import-export.md) |
| Job | create/update/accept/abandon/close/execute | 均有 | execute 默认 after 建 Record |
| Job | getPage/getSenior/export | 同 Request 查询/导出模式 | |
| Record | create/update/delete | 均有 | create 后固定 `generateTransaction` + `publish` |
| Record | getPage/getSenior/export | 同查询/导出模式 | |

#### 2.3 方向层 / 配置（非业务平行流程）

| 链 | 方向层或配置能力 |
|----|------------------|
| Request | `convertDetailList`（Uni/Bi）、`getServiceConfig`、`getJobMainService` |
| Job | `convertJobDetailList`、`createExpectations`、`removeExpectations`、`mapRequestDetailToJobDetail`（Bi） |
| Record | `convertDetailList`、`generateTransaction`（Uni/Bi） |

导出：仅 `beforeExportExcel` / `beforeExportSeniorExcel` + `getExportConfig()`，无 `afterExport*` 契约。

> **命名易混**：HTTP `PUT /handle` 与 `beforeHandle/afterHandle` 是申请「处理」动作，**不是**已删除的 `handleCreate`。

### 3. Contracts

#### 3.1 总体职责（原版保留）

- 父类负责完整且稳定的公开生命周期：参数转换、校验编排、主子表落库、状态流转、编号生成、趋势记录和公共返回结构。
- 子类只保留本业务字段校验、业务字段补齐和副作用扩展。
- 差异优先落在已有 `before / after / publish / generateTransaction` 等职责明确的 hook。
- 现有 hook 无法承接差异时，先给父类增加一个职责单一的窄 hook，再删除子类整段公开流程重写。
- 单次调用、只有一个直接判断且没有多个真实覆盖场景的方法不得包装成 `should*` hook；判断直接留在生命周期方法中。
- `beforeCreate / beforeUpdate` 已是创建和修改校验入口，不得再增加 `validateMainMethod -> validateMainAfter` 这类空转 hook 链。多项校验复用时可提取语义明确的 `private validateXxxFields`，但不再暴露空 protected hook。
- 同一生命周期不得同时保留「旧签名 hook + 新签名 hook」再互相转发；统一保留信息完整的签名（如同时带 old/new DO）。
- Base Service 公开 `create/update/delete/submit/agree/handle/execute/...` 就是唯一模板主流程，不得再包装 `handleCreate/handleUpdate/handleDelete/handleJob/saveDO/updateDO/deleteDO/*Lifecycle/shouldGenerate*`。
- 方向层必须实现的预计库存、库存事务等步骤使用业务语义明确的方法名，不得使用笼统的 `handleXxx`。
- 子类不得覆盖编号生成、状态机推进、主子表落库、趋势、下游分支和事务编排。
- 查询之外的趋势由父类统一完成；子类不得再记同一动作。
- 若子类 `afterCreate` 与父类生命周期完全等价，应删除 override。

#### 3.2 Controller 边界（原版保留）

- 父类已有的路由，子 Controller 不得再次声明相同 `@GetMapping` / `@PostMapping` / `@PutMapping` / `@DeleteMapping`。
- 子 Controller 只保留导入模板、业务专用导出、PDA 聚合、MQ 回调等父类不存在的真实业务接口；**AGV 专用接口不属于可保留例外**。
- Controller 只做 HTTP 参数接收、权限、幂等和响应封装；不组装 SQL，不直接调用 Mapper，不承载大段导出数据拼装。
- RPC/API 成功后必须返回合法 `CommonResult`，禁止业务成功后 `return null`。
- Controller 不增加 `doCreate/doUpdate/doGetPage/doGetSenior/doExecute` 等仅转发 Service 的 protected 方法；公开接口直接调用 Service。
- **历史路由只有在 UI、PDA、其他后端模块和外部调用均确认无引用后才能删除。**

#### 3.3 Service 与兼容包装

- 子 Service 不重写公开流程后转发到私有完整流程。
- 禁止无意义包装：`doExecute()` / `doCreate()` / `createXxx()` 仅调用父类同名能力时应删除。
- **临时兼容方法**必须同时满足：有真实外部调用方、保持为薄包装、备忘录记录最终删除条件；新代码不得再调用兼容包装。无调用方的必须删除，禁止「暂时保留但不再调用」。
- 新增 private 单行转发、util 再包装等规则见 [方法抽象边界](../common/private-method-abstraction-guidelines.md)。
- `protected` 只用于父类扩展契约；仅本类使用必须 `private`；无外部调用不得保留为 `public`。
- 同一校验只能执行一次（物料、业务类型、库位、余额等）。
- 写操作公开入口必须 `@Transactional`（含状态流转、上下游生成、导入、标签生成、包装信息回写）；纯查询/分页/导出/模板下载不加事务。

#### 3.4 按业务链逐个迁移

| 阶段 | 允许改动 | 禁止行为 |
|------|----------|----------|
| Base 契约确认 | `core` + 当前业务 | 全仓批量删 `@Override` |
| 当前业务迁移 | 当前业务六类对象 | 顺手修改其他业务 |
| 编译验证 | Base + 当前业务导致的错误 | 保留死方法或新增无调用方兼容包装 |

迁移顺序：Main Service 公开流程与 hook → Detail Service → Mapper 查询条件 → Controller / VO / DO。

- 删除 `@Override` 前，必须把逻辑迁入 `beforeXxx/afterXxx`，再删除整个旧方法；不得只删注解留下死方法。
- Base 方法最终删除前，确认当前业务无 override、`super.handleXxx`、直接调用。
- 每轮只改 `core Base` 和当前指定业务链；共享 Base 调整后先完成当前 Request/Job/Record 整链再进下一业务。
- 不允许为了少改文件，在子类长期保留一套与父类平行的完整生命周期。

#### 3.5 废弃能力必删（迁移期）

- 删除 `SwitchApi` / `switchApi` / `selectSwitchExist`、开关编码、开关分支及临时变量；保留已确认的唯一业务行为。
- 删除 AGV 专用 Controller 路由、VO/DTO、Service、Mapper/XML、异常码、枚举分支、接口日志和依赖。
- 业务完成检查：`rg -i "agv" <范围>` 与 `rg "SwitchApi|switchApi|selectSwitchExist" <范围>` 均无结果。

### 4. Validation & Error Matrix

| 条件 | 结论 | 处理 |
|------|------|------|
| 子 Controller 重复声明父类路由 | 不合规 | 删子路由，用父类接口 |
| 子 Service 重写公开流程后走私有完整流程 | 不合规 | 差异迁 hook |
| 子方法只调用父类同名能力 | 不合规 | 删除转发 |
| `protected` 无父类调用也无扩展语义 | 不合规 | 改 `private` 或删除 |
| 创建流程重复查物料/余额 | 不合规 | 合并单次校验 |
| 父类与子类同记一条趋势 | 功能错误 | 只留父类趋势 |
| 业务成功 `return null` | 不合规 | 返回合法 `CommonResult` |
| Controller 直接调 Mapper / 拼 SQL | 不合规 | 下沉 Service |
| 未确认调用方就删历史路由 | 风险 | UI/PDA/后端/外部全量确认后再删 |
| 为消编译错误批量改其他业务 | 流程违规 | 回滚，只改当前链 |
| 兼容包装无调用方仍保留 | 不合规 | 删除 |

### 5. Good / Base / Bad Cases

- Good：`beforeCreate` 校验业务字段；`publish` 发本业务消息；下游交给父类。
- Good：Controller 只实现 `getRequestMainService()`，CRUD/状态流转全部继承。
- Base：无差异则不 override；外部仍调用的历史方法可留薄包装并记删除条件。
- Bad：`@Override public String create(...)` 内自行 insert + trends + MQ。
- Bad：Controller `/execute` → `doExecute()` → Service。
- Bad：成功响应 `return null`。

### 6. Tests Required

- 静态：`handleCreate|handleUpdate|handleDelete|handlePage|handleJob` 无结果。
- 静态：`SwitchApi|selectSwitchExist|AGV|com.alibaba.fastjson` 无结果。
- 静态：Controller 无与父类重复 Mapping。
- 行为：`create/update/submit/agree/refused/handle/close/reAdd/accept/abandon/execute` 与改造前状态流转一致。
- 行为：创建只产生一条对应趋势；操作人正确。

### 7. Wrong vs Correct

```java
// Wrong：子类接管完整创建
@Override
public String create(MainCreateReqVO reqVO) {
    MainDO mainDO = convert(reqVO);
    validate(mainDO);
    mainMapper.insert(mainDO);
    detailMapper.insertBatch(...);
    trendsApi.createTrends(...);
    return mainDO.getNumber();
}

// Correct：差异进 hook
@Override
protected void beforeCreate(MainCreateReqVO reqVO, MainDO mainDO, List<DetailDO> details) {
    validateBusinessFields(mainDO, details);
}
```

```java
// Wrong：一层操作多个扩展点
beforeHandle(...);
afterHandleLifecycle(...);
shouldGenerateJobAfterHandle(...);

// Correct：只理解 before/after；内部由父类封闭
beforeHandle(mainDO, businessType);
// 父类内联状态流转 + generateJob（内含 directCreateRecord 分支）
afterHandle(mainDO, businessType);
```

```java
// Wrong：重复公开流程
@PutMapping("/execute")
public CommonResult<String> execute(@Valid @RequestBody JobMainExecuteVO reqVO) {
    return success(doExecute(reqVO));
}

// Correct：直接继承父 Controller，只提供 getXxxService()
```
