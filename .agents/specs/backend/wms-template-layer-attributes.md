# WMS 模板 · 逐层属性

> 约束：同一继承链中属性只声明一次，且与同层查询/校验闭环。  
> 入口：[WMS 模板继承规范](./wms-template-inheritance-guidelines.md)

---

## 场景：属性声明与同层行为闭环

### 1. Scope / Trigger

- 新增或调整 Base / 方向 / 业务任一层的 VO、DO 字段。
- 子类为了注解、Swagger、兼容而遮蔽父类同名字段。
- 父类有字段但分页/校验只在部分业务生效。

### 2. Signatures

#### 2.1 四项逐层职责契约（原版）

继承链每一层都必须形成完整、封闭的职责单元，而不是只继承字段：

| 本层内容 | 本层必须提供的能力 | 下一层如何扩展 |
|----------|--------------------|----------------|
| DO / VO 新增属性 | 只声明本层首次引入的属性 | 直接继承，不得重复声明 |
| 普通分页 / 高级查询 | Mapper 封装本层属性对应的查询条件 | 调用父层查询能力后，仅追加本层条件 |
| 创建 / 修改校验 | Service 封装本层属性的必填、合法性、关联校验和默认值 | 调用父层校验后，仅追加本层校验 |
| 生命周期差异 | 使用 `convert* / before* / after* / publish / generateTransaction` 等 | 不覆盖父类完整公开流程和统一持久化步骤 |

#### 2.2 三层模型

| 层级 | 定位 | 属性 | Mapper | Service |
|------|------|------|--------|---------|
| Base | Request/Job/Record 最小公共模型 | 所有方向、所有业务共有字段 | Base 普通分页/高级查询/主表关联 | 公共转换、校验、生命周期编排 |
| 单向/双向 | 库存方向模型 | **主要落在 Detail**；Main 不分向建属性 | 追加方向 Detail 条件与默认库位权限 | 方向转换、预计库存、库存事务 |
| 具体业务 | 如 Customerreturn、Inventorymove | 仅业务首次引入字段 | 仅业务条件与必要特殊 JOIN | before/after 业务校验与联动 |

Main VO、Main DO、Main Mapper 不按单向/双向重复建立属性模型。Main Service 允许 `BaseUnidirectional*MainService` / `BaseBidirectional*MainService` 承接方向性生命周期，但不得在该层重复声明 Main 属性或复制基础持久化。禁止为形式对称新增没有方向性行为的空 Main 中间层。

强制顺序：

1. `convert*`：VO→DO，补齐校验/落库前派生字段；不插库、无外部副作用。
2. `beforeCreate` / `beforeUpdate`：本层新增属性校验与落库前准备；不复制父层校验。
3. 父类公开 `create` / `update` 内联骨架：编号、状态机、主子表持久化等；业务子类原则上不覆盖。
4. `afterCreate` / `afterUpdate`：落库后联动。
5. 已有专用能力（`publish` / `generateTransaction` 等）优先于把一切塞进一个 `afterCreate`。
6. 无法归入 before/after 的差异，先检查现有专用 hook；只有多个业务共同需要且确属父层职责时才增加窄 hook。

### 3. Contracts

#### 3.1 属性唯一声明

- 同一继承链中，属性只在首次引入的层级声明一次；子类 VO/DO **不得**重新声明父类同名属性。
- 适用于 `BaseVO / CreateReqVO / UpdateReqVO / PageReqVO / RespVO / DO`。
- 禁止为必填注解、Swagger、序列化或页面兼容做字段遮蔽。创建/修改差异用校验分组、类级校验或 `beforeCreate/beforeUpdate`。
- 历史兼容只能保留**不同名**字段，并在 Mapper/Service 边界显式映射。
- 删除重复字段后，必须静态检查 BeanUtils、MapStruct、Jackson、MyBatis、分页、导入导出仍能通过继承 getter/setter 工作。

#### 3.2 同层查询 / 校验闭环

父层新增属性时，必须在**同一层**同步检查：DO、VO、普通分页、高级查询、创建校验、修改校验、必要转换/默认值。  
业务层新增属性同理，但只能改业务层 Mapper/Service hook。

| 层级 | 查询职责 | 创建/修改职责 |
|------|----------|----------------|
| `Base*VO / Base*DO` | 父 Mapper 纳入公共条件 | 父 Service 校验并补齐公共属性 |
| 业务 `Xxx*VO / Xxx*DO` | 子 Mapper 只追加业务条件 | 子 Service 只追加业务校验/赋值 |

强制约束：

1. 父类已有属性不得在多个子 Mapper 重复写相同条件。
2. 父类已有校验不得在子 Service 再执行一遍（远程物料/库位/库存/业务类型尤其禁止重复）。
3. 子类新字段必须判断：是否需要普通分页、高级查询映射、创建校验、修改校验。
4. 创建与修改默认共用规则；仅一侧适用时用对应 before hook。
5. 主表字段过滤明细时用参数化 JOIN/公共 main filter，禁止拼接用户输入形成 `inSql`。
6. 父层新字段优先补父 Mapper/父 Service，使子类自动获得行为。

#### 3.3 VO 家族边界

- Main：`MainBaseVO → Base*MainVO<DetailBaseVO>`；`MainRespVO → Base*MainPageRespVO<DetailRespVO>`；`MainPageReqVO → Base*MainPageReqVO`。
- Detail：仅 Detail 分 Uni/Bi；`DetailBaseVO → Base(Unidirectional|Bidirectional)*DetailVO`。
- `CreateReqVO` 与 `UpdateReqVO` **必须两个类**，即使字段暂时相同也不得合并。
- `MainBaseVO` 的 `subList` 泛型固定为 `DetailBaseVO`，不得填 `DetailCreateReqVO` / `DetailRespVO`。
- 完整的泛型位填充表见 [VO 泛型规范](./wms-template-vo-generic-spec.md)。

### 4. Validation & Error Matrix

| 场景 | 正确 | 禁止 |
|------|------|------|
| 父 VO/DO 已有字段 | 子类继承 getter/setter | 子类再声明同名字段 |
| 创建/修改必填不同 | 分组或对应 hook | 在 Create/Update VO 复制字段只为改注解 |
| 父类公共字段在 PageReqVO | 父 Mapper 自动条件 | 只有部分业务能过滤 |
| 子类新业务字段 | 子 Mapper 加条件 | 改父 Mapper 写死具体业务字段 |
| 子类新必填 | 子 before hook | 重写完整 `create/update` |

### 5. Good / Base / Bad Cases

- Good：业务 CreateReqVO 只声明 `createSource`；`customerCode` 已在父层。
- Base：父 `applyBasePageFilters` + 父 `validateDetailMethod`；子只 `applyBusinessPageFilters` + `beforeCreate`。
- Bad：CreateReqVO 再声明父类已有 `customerCode` 并加 `@NotNull` 遮蔽。

### 6. Tests Required

- 父子 VO/DO 同名字段交集为空。
- 父层每个公共查询字段：普通分页与高级查询各验一次。
- 子类新字段：传值生效、缺失不误过滤、非法值业务错误码。
- 创建/修改分别验父层公共校验与子类特有校验，且同一远程校验不重复。

### 7. Wrong vs Correct

```java
// Wrong：父类已有 customerCode，创建 VO 再遮蔽
class XxxMainCreateReqVO extends XxxMainBaseVO<XxxDetailCreateReqVO> {
    private String customerCode;
}

// Correct：只声明本层新增
class XxxMainCreateReqVO extends XxxMainBaseVO<XxxDetailCreateReqVO> {
    private String createSource;
}
```

```java
// Wrong：子类接管编号、校验、主子表插入（旧 handleCreate 思维）
protected String handleCreate(XxxMainDO mainDO, List<XxxDetailDO> detailList) { ... }

// Correct：每层只补本层
@Override
protected void beforeCreate(XxxCreateReqVO reqVO, XxxMainDO mainDO, List<XxxDetailDO> detailList) {
    validateBusinessFields(mainDO, detailList);
}
```
