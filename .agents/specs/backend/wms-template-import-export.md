# WMS 模板 · 导入导出

> 基于 `core`：`ImportConfig` / `ImportWorkbench` / `ExportConfig`。  
> 字典字段类型契约见 [Excel 导入导出规范](./excel-import-export-guidelines.md)。  
> 入口：[WMS 模板继承规范](./wms-template-inheritance-guidelines.md)

---

## 场景：Request 导入与三链导出

### 1. Scope / Trigger

- 业务需要 Excel 导入模板、导入、错误文件回传。
- 业务需要普通导出 / 高级导出，且列与前端字段设置对齐。
- 子类绕过 `create()` 直接写 Mapper，或自写平行导入生命周期。

### 2. Signatures

#### 2.1 配置对象（不是 lifecycle hook）

```java
// 子类必须提供；默认基类抛 UnsupportedOperationException
protected ImportConfig getImportConfig();   // 仅 Request Main 完整导入链
protected ExportConfig getExportConfig();   // Request / Job / Record Main

// ImportConfig 字段
importVoClass, createReqVoClass, updateReqVoClass,
errorVoClass, errorFilePrefix, templateMeta, emptyListErrorCode

// ExportConfig 字段
fileName, sheetName, excelVoClass, mapDropDown, businessName
```

#### 2.2 导入钩子（仅 `BaseRequestMainService`）

```text
importTemplate
  -> beforeImportTemplate
  -> 写模板

importExcel(file, ImportContext)
  -> getImportConfig
  -> 读 Excel
  -> beforeImportExcel(ImportWorkbench)   // 校验、查重、scheduleCreate/scheduleUpdate
  -> 基类统一 create() / persistImportUpdate()
  -> 写错误文件（如有）
  -> afterImportExcel(workbench, resultMap)
```

`ImportContext`：`mode`（1 更新 / 2 追加 / 3 覆盖）、`updatePart`、扩展查询参数。

Workbench 能力：`addError`、`scheduleCreate`、`scheduleUpdate`。

#### 2.3 导出钩子

```text
exportExcel / exportSeniorExcel
  -> beforeExportExcel / beforeExportSeniorExcel
  -> 查明细 DO（与 page/senior 同条件族）
  -> buildExportRowsFromDetails
  -> writeExport（按 ExportConfig；businessName 非空则尝试 Redis 动态列）
```

无 `afterExport*` 业务契约；展示增强应落在查询增强路径，保证导出与页面一致。

### 3. Contracts

#### 3.1 导入

- **完整导入编排仅 Request Main**；Job/Record 不套同一套 ImportWorkbench，除非未来基类显式扩展。
- `getImportConfig()` / `getExportConfig()` 提供配置，**不属于** before/after 生命周期 hook。
- `beforeImportExcel` 只做校验、查重、调度 create/update；**禁止**在 hook 内直接 Mapper insert。
- 实际落库必须走公开 `create()` / 基类更新入口，从而复用编号、状态机、明细校验、趋势。
- `updateReqVoClass` 为空却 `scheduleUpdate` 时，基类抛明确异常。
- 错误文件使用完整模板字段 + 导入状态/说明，表头类显式传入（见导入错误全模板相关实践）。
- JSON 统一 Hutool；禁止恢复 Fastjson。

#### 3.2 导出

- 导出列以 `excelVoClass` 的 `@ExcelProperty` 为准。
- `businessName` 非空：按用户字段设置过滤；取不到配置则全列导出并打日志。
- 普通导出与高级导出的过滤、权限、`businessType` 规则与 page/senior 一致。
- 子类只实现 `getExportConfig` + 必要的 `beforeExport*`（如额外过滤）；禁止重写整段导出拼装。

### 4. Validation & Error Matrix

| 条件 | 结论 | 处理 |
|------|------|------|
| 未实现 `getExportConfig` 却调导出 | 运行失败 | 子类提供 ExportConfig |
| 导入绕过 `create` 直写 Mapper | 不合规 | 改 scheduleCreate + 基类落库 |
| mode 需更新但无 `updateReqVoClass` | 配置错误 | 补 UpdateReqVO 类型 |
| 导出有列、页面无增强字段 | 不一致 | 复用 afterGetPage 同源增强 |
| 错误文件只有「导入状态/说明」两列 | 体验不合规 | 使用带表头完整错误 VO |

### 5. Good / Base / Bad Cases

- Good：`beforeImportExcel` 内校验后 `workbench.scheduleCreate(createVO)`；基类统一 `create()`。
- Base：单业务导出提供固定 `ExportConfig`；动态列配 `businessName`。
- Bad：导入 hook 内 `mainMapper.insert` + 自写明细与趋势。
- Bad：为每个业务复制一整套 EasyExcel 写出代码，忽略 `ExportConfig`。

### 6. Tests Required

- 下载模板字段与 Import VO 一致。
- 追加/更新/覆盖三种 mode：成功行落库走标准 create/update；失败行进入错误文件且含原字段。
- 空文件返回约定错误码（`emptyListErrorCode` 或默认）。
- 普通导出、高级导出、空数据均可生成文件；动态列开关下行为符合 ExportConfig。
- 导入成功单据的状态机/趋势与手工创建一致。

### 7. Wrong vs Correct

```java
// Wrong：导入自己落库
protected void beforeImportExcel(ImportWorkbench workbench) {
    for (Row row : rows) {
        mainMapper.insert(toDO(row));
    }
}

// Correct：只调度，基类 create
protected void beforeImportExcel(ImportWorkbench<CreateVO, MainDO> workbench) {
    for (CreateVO vo : validRows) {
        workbench.scheduleCreate(vo);
    }
}
```

```java
// Wrong：导出当第二套生命周期
@Override
public void exportExcel(...) { /* 自查自写 */ }

// Correct
@Override
protected ExportConfig getExportConfig() {
    return ExportConfig.builder()
            .fileName("xxx.xlsx")
            .sheetName("数据")
            .excelVoClass(XxxExcelVO.class)
            .businessName("xxx")
            .build();
}
```
