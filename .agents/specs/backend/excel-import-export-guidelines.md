# Excel 导入导出规范

> 后端 Excel 导入、导出、错误文件的字段契约与字典转换规则。
>
> WMS 申请主链 **Base 继承、导入钩子、多模板重载、导出与 page 增强复用** 见 [WMS 模板 · 导入导出继承](./wms-template-import-export.md)；模板总入口见 [WMS 模板继承规范](./wms-template-inheritance-guidelines.md)。

---

## Scenario: 字典字段导入导出契约

### 1. Scope / Trigger

- Trigger: Excel 导入/导出字段使用 `@DictFormat`、`DictConvert`，且 VO 字段类型与 DO 字段类型不一致。
- 适用范围：DBC/WMS 等业务模块的导入模板、导入错误文件、普通导出、高级导出。
- 禁止把业务模块的字典错配问题下沉到 `win-framework` 兜底；应在模块 VO/Convert 中显式对齐。

### 2. Signatures

- 导入 VO 字段：

```java
@ExcelProperty(value = "是否可用", converter = DictConvert.class)
@DictFormat("true_false")
private String available;
```

- DO 字段：

```java
private Boolean available;
```

- MapStruct Convert：

```java
@Mapping(target = "available", expression = "java(trueFalseValueToBoolean(bean.getAvailable()))")
PackagesHierarchyDO convert01(PackagesHierarchyImportExcelVO bean);

@Mapping(target = "available", expression = "java(booleanToTrueFalseValue(bean.getAvailable()))")
PackagesHierarchyImportErrorVO convert02(PackagesHierarchyDO bean);
```

### 3. Contracts

- Excel 单元格写入字典 `label`，例如 `是`、`否`。
- `DictConvert.convertToJavaData` 读取 Excel 后返回字典 `value`，例如 `TRUE`、`FALSE`。
- 模块 Convert 负责把字典 `value` 转为 DO 真实字段类型，例如 `Boolean.TRUE`、`Boolean.FALSE`。
- 导出或错误文件写出前，模块 Convert 负责把 DO 字段转回字典 `value`，再交给 `DictConvert.convertToExcelData` 输出 `label`。
- 涉及字典项时，必须用当前环境 `/system/dict-data/simple-list?dictType=...` 或数据库 `system_dict_data` 验证 `label/value/status`，不能凭字段中文名猜。

### 4. Validation & Error Matrix

| 条件 | 正确处理 | 错误表现 |
|------|----------|----------|
| Excel 写入 `是` | `DictConvert` 转为 `TRUE`，Convert 转为 `Boolean.TRUE` | 直接写 `TRUE` 到 Excel，真实 E2E 不符合模板使用方式 |
| DO 为 `Boolean.TRUE` | Convert 转为 `TRUE`，`DictConvert` 写出 `是` | 直接把 Boolean 交给 `DictConvert`，可能查 `true` 失败 |
| 字典 value 与 DO 类型不同 | 在模块 Convert 中显式转换 | 修改 framework 兼容业务特例 |
| 字典项不确定 | 查当前环境字典表和历史业务数据 | 按字段名猜成相近字典 |

### 5. Good/Base/Bad Cases

- Good: `true_false` 字典为 `是 -> TRUE`、`否 -> FALSE`，导入 VO 使用 `String available`，DO 使用 `Boolean available`，Convert 显式互转。
- Base: 非字典字段类型一致时，可保持 MapStruct 默认映射。
- Bad: `@DictFormat("true_false") private Boolean available;` 直接用于导出，导致 `DictConvert` 用 `true/false` 查 `TRUE/FALSE` 字典。

### 6. Tests Required

- 真实 E2E：下载模板，Excel 写入字典 `label`，导入接口返回 `errorCount=0`。
- 分页验证：按业务唯一键回查 page，断言落库字段为 DO 真实类型和值。
- 导出验证：下载 Excel，解析导出行，断言字典字段显示为 `label`。
- 错误文件验证：导入失败时下载错误文件，断言错误行中的字典字段可读且日志无 `DictConvert` 字典转换错误。

### 7. Wrong vs Correct

#### Wrong

```java
@ExcelProperty(value = "是否可用", converter = DictConvert.class)
@DictFormat("true_false")
private Boolean available;
```

#### Correct

```java
@ExcelProperty(value = "是否可用", converter = DictConvert.class)
@DictFormat("true_false")
private String available;

default Boolean trueFalseValueToBoolean(String available) {
    if (available == null) {
        return null;
    }
    return "TRUE".equalsIgnoreCase(available);
}
```

## Scenario: WMS 制品收货申请导入自动创建批次

### 1. Scope / Trigger

- Trigger: 修改 `POST /wms/productreceipt-request-main/import` 或 `GET /wms/productreceipt-request-main/get-import-template`。
- 适用范围：普通制品收货申请导入；隔离收货 `extend=scrap` 仍按独立分支处理。

### 2. Signatures

- 模板接口：`GET /wms/productreceipt-request-main/get-import-template`
- 导入接口：`POST /wms/productreceipt-request-main/import`
- 导入 VO：`ProductreceiptRequestImportVO`
- Service：`ProductreceiptRequestMainService#importProductreceiptRequestList`

### 3. Contracts

- 普通制品收货申请导入模板不包含 `批次`、`过期日期`。
- Excel 行里的 `生产日期` 通过 `ProductreceiptRequestMainCreateReqVO` 落到主表模型，不在 `ProductreceiptRequestDetailDO` 中。
- 子表校验使用导入明细字段校验生产线、生产线物料关系、物料、工位、BOM、数量；生产日期校验读取主表 `mainDo.produceDate`。
- 所有行校验通过后，Service 创建 `transaction_batch`，再把创建出的 `batchId` 回写到申请明细。
- `transaction_batch` 只承载批次字段：生产线、工序、生产日期、批次编码、过期日期、班组、班次等；车间仍属于主表，工位、物料、BOM、数量仍属于明细。
- 批次过期日期由物料 `validityDays` 计算；为空或 0 时使用固定最大过期日期。
- Page 接口里的日期字段可能以 13 位毫秒时间戳返回，E2E 脚本不能只按日期字符串解析。

### 4. Validation & Error Matrix

| 条件 | 正确处理 | 错误表现 |
|------|----------|----------|
| Excel 未填生产日期 | 返回行级错误 `生产日期不能为空` | 通过空批次间接报 `productionLineCode` 缺失 |
| Excel 未填批次 | 普通导入不要求用户填写，系统自动创建批次 | 继续用 `detail.batchId` 查询 `transaction_batch` |
| 批次创建前存在明细校验错误 | 不创建批次，返回错误文件 | 先创建孤立批次再报错 |
| 物料有效期为空 | 批次过期日期使用固定最大日期 | 过期日期为空落库 |

### 5. Good/Base/Bad Cases

- Good: 模板只有用户可维护字段，导入成功后 page 明细 `batchId` 非空，`batchInfo.productionLineCode/processCode/produceDate/expireDate` 可回查。
- Base: 隔离收货继续走 `importProductreceiptScrapRequestList`，不复用普通导入自动建批次逻辑。
- Bad: 在 `ProductreceiptRequestDetailDO` 上调用 `getProduceDate()`；该 DO 当前没有生产日期字段。

### 6. Tests Required

- 真实 E2E 必须走网关 `/admin-api`：
  - 下载模板，断言没有 `批次`、`过期日期` 表头。
  - 构造不含这两列的 Excel。
  - 导入返回 `code=0` 且 `data.errorCount=0`。
  - `/wms/productreceipt-request-detail/page` 查到明细，且 `batchId` 非空。
  - 校验 `batchInfo.productionLineCode`、`batchInfo.processCode`、`batchInfo.produceDate`、`batchInfo.expireDate`。
  - 导出 Excel 能包含导入明细。

### 7. Wrong vs Correct

#### Wrong

```java
TransactionBatchDO batch = transactionBatchService.get(detailDo.getBatchId());
productionlineApi.productionLineCodeExist(batch.getProductionLineCode());
validatorProductDate(batch.getProduceDate());
```

#### Correct

```java
productionlineApi.productionLineCodeExist(detailDo.getProductionLineCode());
validatorProductDate(mainDo.getProduceDate());
createTransactionBatchForImport(mainDo, subDOList);
```

## Scenario: WMS 导出查询口径必须与页面 Page 一致

### 1. Scope / Trigger

- Trigger: WMS 页面为了复用列表展示，实际 page 接口查询的数据源不同于页面路由名或导出 Controller 所在模块，或导出实现误把 page 接口的分页结果当作导出数据源。
- 适用范围：普通导出、高级导出、动态列导出、“前端所见即导出所得”的主子表合并导出。
- 模板继承侧（父类路由、afterGetPage 增强复用）另见 [WMS 模板 · 导入导出继承](./wms-template-import-export.md)。

### 2. Contracts

- 导出行数据必须以当前页面实际使用的 page 查询口径为事实源，而不是按导出 Controller 名称猜测表。
- 导出不能直接使用 page 接口返回的分页 `list`，也不能为了导出复用前端当前页数据；导出应在相同查询条件下取全部匹配数据。
- 如果页面列表查 `xxx-detail/page`，导出也必须从同一个 detail 查询 VO / Mapper / Service 的过滤条件开始，再通过全量列表查询批量补主表字段。
- 如果页面通过 `businessType` 复用另一个业务族的数据表，普通导出和高级导出都必须强制收敛同一个 `businessType`，避免导出全量或查错表。
- 动态列只负责列过滤和排序，不能掩盖导出查询口径与页面 page 不一致的问题。

### 3. Wrong vs Correct

#### Wrong

```text
页面 page -> record_productreceipt_detail where business_type = ProductRedress
导出     -> record_productredress_detail where business_type = ProductRedress
```

#### Correct

```text
页面 page -> record_productreceipt_detail where business_type = ProductRedress
导出     -> record_productreceipt_detail where business_type = ProductRedress（相同查询条件下全量导出）
```

## Scenario: WMS 导入错误文件必须显式传表头类

### 1. Scope / Trigger

- Trigger: 新增或修改 WMS 模块的 `POST /import` 错误文件写出，或为导入错误列表新建 VO。
- 适用范围：`WmsExcelI18nHelper.writeLocalFile` 的错误文件写出调用点，以及新建的 `XxxImportErrorVO`。
- 禁止用 3 参重载隐式推导表头；错误文件写出一律显式传表头类。

### 2. Signatures

```java
// 允许：4 参重载，显式传错误 VO 表头类
WmsExcelI18nHelper.writeLocalFile(filename, "错误列表", XxxImportErrorVO.class, errorList);

// 禁止：3 参重载，从 data.get(0).getClass() 推导表头
WmsExcelI18nHelper.writeLocalFile(filename, "错误列表", errorList);
```

### 3. Contracts

- 3 参重载从 `data.get(0).getClass()` 推导表头：`errorList` 为空时抛出 `IllegalArgumentException`；运行时类型与声明类型不一致时输出列错位。推导表头不是公开发布契约，调用点必须自行显式传 `XxxImportErrorVO.class`。
- 错误 VO 表头类必须是含 `导入状态`、`导入说明` 的错误行类型（`XxxImportErrorVO`），不能传导入读入 VO（`XxxExcelVO`）——后者缺少状态/原因列，错误文件无法直接修正后重新导入。
- 新建 `XxxImportErrorVO` 时，若模块已有导入读入 VO（`XxxExcelVO` 或 `XxxImportExcelVo`）则继承之，只追加 `@ExcelProperty(value = "导入状态", index = 0) private String importStatus;` 与 `@ExcelProperty(value = "导入说明", index = 1) private String importRemark;`；模块间既有命名（`AccountcalendarImportErrorVO` 独立声明、`CallmaterialsImportErrorVO` 继承）保持各自现状，不为统一格式破坏既有继承关系。
- Service 返回类型与 Controller 的 `errorList` 声明必须是同一个 `XxxImportErrorVO`，与传入 writeLocalFile 的表头类一致，避免泛型类型错位。
- 一条链路按业务状态拆分多个错误文件名时（如采购退货 Spare/New/MorderType），每个分支都要显式传各自对应的表头类。

### 4. Validation & Error Matrix

| 条件 | 正确处理 | 错误表现 |
|------|----------|----------|
| `errorList` 可能为空 | 4 参显式传表头类，空时不调用写出 | 3 参推导 `data.get(0)` 抛 `IllegalArgumentException` |
| 错误行需要含失败原因 | 传 `XxxImportErrorVO.class` | 传读入 VO 后错误文件缺 `导入状态`/`导入说明` 列 |
| Service 有行级失败分支 | 在 catch/校验失败处填 `importStatus`、`importRemark` 后加入 errorList | 只 `add(item)` 不填原因，错误文件看不出失败原因 |

### 5. Wrong vs Correct

#### Wrong

```java
WmsExcelI18nHelper.writeLocalFile("业务导入错误数据" + epoch + ".xlsx", "错误列表", errorList);
```

```java
List<XxxExcelVO> errorList = xxxService.importXxxList(list, mode, updatePart);
WmsExcelI18nHelper.writeLocalFile(filename, "错误列表", XxxExcelVO.class, errorList);
```

#### Correct

```java
WmsExcelI18nHelper.writeLocalFile(filename, "错误列表", XxxImportErrorVO.class, errorList);
```

```java
List<XxxImportErrorVO> errorList = xxxService.importXxxList(list, mode, updatePart);
// Service 失败分支：填入失败原因后再 add
item.setImportStatus("失败");
item.setImportRemark(ex.getMessage());
errorList.add(item);
```
