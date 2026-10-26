# WMS 模板 · 验收

> 每完成一个业务的模板化改造，按本清单验收。  
> 入口：[WMS 模板继承规范](./wms-template-inheritance-guidelines.md)

---

## 场景：单业务链改造验收

### 1. Scope / Trigger

- 每次优化一个 WMS 业务，覆盖该业务 Request/Job/Record（实际存在的阶段）Main/Detail 的 VO、DO、Mapper、Service、Controller。
- 验收单位是 `Base → 单向/双向 → 具体业务` 完整继承链；`customerreturn` / `inventorymove` 可作为基准对照。
- 其他业务逐个迁移；禁止为消编译错误批量恢复兼容 hook 或改未进入本轮的业务。

### 2. Signatures

父类公开方法是唯一主流程：

```java
create(...); update(...); delete(...);
submit(...); agree(...); refused(...); handle(...);
close(...); reAdd(...); accept(...); abandon(...); execute(...);
getPage(...); getSenior(...);
exportExcel(...); exportSeniorExcel(...);
// Request 另有：importTemplate(...); importExcel(...);
```

子类只允许确有差异的扩展点：

```java
beforeCreate/afterCreate; beforeUpdate/afterUpdate;
beforeSubmit/afterSubmit; beforeAgree/afterAgree; beforeRefused/afterRefused;
beforeHandle/afterHandle; beforeClose/afterClose; beforeReAdd/afterReAdd;
beforeAccept/afterAccept; beforeAbandon/afterAbandon;
beforeExecute/afterExecute;
afterGetPage/afterGetSenior; publish; generateTransaction;
getImportConfig; getExportConfig; beforeImportExcel; beforeExport*;
```

禁止保留：`handleCreate/handleUpdate/handleDelete/handlePage/handleJob`、`saveDO/updateDO/deleteDO`、`*Lifecycle`、单次判断的 `shouldXxx`、同义 `doXxx` 转发。

### 3. Contracts

#### 3.1 改造固定顺序

1. 确认真实存在的 `request / job / record`，只继承存在的父类。
2. Controller：删除父类已有路由与 `doXxx` 转发（删路由前确认 UI/PDA/后端/外部无引用）。
3. Service：收敛公开主流程，差异进 hook。
4. 业务类型规则、编号、趋势、MQ：只留一套公共实现。
5. Detail Service / Mapper：保留主表条件与返回增强，删除纯转发。
6. 全局搜索 UI/PDA/后端/MQ：兼容方法有真实调用方可暂留薄包装并记删除条件，否则删除。
7. 一个业务完成后停止；编译与回归通过再进下一个。

#### 3.2 分层验收摘要

| 检查面 | 通过标准 |
|--------|----------|
| 属性 | 父子 VO/DO 无同名遮蔽；本层字段有本层查询/校验依据 |
| Hook | 无公开流程整段 override；无旧中间方法名；操作均有 before/after 落点 |
| Controller | 无重复路由；无 `return null`；无直接 Mapper |
| 上下游 | 只调下游 `create`；Job 与直达 Record 互斥；`directCreateRecord` 单决策点 |
| 查询 | 调用方 `businessType` 不被覆盖；无 `handlePage`；超页无脏 list |
| 导入导出 | Request 导入走 Workbench+create；导出仅 Config+before |
| 废弃 | 无 SwitchApi/AGV/Fastjson |
| RedisMQ | `@ConsumerMethod` 不按「零引用」删除；同构解析进包内 Support |

#### 3.3 RedisMQ 回调保留契约

##### 1. Scope / Trigger

- 由 RedisMQ 消费框架扫描、带 `@ConsumerMethod` 的 Service 公共方法。
- 通常无 Java 静态调用方；`rg` 无引用**不能**判死方法。

##### 2. Signatures

```java
@Transactional
@ConsumerMethod
public String mesWorkOrderCloseRedisMQ(Map<String, Object> paramMap) { ... }
```

方法名、参数、返回类型属 MQ 路由契约；未同步生产者/消费者/配置前不得改名、改参或删除。

##### 3. Contracts

- 确认注解、Spring Bean、消息路由有效。
- 写入口必须 `@Transactional`。
- 回调只做参数校验、幂等、调用领域 Service；复杂生命周期仍走标准公开 `create` 等，不维护另一套 MQ 专用落库生命周期。
- **Request / Record MQ 使用相同字段解析、日期解析、批次创建和必填校验时，必须提取为包内共享 Support**；Support 默认包可见或 `private`，不作为公共 Service API 暴露。
- JSON 统一 Hutool；不得因入参是 `Map` 恢复 Fastjson。
- Javadoc 说明消息来源、事件、动作、返回语义。

##### 4. Validation & Error Matrix

| 情况 | 处理 |
|------|------|
| 有 `@ConsumerMethod`、无静态引用 | 保留，审内部职责 |
| 像 MQ 方法名但无注解 | 查注册与配置；确认无路由后才能删 |
| 改名/改参 | 必须同步全链路，否则禁止 |
| 写操作无事务 | 补 `@Transactional` |
| 回调内复制 Base 生命周期 | 改组装 VO 调公开 Service |
| Request/Record 重复实现同构解析 | 抽包内 Support |
| 可能重复落库 | 业务键/消息键幂等 |
| 为减方法数合并多个消息契约到一个 `handle(Map)` | 禁止 |

##### 5. Good / Base / Bad Cases

- Good：回调校验工单号后调用明确领域方法。
- Base：无静态调用但有注解和路由的方法保留。
- Bad：仅根据 `rg` 无调用就删除 MQ 回调。
- Bad：Request/Record 各抄一份日期/批次解析。

##### 6. Tests Required

- 启动注册目标 Bean/方法。
- 真实结构消息：反序列化、返回、异常。
- 重复投递不重复单据/趋势/推送。
- 中途异常事务回滚。
- 静态清理报告单列所有 `@ConsumerMethod`，不得进「零引用待删」清单。

##### 7. Wrong vs Correct

```java
// Wrong：rg 无引用 → 删除 MQ 回调
// Correct：保留 @ConsumerMethod，只收敛内部实现
@Transactional
@ConsumerMethod
public String mesWorkOrderCloseRedisMQ(Map<String, Object> paramMap) {
    return productionReceiptService.processMesWorkOrderClose(requireWorkOrderNumber(paramMap));
}
```

### 4. Validation & Error Matrix

| 发现项 | 处理 |
|--------|------|
| 子类重复父类属性 | 删重复字段并复核复制/序列化/导入导出 |
| PageReqVO 字段无所属层条件 | 在所属 Mapper 补齐 |
| Create/Update 字段无校验或赋值依据 | 在所属层 convert/before 补齐 |
| 覆盖父类公开模板方法 | 迁 before/after，删 override |
| Request/Job 直插下游 Mapper | 改 VO + 下游 `create` |
| 写操作无事务 | 补 `@Transactional` |
| 一次操作多条同义趋势 | 只留一条 |
| Request/Job 发布 Record 数据 | 迁入 Record `publish` |
| 存在 `handlePage` | 收回 Base，差异进 after |
| 仍含 Switch/AGV/Fastjson | 按业务删除 |
| 高级查询覆盖调用方 businessType | 修为仅缺失补默认 |
| `@ConsumerMethod` 无静态调用 | 保留并核对路由/事务/幂等 |
| MQ 同构解析重复实现 | 抽包内 Support |

### 5. Good / Base / Bad Cases

- Good：Inventorymove Job 在 `beforeExecute` 准备字段，默认 `afterExecute` 创建 Record。
- Good：Inventorymove Record Detail 先 `super.afterGetPage`，再补生产日期/目标仓库/业务备注。
- Base：Customerreturn 只在 before hook 校验业务字段，下游交给父类。
- Bad：为兼容一个旧子类，在 Base 新增只转发一次的 `handleXxx/doXxx/shouldXxx`。
- Bad：仅因 `rg` 无调用就删 `@ConsumerMethod`。

### 6. Tests Required

静态：

- `handleCreate|handleUpdate|handleDelete|handlePage|handleJob` 无结果。
- `SwitchApi|switchApi|selectSwitchExist|AGV|agv|com.alibaba.fastjson` 无结果。
- 父子 VO/DO 同名字段交集为空。
- Controller 无与父类重复的 Mapping。

行为：

- 状态流转与改造前一致。
- Request→Job、Request→Record（`directCreateRecord`）、Job→Record 各只生成约定下游且明细完整。
- 任一步异常不部分提交。
- 分页：用户名称、主表字段、批次、业务增强；超页无脏数据；调用方 businessType 不被覆盖。
- Record 创建成功只调一次业务 `publish`。
- 导入导出见 [导入导出](./wms-template-import-export.md)。
- 枚举并验证本业务全部 `@ConsumerMethod`。
- `git diff --check`；模块编译与关键流程回归由业务负责人确认。

### 7. Wrong vs Correct

```java
// Wrong：子类接管完整分页转换
protected void handlePage(PageResult<XxxDO> source, PageResult<XxxRespVO> target) { ... }

// Correct
@Override
protected void afterGetPage(...) {
    super.afterGetPage(...);
    fillBusinessDisplayFields(target.getList());
}
```

```java
// Wrong：Request 直接插 Record
recordMainMapper.insert(recordMainDO);

// Correct
recordMainService.create(buildRecordCreateVO(requestMain, requestDetails));
```
