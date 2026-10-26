# WMS 业务类型配置快照规范



> 申请 / 任务 / 记录创建时将 DBC 业务类型配置写入主表离散字段，后续生命周期优先读自身快照。

> 禁止用 `extraProperties` 存快照。



---



## 快照字段范围



### 申请主表（`BaseRequestMainDO`）



| 类别 | 字段 | 写入时机 |

|------|------|----------|

| 流转 | `autoSubmit`、`autoAgree`、`autoHandle`、`directCreateRecord` | 创建时从 DBC 写入，后续读主表 |

| Range 三列 | `inInventoryStatuses`、`outInventoryStatuses`、`useOnTheWayLocation` | 创建时从 DBC 写入，后续读主表 |

| 库区四列 | `fromAreaTypes`、`toAreaTypes`、`fromAreaCodes`、`toAreaCodes` | 创建时从 DBC 写入（out→from，in→to），后续读主表 |



### 任务主表（`BaseJobMainDO`）



| 类别 | 字段 | 写入策略 |

|------|------|----------|

| 执行权限 | `allowModifyLocation`、`allowModifyQty`、`allowModifyBatch`、`allowModifyPackageNumber`、`allowSmallerQty`、`allowBiggerQty`、`allowRepeatScanning`、`allowScanTargetLocation` | 创建时从 DBC 写入（任务无上游快照） |

| Range 三列 | `inInventoryStatuses`、`outInventoryStatuses`、`useOnTheWayLocation` | **Preserve**：申请→任务 `copyProperties` 已有则保留，blank/null 时从 DBC 补全 |

| 库区四列 | `fromAreaTypes`、`toAreaTypes`、`fromAreaCodes`、`toAreaCodes` | **Preserve**：同上 |



### 记录主表（`BaseRecordMainDO`）



| 类别 | 字段 | 写入策略 |

|------|------|----------|

| Range 三列 | 同上 | **Preserve**：任务/申请→记录已有则保留，blank/null 时从 DBC 补全 |



### 不在公共快照范围



- `userGroupCode`（库位→岗位映射或上游传递）

- 事务类型 `inTransactionType` / `outTransactionType`、流水号规则 ID、规则引擎 ID、在途库位**代码**等无离散字段项



---



## 公共写入入口



统一使用 `com.win.module.wms.util.BusinessTypeSnapshotApplier`：



```java

// 申请 create — 业务层唯一入口

BusinessTypeSnapshotApplier.applyRequestProperties(reqMainDO, businesstypeDO);



// 模板子类也可经基类

applyBusinessTypeRequestProperties(reqMainDO, businesstypeDO);



// 任务 create（模板 convertJobDO 内）

BusinessTypeSnapshotApplier.applyJobProperties(jobMainDO, businesstypeDO);



// 记录 create（模板 convertMainDO / applyBusinessTypeRecordProperties 内）

BusinessTypeSnapshotApplier.applyRecordRangeProperties(recMainDO, businesstypeDO);

```



`applyRequestProperties` 内部顺序（**不拆给业务层**）：flow → range → area。



模板基类 `applyBusinessType*Properties` 方法已委托上述工具类，子类不应再重复 set 相同字段。



---



## 模板化跨链路（申请→任务→记录）



```

Request.create

  convertMainDO → applyRequestProperties（flow + range + area）

  beforeCreate → validateDetailMethod → insert → afterCreate



Request.generateJob / splitJob

  copyProperties(reqMainDO, jobMainVO)

  Job.create → convertJobDO → applyJobProperties（preserve range/area + allow*）



Job.execute → afterExecute

  convertJobToRecordVO(jobMainVo)

  copyBusinessTypeRangeSnapshot(jobMainDO, recMainVO)

  Record.create → convertMainDO → applyRecordRangeProperties（preserve）

```



---



## Legacy 离散 Service



### 离散 override create Checklist



重写 `convertMainDO` / `fillMainDefaults` / `validateMainMethod` 等 create 路径时：



| 检查项 | 说明 |

|--------|------|

| **只许** `applyRequestProperties` | 禁止组合 `applyRequestAreaProperties` + `applyRequestRangeProperties` + 手写 `auto*` |

| insert 之前写入 | 从 `jobUtils.selectBusinessType(...)` 读 DBC，禁止读前端快照覆盖 |

| 任务生成 preserve | `copyProperties(reqMainDO, jobMainDO)` 后 `applyJobProperties`，勿无条件 `setInInventoryStatuses(businesstypeDO...)` |

| 模块特有 override | 可在 `applyRequestProperties` 之后覆盖个别字段（如差异申请固定 `autoSubmit=false`），须注释说明 |



**反例**：`fillMainDefaults` 只调 `applyRequestAreaProperties`；或 area + range 分两次调用。



**正例**：`PutawayRequestMainService.fillMainDefaults` 单次 `applyRequestProperties`；`BaseRequestMainService.convertMainDO` 经 `applyBusinessTypeRequestProperties`。



### 细分方法保留范围



`applyRequestFlow/Range/AreaProperties` 仅由 `applyRequestProperties` 组合，或供 **Job/Record preserve**（`applyJobRangeProperties`、`applyJobAreaProperties` 等）使用；**业务 Service 不得直接调用**。



---



## 禁止模式



- 用 `extraProperties` 存/读业务类型配置快照

- 业务层组合调用 `applyRequestAreaProperties` / `applyRequestRangeProperties`

- 手写 `setFromAreaCodes` / `setInInventoryStatuses` 从 DBC 复制快照（Applier 内除外）

- 对已承接快照字段无条件 `selectBusinessType` 覆盖
- **update 路径刷新 range/库区快照**（如 Productredress update 曾重写 `in/outInventoryStatuses`）



### 2026-07-03 Legacy 收敛完成清单（`07-03-wms-bt-snapshot-inherit-fix`）

以下模块已从手写 `setInInventoryStatuses(businesstypeDO...)` 等反模式收敛为 Applier + inherit：

| 分类 | 模块 |
|------|------|
| A 申请 create | Unplannedissue/receipt、Stockup、Productreceipt、Customerreturn、Transferreceipt、Productrepair、Productredress |
| B 申请→任务 | 上列 Request + Productputawayhold、Purchasereturn/Purchasereceipt Job（**不含** Issue/Repleinsh Job、TransactionServiceImpl，暂缓） |
| C 任务→记录/直创 | Unplanned*Record、TransferreceiptRecord、IssueRecord（直创注释） |
| D 明细层 | ProductionreturnRequestDetail（改读主表快照） |

**静态扫描**：`service` 包内 `setInInventoryStatuses(businesstype|...` 命中数归零（合法直创路径已改 `applyRecordProperties` 并加注释）。

**暂缓模块（待单独任务）**：`IssueJobMainService`、`RepleinshJobMainService`、`TransactionServiceImpl` 内嵌补料/生产收料特殊任务链。

---



## 数据库



- 模板主表 77 张中 75 张三列齐全；`record_supplierdeliver_main`、`record_inspect_main` 非模板表，**不纳入**快照范围。

- `use_on_the_way_location` 已与 Java `Boolean` 对齐（75 张均为 boolean）。

