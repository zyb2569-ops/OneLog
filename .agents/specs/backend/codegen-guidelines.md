# 代码生成规范

> 约束 AI 或脚本按项目现有 Codegen 引擎语义生成后端 CRUD、Swagger 与前端页面。

---

## Scenario: 基于表元数据生成同构 CRUD

### 1. Scope / Trigger

- Trigger: 当需求是“按表生成 CRUD”、“补齐标准 VO/Controller/Service/Mapper/前端页面”或需要输出 `Map<path, content>` 形式的代码包时，必须遵循本规范。
- Scope: 适用于从数据库表元数据推导 `CodegenTable`、`CodegenColumn`，并生成后端 Java、SQL、前端 Vue3 文件路径与 OpenAPI 注解。
- Why: 该流程同时依赖数据库元数据、后端分层、Swagger、目录命名和前端页面骨架；若不与现有引擎同构，后续生成物会和仓库里的手写代码风格漂移。

### 2. Signatures

- 元数据输入：
  `dataSourceConfig(url, username, password, dataSourceConfigId)` + 可选 `tableName`
- 元数据构建语义：
  `JdbcUtils.getDbType(url)`
  `DataSourceConfig.Builder`
  `StrategyConfig.Builder`
  `ConfigBuilder -> List<TableInfo>`
- 逻辑表结构：
  `CodegenTable(tableName, tableComment, moduleName, businessName, className, classComment, scene, templateType, frontType, author, dataSourceConfigId)`
- 逻辑字段结构：
  `CodegenColumn(tableId, columnName, dataType, columnComment, nullable, primaryKey, javaField, javaType, createOperation, updateOperation, listOperation, listOperationCondition, listOperationResult, htmlType, example, ordinalPosition)`
- 全局绑定：
  `basePackage`
  `baseFrameworkPackage`
  `jakartaPackage`
  `sceneEnum`
  `primaryColumn`
  `permissionPrefix`
- 生成输出：
  `Map<String, String>` 或直接写入目标路径

### 3. Contracts

#### 3.1 元数据获取

- 使用 JDBC URL 推断数据库类型。
- SQL Server 必须补 `databaseQueryClass(SQLQuery.class)` 语义。
- 未指定 `tableName` 时，排除：
  `ACT_*`
  `QRTZ_*`
  `FLW_*`
  `IMPDP_*`
  `ALL_*`
  `HS_*`
  含 `$` 的表
- `GlobalConfig` 使用与现有生成器一致的 `DateType.TIME_PACK`。
- 输出表列表按 `TableInfo.name` 排序。

#### 3.2 `CodegenTable` 推导

- `tableComment` 不能为空，为空直接失败。
- `scene` 默认 `ADMIN`。
- `frontType` 读取 `win.codegen.front-type`；未提供时按 Vue3。
- 命名规则：
  `moduleName = subBefore(tableName.toLowerCase(), '_', false)`
  `businessName = toCamelCase(subAfter(tableName, '_', false)).toLowerCase()`
  `className = upperFirst(toCamelCase(subAfter(tableName, '_', false)))`
  `classComment = removeSuffixIgnoreCase(tableComment, "表")`
- 默认 `templateType = ONE`；树表、主子表只在显式要求时配置。

#### 3.3 `CodegenColumn` 推导

- `columnComment` 不能为空，为空直接失败。
- `ordinalPosition` 从 1 开始，保持数据库字段顺序。
- `javaField` 使用下划线转小驼峰。
- `javaType` 按现有 `CodegenConvert` 映射；映射为 `Byte` 时强制改为 `Integer`。
- 表无主键时，强制首列作为主键。

#### 3.4 CRUD 标志

- `BASE_DO_FIELDS = BaseDO 所有字段 + tenantId`
- `createOperation = 非 id / 非 BaseDO / 非主键`
- `updateOperation = 非 BaseDO 或主键`
- `listOperation = 非 id / 非 BaseDO(createTime 按引擎例外规则保留)`
- `listOperationCondition`：
  `*name -> LIKE`
  `*time` / `*date -> BETWEEN`
  其他默认 `EQ`
- `listOperationResult` 排除 `BaseDO` 中除 `createTime` 外的字段。

#### 3.5 UI 类型与示例值

- HTML 类型优先按后缀映射：
  `status/sex -> RADIO`
  `type -> SELECT`
  `image -> IMAGE_UPLOAD`
  `file -> FILE_UPLOAD`
  `content/description/demo -> EDITOR`
  `time/date -> DATETIME`
- 再按 Java 类型修正：
  `Boolean -> RADIO`
  `LocalDateTime -> DATETIME`
- 未命中时默认 `INPUT`。
- `example` 可以使用固定样例代替随机值，但语义必须等价：
  `*id/*price/*count -> 整数`
  `*name -> 人名`
  `*status/*type -> "1" 或 "2"`
  `*url -> URL`
  `*reason/*description/*memo/*remark -> 文本说明`

#### 3.6 文件路径

- 后端业务模块输出到：
  `mom/win-module-${moduleName}/win-module-${moduleName}-biz`
- API 错误码输出到：
  `mom/win-module-${moduleName}/win-module-${moduleName}-api`
- 典型后端路径：
  `controller/${sceneBasePackage}/${businessName}/${scenePrefix}${className}Controller.java`
  `controller/${sceneBasePackage}/${businessName}/vo/${scenePrefix}${className}{VOType}.java`
  `service/${businessName}/${className}Service.java`
  `service/${businessName}/impl/${className}ServiceImpl.java`
  `dal/dataobject/${businessName}/${className}DO.java`
  `dal/mysql/${businessName}/${className}Mapper.java`
  `src/main/resources/mapper/${businessName}/${className}Mapper.xml`
  `convert/${businessName}/${className}Convert.java`
  `src/test/java/.../service/${businessName}/${className}ServiceTest.java`
- API 手工补全文件名遵循现有引擎约定：
  `ErrorCodeConstants_手动操作.java`
- 前端 Vue3 至少生成：
  `ui/src/views/${moduleName}/${businessName}/index.vue`
  `ui/src/views/${moduleName}/${businessName}/*.data.ts`
  `ui/src/views/${moduleName}/${businessName}/*Form.vue`
  `ui/src/api/${moduleName}/${businessName}/index.ts`
- 若模块已有既有路径风格，优先延续该模块风格。

#### 3.7 Swagger / OpenAPI

- Controller 使用 `@Operation(summary = "...")` 与 `@Parameter`。
- VO 类使用 `@Schema(description = "...")`。
- VO 字段使用：
  `@Schema(description = columnComment, requiredMode = REQUIRED?, example = example?)`
- 只有当 `columnComment` 与 `example` 合法填充时，模板才视为完整。

#### 3.8 参考推导：`system_dept`

- `system_dept / 部门表` 推导结果：
  `moduleName = system`
  `businessName = dept`
  `className = Dept`
  `classComment = 部门`
- 典型输出：
  `AdminDeptController`
  `DeptService`
  `DeptDO`
  `DeptMapper`
  `AdminDeptCreateReqVO`
  `AdminDeptPageReqVO`
  对应前端 `index.vue + *.data.ts + *Form.vue + api/index.ts`

### 4. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| 表注释为空 | `tableComment` 必填 | 立即报错，禁止继续生成 |
| 字段注释为空 | `columnComment` 必填 | 立即报错，禁止继续生成 |
| SQL Server 未补查询类 | `SQLQuery.class` 语义缺失 | 视为元数据源配置错误 |
| 无主键 | `havePrimaryKey == false` | 首列补为主键，不允许生成无主键 CRUD |
| Java 类型映射为 `Byte` | 强制转 `Integer` | 避免与现有项目代码风格漂移 |
| 需要树表/主子表 | 必须显式声明 | 默认仍按单表 `ONE` 生成 |
| 前端文件只生成一个 `index.vue` | 缺少 schema/API/Form 文件 | 视为生成不完整 |

### 5. Good / Base / Bad Cases

#### Good

- 输入 `system_dept / 部门表`，生成：
  `moduleName=system`
  `businessName=dept`
  `className=Dept`
  `classComment=部门`
- 同时输出 Controller、Service、DO、Mapper、VO、Mapper XML、前端页面与 API 文件。

#### Base

- 输入普通单表，字段注释完整，存在主键。
- 输出标准 CRUD 后端文件、VO、Mapper XML、前端 `index.vue + *.data.ts + *Form.vue + api/index.ts`。

#### Bad

```java
String className = StrUtil.upperFirst(StrUtil.toCamelCase(tableName));
String businessName = tableName;
column.setCreateOperation(!column.isPrimaryKey());
```

### 6. Tests Required

- 表级命名测试：
  断言 `system_dept -> system/dept/Dept/部门`
- 字段级推导测试：
  断言 `name -> LIKE + INPUT`
  断言 `status -> RADIO + EQ`
  断言 `createTime -> DATETIME + BETWEEN`
- 主键兜底测试：
  无主键表时首列被设为主键
- 文件路径测试：
  断言生成路径落在 `win-module-<module>-biz/api` 和 `ui/src/views|api`
- Swagger 绑定测试：
  断言请求/响应 VO 带 `@Schema(description = ...)`
- 结果形态测试：
  断言输出可以直接序列化为 `Map<path, content>`

### 7. Wrong vs Correct

#### Wrong

```java
String className = StrUtil.upperFirst(StrUtil.toCamelCase(tableName));
String businessName = tableName;
column.setCreateOperation(!column.isPrimaryKey());
```

#### Correct

```java
String suffix = StrUtil.subAfter(tableName, '_', false);
String className = StrUtil.upperFirst(StrUtil.toCamelCase(suffix));
String businessName = StrUtil.toCamelCase(suffix).toLowerCase();
column.setCreateOperation(!CREATE_OPERATION_EXCLUDE_COLUMN.contains(javaField) && !primaryKey);
```
