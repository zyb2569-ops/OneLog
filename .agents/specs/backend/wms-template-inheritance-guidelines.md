# WMS 模板继承规范（入口）

> 适用于 `win-module-wms` 中具有 `request / job / record` 主子表链路的业务。  
> 以当前 `core` 公共基类为契约源；未迁移的历史业务不得倒推为规范。  
> 详细规则拆到同目录子文档；完整原版归档见 `wms-template-inheritance-guidelines_old.md`。  
> 本文件只做选型、继承树与导航。

---

## 场景：WMS 业务模块模板化改造

### 1. Scope / Trigger

适用：

- 新增或重构包含 `request`、`job`、`record` 任一完整主子表链路的 WMS 业务。
- Controller / Service 已继承 `BaseRequest*`、`BaseJob*`、`BaseRecord*`，但仍整段重写公开流程。
- 多前端页面共用同一组表，仅靠 `businessType` 区分。
- Detail 列表需同时按明细条件与主表条件过滤。

不适用：

- 无 `request / job / record` 语义的普通单表 CRUD。
- 只有独立业务表、没有对应主子生命周期的功能。

### 2. Signatures（公开入口速查）

标准公开入口由父类提供，子 Controller 不得重复声明同路径：


| 链                  | Controller                   | 主要相对路径                                                                                                                                                                                           |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Request Main       | `BaseRequestMainController`  | `/create` `/update` `/delete` `/get` `/page` `/senior` `/submit` `/agree` `/refused` `/handle` `/close` `/reAdd` `/export-excel` `/export-excel-senior` `/get-import-template` `/import`           |
| Job Main           | `BaseJobMainController`      | `/create` `/update` `/delete` `/get` `/page` `/senior` `/accept` `/abandon` `/close` `/execute` `/getCountByStatus` `/export-excel` `/export-excel-senior`                                       |
| Record Main        | `BaseRecordMainController`   | `/create` `/update` `/delete` `/get` `/page` `/senior` `/export-excel` `/export-excel-senior`                                                                                                    |
| Request/Job Detail | `Base*DetailController`      | `/create` `/update` `/delete` `/page` `/senior`（Request Detail 另有 `/get`）                                                                                                                        |
| Record Detail      | `BaseRecordDetailController` | `/page` `/senior`（只读）                                                                                                                                                                            |


Service 公开主流程即唯一模板骨架（内联在公开方法中，**不存在** `handleCreate` / `handleUpdate`）：

```java
// Request：convert → beforeCreate → validateDetailMethod → 落库 → (HANDLING 则 generateJob) → afterCreate → trend
// Job execute：beforeExecute → 状态完成 → afterExecute（默认 convertJobToRecordVO → Record.create）
// Record：beforeCreate → convert → 落库 → afterCreate → generateTransaction → publish → trend
```



### 3. Contracts



#### 3.1 一句总规则

- **所有 Main VO / Main DO / Main Mapper / Main Controller 不分单向/双向。**
- **Detail 的 VO / DO / Mapper / Controller 按单向/双向分家族。**
- **Main Service 允许存在** `BaseUnidirectional*MainService` **/** `BaseBidirectional*MainService` **中间层**，只承接方向性生命周期（明细转换、预计库存、库存事务等），不得在该层重复声明 Main 属性或复制基础持久化。



#### 3.2 单向 / 双向判定

按 `docs/wms-db/业务区分.md`：

- 移库类、库存修改 → 双向
- 其余默认单向

快速判断：看 **Job/Record Detail DO** 是否继承 `BaseBidirectional*DetailDO`（`from_`* / `to_*` 成对字段）。  
不要只看 Request Detail：双向申请阶段列结构仍可与单向相同，方向语义在 Job/Record 展开。

#### 3.3 继承树

```text
Controller
├── BaseRequestMainController / BaseJobMainController / BaseRecordMainController   （无 Uni/Bi）
└── Base*DetailController
    ├── BaseUnidirectional*DetailController
    └── BaseBidirectional*DetailController

Service Main
├── BaseRequestMainService → BaseUnidirectionalRequestMainService | BaseBidirectionalRequestMainService
├── BaseJobMainService     → BaseUnidirectionalJobMainService     | BaseBidirectionalJobMainService
└── BaseRecordMainService  → BaseUnidirectionalRecordMainService  | BaseBidirectionalRecordMainService

Service Detail
└── Base*DetailService → BaseUnidirectional*DetailService | BaseBidirectional*DetailService

VO / DO / Mapper：Main 不分向；Detail 分 Uni/Bi 家族
```

业务子类选型示例：


| 对象                      | 单向示例                                                | 双向示例                                               |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------- |
| Request Main Service    | `extends BaseUnidirectionalRequestMainService<...>` | `extends BaseBidirectionalRequestMainService<...>` |
| Request Main Controller | `extends BaseRequestMainController<...>`            | 同左（无 Bi Controller）                                |
| Detail DO               | `extends BaseUnidirectional*DetailDO`               | `extends BaseBidirectional*DetailDO`               |




#### 3.4 职责边界（一句话）


| 留在 Base                             | 下沉业务子类                                                      |
| ----------------------------------- | ----------------------------------------------------------- |
| 流水号、状态机、主子表 insert/update、趋势、通用明细校验 | `before*` / `after*` 业务字段校验与补齐                              |
| 导入/导出编排（Request 导入；三链导出）            | `getImportConfig` / `getExportConfig` / `beforeImportExcel` |
| Job 拆分、execute→Record 默认链路          | 方向层已实现的 `createExpectations` / `generateTransaction`        |
| 业务类型快照写入                            | `publish`、特殊撤销事务等业务副作用                                      |




#### 3.5 子类扩展点原则

- 每个公开操作只开放一对：`beforeXxx` / `afterXxx`（含 refused/reAdd/accept/abandon 等，见 Hook 文档全矩阵）。
- 禁止子类重写 `create/update/submit/agree/handle/execute/getPage/getSenior` 后另写平行流程。
- 禁止恢复 `handleCreate/handleUpdate/handlePage/doXxx/*Lifecycle/should*` 等已删除中间层。
- 方向层必须实现的步骤用语义名（`createExpectations`、`generateTransaction`），不用笼统 `handleXxx`。
- Controller 只做 HTTP/权限/幂等/响应封装；成功不得 `return null`；删历史路由前须确认全部调用方。

详见 [Hook 与迁移](./wms-template-hook-and-migration.md)。

#### 3.6 已知基类偏差（不得倒推为规范）

下列现行实现与目标契约不一致，验收与后续 Base 修复以子文档契约为准：

| 项 | 目标契约 | 现行偏差 |
|----|----------|----------|
| 高级查询 `businessType` | 仅缺失时补默认，禁止覆盖已传条件 | Request/Record `normalizeBusinessTypeCondition` 仍 removeIf 强加默认；Job 已正确 |
| 超页空结果 | 空 list 安全返回，无脏数据 | Job Main 保留 total+空 list，与 Request/Record 的 `empty()` 不完全一致 |

详见 [查询与 Mapper](./wms-template-query-mapper-businesstype.md)。

#### 3.6.1 共用表 / 跨业务复用（规范例外，不得当缺陷改）

判定证据见 `docs/wms-template-subplans/05-shared-table-special.md` §2.1。

- **Issue / Repleinsh / ProductionReceipt** 共用 `request_issue_main` / `job_issue_main` / `record_issue_main`，靠 `businessType` 过滤。Repleinsh、ProductionReceipt 的 Service 泛型直接填 `Issue*DO`。改造时不得拆表，也不得去掉 businessType 过滤。
- **ProductionReceipt 方向家族保持双向**。入库类默认单向，但本模块 Job/Record 复用 issue 的 Bi DO（含 `from_*`/`to_*`），不能改成 `BaseUnidirectional*`。
- **unplannedissue** 一套后端服务覆盖 `UnplannedDeliver` / `UnplannedDeliverSpare`；**inventorymove** 一套后端覆盖 Move / TransferIssue / TransferReceipt / Hold 系 / Freeze 系等变体。`businesstypeForIssueByDataTypeParam`、`requireFreezeUnfreezeBusinessType` 等分流逻辑是活代码。
- **transferissue / transferreceipt** 纯前端变体，API 指向 `/wms/inventorymove-*-main`，后端无独立代码。
- **outrefund** 前端按 businessType 动态路由：`Outrefund` 走 outrefund 接口，`ReturnToStore` / `ReturnToHold` 走 productionreturn 接口。`Outrefund*VO` 允许继承 `Productionreturn*VO`，须在类注释标明来源。
- **outreturn** 库无表、菜单未挂，源码保留待后期启用。启用前补 DDL 并挂菜单；本轮不删代码，也不纳入模板形态整改。

### 3.7 `/list` 废弃说明

`/list`（按 ID 集合批量查询）已从所有基类 Controller 中移除，子 Controller 不得自行声明此路由。

- 替代方案：前端应使用 `/get`（单个 ID 查询）或 `/page`（分页条件查询）。
- 已删除：`BaseRequestMainController`、`BaseRecordMainController` 及全部子 Controller 中的 `/list` 路由。
- 禁止原因：`/list` 接口无分页、无过滤条件，按 ID 列表硬查询，不符合 RESTful 设计且存在安全风险（ID 枚举）。

| 条件 | 结论 | 处理 |
|------|------|------|
| 子 Controller 声明 `@GetMapping("/list")` | 不合规 | 删除该路由，改用 `/get` 或 `/page` |
| Service 中仍有 `list()` 方法 | 允许保留 | 仅限内部调用，不作为 HTTP 端点暴露 |

---

### 4. Validation & Error Matrix


| 条件                                         | 结论   | 处理                    |
| ------------------------------------------ | ---- | --------------------- |
| 为双向业务去找 `BaseBidirectional*MainController` | 选型错误 | Main Controller 永远不分向 |
| Main VO/DO 建了 Uni/Bi 属性副本                  | 不合规  | 方向字段只落 Detail         |
| 子类整段重写 `create`/`execute`                  | 不合规  | 迁到 before/after       |
| 无 request/job/record 语义却套模板                | 过度设计 | 用普通 CRUD              |




### 5. Good / Base / Bad Cases

- Good：Inventorymove 双向 → Main Service 继承 `BaseBidirectional*MainService`，Main Controller 继承无方向 `Base*MainController`。
- Base：Customerreturn 单向 → Main/Detail 均走 Unidirectional 家族。
- Bad：因为业务双向，给 Main VO 再声明一套 `from*`/`to*`。
- Bad：子 Controller 再声明 `/execute` 并 `doExecute()` 转发。



### 6. Tests Required

- 继承类名静态检查：Main Controller 不含 `Unidirectional|Bidirectional`；Detail 含且与 DO 家族一致。
- 公开路径与父类不重复：`rg "@(Get|Post|Put|Delete)Mapping" <业务 Controller>`。
- 业务 Service 无 `handleCreate|handleUpdate|handlePage`。



### 7. Wrong vs Correct

```java
// Wrong：Main Controller 幻想 Bi 父类；或 Main Service 跳过方向层却重写 convertDetailList 整段落库
public class XxxRequestMainController extends BaseBidirectionalRequestMainController { }

// Correct
public class XxxRequestMainController extends BaseRequestMainController<...> { }
public class XxxRequestMainService extends BaseBidirectionalRequestMainService<...> { }
```

---



## 子文档导航


| 文档 | 内容 |
|------|------|
| [Hook 与迁移](./wms-template-hook-and-migration.md) | 操作—hook 全矩阵、Controller 边界、兼容包装、按链迁移、AGV/Switch |
| [逐层属性](./wms-template-layer-attributes.md) | 四项逐层职责、字段只声明一次、同层查询/校验闭环 |
| [VO 泛型规范](./wms-template-vo-generic-spec.md) | Request/Job/Record 三条链 VO 继承体系与 Service/Controller 泛型填充规则 |
| [上下游生命周期](./wms-template-chain-lifecycle.md) | 六类对象、`directCreateRecord` 单决策点、只调下游 `create` |
| [查询与 Mapper](./wms-template-query-mapper-businesstype.md) | businessType 目标契约、分页增强、Mapper、超页 |
| [导入导出](./wms-template-import-export.md) | ImportConfig / Workbench；ExportConfig |
| [验收](./wms-template-acceptance.md) | 验收矩阵、RedisMQ+Support、改造顺序 |


相关：

- 字典字段契约：[Excel 导入导出规范](./excel-import-export-guidelines.md)
- 业务类型快照：[WMS 业务类型快照规范](./wms-business-type-snapshot-guidelines.md)
- 判定源：`docs/wms-db/业务区分.md`

---



## 固定阅读顺序（改造时）

1. 本入口：确认链路是否存在、单向/双向、继承谁。
2. [逐层属性](./wms-template-layer-attributes.md) → VO/DO 声明。
3. [Hook 与迁移](./wms-template-hook-and-migration.md) → Service 差异落点。
4. [上下游生命周期](./wms-template-chain-lifecycle.md) → 生成下游方式。
5. [查询与 Mapper](./wms-template-query-mapper-businesstype.md) / [导入导出](./wms-template-import-export.md)。
6. [验收](./wms-template-acceptance.md) 收口。

