# WMS 模板 · 查询与 Mapper / businessType

> 约束：同表多业务类型、分页/高级查询/导出增强一致、Mapper 分层条件。  
> 入口：[WMS 模板继承规范](./wms-template-inheritance-guidelines.md)

---

## 场景：分页查询与 businessType

### 1. Scope / Trigger

- Detail/Main 普通分页、高级查询、导出共用查询生命周期。
- 多页面共用一张表，靠 `businessType` 区分。
- 子 Mapper 重复父类条件，或字符串拼接 `inSql`。

### 2. Signatures

查询固定生命周期：

```text
父类规范化并限定 businessType
  -> Mapper 应用 Base 条件
  -> 单向/双向 Mapper 应用方向层条件
  -> 业务 Mapper.applyBusinessPageFilters
  -> 执行分页 / 高级查询
  -> 父类批量补 creatorName / updaterName
  -> 方向层批量补 batchInfo
  -> 业务 afterGetPage / afterGetSenior 只补业务展示字段
```

```java
// 业务层追加条件（不得复制父层字段条件）
default void applyBusinessPageFilters(MPJLambdaWrapperX<DetailDO> wrapper, PageReqVO reqVO) { }

// 查询后增强（覆盖必须 super）
protected void afterGetPage(...);
protected void afterGetSenior(...);
```

超页空列表（目标契约）：

```java
PageResult<DetailDO> pageResult = mapper.selectPage(...);
if (CollectionUtils.isEmpty(pageResult.getList())) {
    return PageResult.empty(); // 或 empty(total)——见下方三链说明
}
```

### 3. Contracts

#### 3.1 同表多业务类型（目标契约 = 原版）

- 一张主表/明细表对应多页面时，后端只保留一套 Controller / Service / Mapper / 请求地址。
- UI、PDA、其他调用方必须显式传 `businessType`。
- 创建、分页、高级查询、导出使用调用方传入的 `businessType`。
- **父类只允许在调用方未传业务类型时补默认值，禁止删除或覆盖已经传入的业务类型条件。**
- 子类不为正常页面请求猜测业务类型；导入等独立入口可保留白名单校验。
- `businessType` 是查询前必须执行的父类内部规则，不是可选 hook。共表多业务页面必须由调用方显式传入。

```java
// 正确（目标实现，与原版一致）：只在缺失时补默认类型
boolean hasBusinessType = conditions.getFilters().stream().anyMatch(condition ->
        condition != null
                && ("businessType".equals(condition.getColumn())
                || "business_type".equals(condition.getColumn()))
                && StringUtils.isNotBlank(condition.getValue()));
if (!hasBusinessType) {
    conditions.getFilters().add(new CustomConditions.Condition(
            "businessType", "==", defaultBusinessType));
}
```

> **已知偏差（须向契约收敛，不得倒推为规范）**  
> 现行 `BaseJobMainService` / `BaseJobDetailService` 的 `normalizeBusinessTypeCondition` 符合上述「仅缺失补默认」。  
> 现行 `BaseRequest*Service` / `BaseRecord*Service` 仍 `removeIf` 后强加配置默认值，**违反本契约**；改造与验收以本契约为准，并应修齐 Request/Record 与 Job 一致。

#### 3.2 查询返回契约

- Base 私有分页转换完成 DO→VO、分页元数据、creatorName/updaterName、主表公共字段合并；**不是 hook**，禁止恢复 `handlePage`。
- 方向层在 `afterGetPage/afterGetSenior` 补批次：单向 `batchId`；双向 `fromBatchId/toBatchId`（含生产日期、批次号等公共展示）。
- 业务层覆盖 after hook 时先 `super`，再补生产日期、仓库别名、业务备注等；**用户名称、批次信息、公共字典不属于业务扩展**。
- `creatorName/updaterName` 由父类收集后批量查用户；子类不得逐条调用户接口或复制相同循环。
- Main/Detail 公共用户信息与主表字段合并由 Base 私有流程完成。
- 查询前一般不向业务子类开放空 `beforeGetPage/beforeGetSenior`；业务字段过滤进 Mapper `applyBusinessPageFilters`；确有参数转换时保留唯一且语义明确的查询前 hook。
- 普通分页、高级查询、导出必须使用相同增强能力。
- 页面列表以 Detail 为查询主体时：明细条件落 Detail wrapper；主表条件通过 `master_id` 子查询或已封装 main filter 追加。
- 主表 `remark`、明细 `remark`、`extraProperties` 的覆盖优先级必须明确，禁止盲目 `copyProperties`。

##### 超页空结果（目标与现状）

| 链 | 目标契约 | 现行实现备注 |
|----|----------|--------------|
| Request Main/Detail | 列表空 → 提前返回空页，避免误用旧数据 | 已 `PageResult.empty()` |
| Record Main/Detail | 同左 | 已 `PageResult.empty()` |
| Job Main | 同左（至少不得返回「脏 list」） | 当前刻意保留 `total`+空 list，**未**走 `empty()`；验收时核对 total 语义，最终应与三链统一策略对齐 |
| Job Detail | 空 list 安全返回 | 现行 `PageResult.empty(total)` |

目标原则（原版）：访问页码超过最大页时必须保留空页判断，禁止把上一页数据残留到响应。

#### 3.3 Mapper

- 优先使用 `BaseRequest*Mapper` / `BaseJob*Mapper` / `BaseRecord*Mapper`。
- `queryMainListToMap`、普通 `selectPage` 等父 Mapper 已有方法，子 Mapper 不重复实现。
- 子 Mapper 可保留：`entityClass`/批次 getter 等泛型能力、`applyBusinessPageFilters`、数据权限注解、确需主表过滤/批次 JOIN/特殊排序的查询。
- 禁止仅为调用 `BaseMapperX.super.selectPage` 再声明同签名转发。
- 手写 SQL / `inSql` / XML 必须自处理 `deleted`；实体 wrapper 会自动逻辑删除。
- 禁止拼接用户输入构造 `inSql`；用 Lambda/MPJ、参数化 SQL，或先类型化查主表 ID。
- `COLUMN_TENANT_ID` 等列常量只在 MPJ/反射无法正确解析映射时增加，并写明原因，不能作为普通查询默认样板。
- `@DataScopeLocation`：单向默认 `location_code`，双向默认 `to_location_code`；无特殊权限时不要仅为重复注解重写 `selectPage/selectSenior`。
- 重写查询方法时必须重新声明方法级权限注解（不会自动继承）。
- `@SubDataScope` 的 `deptAlias` 是具体主表名，子 Mapper 可保留薄方法调父类，不得复制条件。

#### 3.4 业务类型规则（与查询/生命周期交界）

| 规则类型 | 父类职责 | 子类职责 |
|----------|----------|----------|
| 开关/直达类规则 | 统一解析布尔值与生命周期时机，写入快照（如 `directCreateRecord`） | 不在多处重复判断；特有动作进对应 hook |
| 接口规则 | 统一判断是否发送、解析接口类型 | 在 `publish` 或 after 组装本业务消息 |
| 编号规则 | 读 `request_number_id` / `job_number_id` / `record_number_id` 并生成 | 不重复封装编号方法 |

- 规则解析结果写入主表快照，后续优先用快照，避免执行中 DBC 配置变化导致前后不一致。见 [业务类型快照规范](./wms-business-type-snapshot-guidelines.md)。
- 已有公共工具封装的规则解析，不在父/子类再套同义方法。
- 迁移期删除 DBC `SwitchApi` 开关分支，见 [Hook 与迁移](./wms-template-hook-and-migration.md)。

### 4. Validation & Error Matrix

| 条件 | 结论 | 处理 |
|------|------|------|
| 高级查询覆盖/删除前端已传 `businessType` | 功能错误 | 仅缺失时补默认；修齐 Request/Record |
| 存在 `handlePage` | 不合规 | 固定转换收回 Base，差异进 after |
| Mapper 重复 `queryMainListToMap` / 空 `selectPage` 转发 | 不合规 | 删除 |
| 原始 SQL 拼接 businessType/用户 ID | 安全错误 | 参数化 |
| 手写 SQL 无 `deleted = false` | 功能错误 | 补逻辑删除 |
| 超页返回含旧数据的 list | 功能错误 | 空页提前返回 |
| 页面有 creatorName，导出没有 | 不一致 | 三入口共用增强 |
| 逐条查用户/批次 | 性能/不合规 | 改父类批量增强 |

### 5. Good / Base / Bad Cases

- Good：Detail Mapper 只实现业务字段筛选；方向层 `super.afterGetPage` 后再补业务显示字段。
- Base：共表多业务由调用方传 `businessType`；单业务配置可缺省补默认。
- Bad：高级查询把 `TransferReceipt` 强制换成 `Move`。
- Bad：每个业务 for 循环逐条查用户和批次。

### 6. Tests Required

- 普通分页与高级查询均按**调用方传入**的 `businessType` 过滤（显式条件不被覆盖）。
- Detail 同时覆盖明细条件、主表条件、数据权限、逻辑删除。
- 超页：空 list，且无上一页脏数据；核对 total 与约定策略一致。
- 导出与页面增强字段一致（creatorName、batchInfo、业务字段）。

### 7. Wrong vs Correct

```java
// Wrong：覆盖显式业务类型（现行 Request/Record 偏差形态）
conditions.getFilters().removeIf(c -> "businessType".equals(c.getColumn()));
conditions.getFilters().add(new Condition("businessType", "==", configDefault));

// Correct：仅缺失时补默认（Job 现行做法 / 目标契约）
if (!hasBusinessTypeCondition(conditions)) {
    conditions.getFilters().add(new Condition("businessType", "==", defaultBusinessType));
}
```

```java
// Wrong：每个业务逐条补用户和批次
for (XxxDetailRespVO item : pageResult.getList()) {
    item.setCreatorName(userApi.getUser(Long.valueOf(item.getCreator())).getNickname());
    item.setBatchInfo(batchService.get(item.getBatchId()));
}

// Correct：父类批量增强，子类只补业务字段
enrichOperatorNames(pageResult);
enrichDirectionalBatchInfo(pageResult);
afterGetPage(...); // 业务只填本层展示字段
```

```java
// Wrong：空转发 selectPage
default PageResult<DetailDO> selectPage(PageReqVO reqVO, QueryWrapper<DetailDO> wrapper) {
    return BaseMapperX.super.selectPage(reqVO, wrapper);
}

// Correct：只扩展业务条件
@Override
default void applyBusinessPageFilters(MPJLambdaWrapperX<DetailDO> wrapper, PageReqVO reqVO) {
    wrapper.eqIfPresent(DetailDO::getBusinessField, reqVO.getBusinessField());
}
```
