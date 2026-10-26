# 方法抽象边界（禁止无意义薄包装）

> 约束业务编排层辅助方法的抽取与内联，避免单行转发和跨类复制。

---

## 概览

本规范适用于新增或修改 **private / protected 辅助方法** 的场景，包括但不限于：

- 后端：`Service`、`Manager`、模板子类 hook 周边逻辑
- 前端：`composable` 内函数、`store` action 周边、`setup` 中的局部 helper

核心原则：**调用方应直接表达业务步骤；辅助方法只在承载独立逻辑、稳定复用或生命周期扩展点时存在。**

相关规范：

- [代码复用思维指南](./code-reuse-thinking-guide.md)
- [后端质量规范 · 代码保持直解](../backend/quality-guidelines.md)
- [后端质量规范 · 模板 hook 覆盖](../backend/quality-guidelines.md)（模板子类适用）

模块若有迁移期「兼容包装」约定，从其专项规范读取例外条款，本规范不重复定义。

---

## Convention: 禁止无意义薄包装

**What**: 不得新增「仅转发、无分支、无额外语义」的 private/protected 辅助方法。调用方应直接使用已有共享能力：模块 util、framework 工具、`*Support`、`*Api`、父类模板 hook。

**Why**: 薄包装增加跳转层却不表达业务；跨类复制后 bug 无法传播；模型易批量生成 `validatorXxx` / `checkXxx` 单行转发，形成治理债务。

---

## 判定流程（写辅助方法前必走）

按顺序回答，命中即停止：

| 步骤 | 问题 | 结论 |
|------|------|------|
| 1 | 目标能力是否已在共享层？（util / framework / Support / Api / 父类） | **直调**，禁止再包一层 |
| 2 | 方法名是否是生命周期扩展点？（`after*` / `before*` + 业务动词，与落库/推送/提交等阶段并列） | **保留 HOOK**，允许单行 |
| 3 | 是否 ≥3 个类/文件有相同实现？ | 抽到模块 util / Support，**禁止复制** |
| 4 | 当前文件内仅 1 处调用，且方法体为单行/无分支转发？ | **内联到调用方**，禁止抽方法 |
| 5 | 当前文件内 ≥2 处调用，或方法体含分支、组装、多步？ | **允许** private/protected，须承载真实逻辑 |

---

## 禁止模式

| 模式 | 典型形态 | 处理 |
|------|----------|------|
| **util 再包装** | `validateType(t, cfg) { xxxUtils.validateType(t, cfg); }` | 内联为直调 util |
| **Api 单行再包装** | `loadEntity(id) { return entityApi.get(id).getCheckedData(); }` | 内联；≥3 处重复则抽 Support |
| **薄重载链** | `toKey(A) → toKey(B) → 多参数实现` | 删外层，保留核心签名 |
| **假校验占位** | `validateXxxImport` 空体、仅 `return message` | **禁止新增**；存量占位单独任务治理 |
| **hook 内单层转发** | `beforeCreate` 内只调 `validateBeforeCreate` 且无其它逻辑 | 不合规；业务门控写在 hook 内 |
| **前端薄转发** | `const checkCode = (c) => codeValidator(c)` 且仅一处使用 | 内联或直接用已有 validator |

---

## 允许例外

| 类型 | 说明 |
|------|------|
| **HOOK** | 模板/流程生命周期锚点，命名即扩展语义（如 `afterSendExternal`、`beforePersist`） |
| **UTIL** | 同文件 ≥2 处调用，或含不可内联的分支、组装、多步逻辑 |
| **兼容包装** | 仅迁移期临时保留：须有真实外部调用方 + 删除条件；**新代码不得再调用**（按模块专项规范执行） |
| **遗留特殊口径** | 与共享 Support 行为不同的历史方法：禁止在新代码模仿；新代码默认用共享层 |

---

## 模块既有共享层（写前先搜）

新增校验、查询或格式化时，**先搜索**是否已有 util / Support / framework 工具，禁止在业务类内再写一层转发。

| 动作 | 做法 |
|------|------|
| 写新 private `validator*` / `check*` | 先 `rg` 同类逻辑与 util 名 |
| 发现 2 处相同 | 先内联或局部复用；满 3 处再抽共享 |
| 共享层不存在且 ≥3 处重复 | 在模块 `util` 或合适包下新增 `*Support` / util |
| 共享层已存在 | 注入并直调，禁止 Service 内再包装 |

共享组件的落点遵循各模块目录约定，不在本规范维护模块清单。

---

## Validation & Error Matrix

| 场景 | 不合格行为 | 合格处理 |
|------|------------|----------|
| 已有 util | 新增 private 再调 util | 调用方直调 util |
| 跨类重复查询 | 多个 Service 各写 4 行 Api 调用 | 注入模块 `*ValidationSupport` |
| 单调用 | 抽 private 只为「命名好看」 | 内联到调用点 |
| 跨类 2 处相同 | 立即复制到第二个类 | 先内联；满 3 类再抽 Support |
| 生命周期后置 | 删除 `afterXxx` 改为 anonymous inline | 保留 HOOK 名称，便于检索扩展点 |
| 特殊业务口径 | 用通用 Support 覆盖遗留 getList 逻辑 | 保留类内方法，方法体须有独立分支/规则 |

---

## Good / Base / Bad Cases

- **Good**: 校验循环内直调 `xxxUtils.validate(...)`，无中间 private。
- **Good**: 多 Service 共用 `entityValidationSupport.requireByCode(code)`。
- **Good**: `afterNotifyExternal` 内调用 helper，方法名表达推送阶段。
- **Base**: 同文件 2 处调用同一 5 行组装逻辑，抽 private 辅助方法。
- **Bad**: `private void validateType(...) { xxxUtils.validateType(...); }` 且仅 1 处调用。
- **Bad**: 复制 Support 已有逻辑到新的 `validatorEntity`（无额外规则时）。
- **Bad**: `validateXxxImport` 空实现占位，无业务与测试计划。

---

## Tests Required

- **Diff 检查**：新增 private/protected 方法是否通过判定流程 1–5。
- **搜索检查**：对新增 `validator` / `check` / `validate` 私有方法做 spot check（`rg "private .* (validator|check|validate)"`）。
- **编译检查**：后端改动运行受影响模块 `mvn -pl <module> -am -DskipTests compile`；前端改动运行类型检查或 lint。
- **Review 检查**：后端新增 UTIL 方法时，调用点目的注释见 [后端质量规范 · 自定义方法调用点](../backend/quality-guidelines.md)。

---

## Wrong vs Correct

### util 薄包装

#### Wrong

```java
private void validateLocationType(String locationCode, ConfigDTO config) {
    locationUtils.validateInFromType(locationCode, config);
}

validateLocationType(detail.getLocationCode(), config);
```

#### Correct

```java
locationUtils.validateInFromType(detail.getLocationCode(), config);
```

### 跨类复制 vs 共享 Support

#### Wrong

```java
// 多个 Service 各写一份
private EntityDTO loadEntity(String code) {
    EntityQueryDTO req = new EntityQueryDTO();
    req.setCode(code);
    return entityApi.getOne(req).getCheckedData();
}
```

#### Correct

```java
@Resource
private EntityValidationSupport entityValidationSupport;

EntityDTO entity = entityValidationSupport.getByCode(code);
```

### HOOK 保留 vs 无意义转发

#### Wrong（hook 内仅转发，无阶段语义）

```java
@Override
protected void beforeCreate(CreateReqVO createReqVO) {
    super.beforeCreate(createReqVO);
    validateBeforeCreate(createReqVO);
}
```

#### Correct（生命周期锚点）

```java
private void afterNotifyExternal(List<EventDTO> events) {
    externalNotifyHelper.send(events, resolveInterfaceName(businessType), "XxxService.afterNotifyExternal");
}
```

### 类内特殊逻辑保留（非薄包装）

#### Correct（有独立规则，≥2 处调用）

```java
private EntityDTO loadEntityWithLegacyRules(String code) {
    String normalized = StringUtils.trimToEmpty(code);
    if (StringUtils.isBlank(normalized)) {
        throw exception(ENTITY_NOT_EXISTS, normalized);
    }
    // getList + 多活选择 + 模块特有口径 ...
    return selected;
}
```

> 说明：与共享 Support 口径不同的遗留方法禁止在新类模仿；新代码默认用 Support。

### 前端（composable 内）

#### Wrong

```typescript
const validateCode = (code: string) => codeRules.validate(code)
// 仅一处调用 validateCode(form.code)
```

#### Correct

```typescript
codeRules.validate(form.code)
```

---

## 提交前自检（3 条）

1. 新辅助方法是否只有一行且只调一个已有 util/bean/composable？→ **删掉，内联**。
2. 是否复制了其他类/文件已有的短校验逻辑？→ **用 Support 或直调 Api/util**。
3. 方法名是否是 `after*` / `before*` 生命周期步骤且有阶段语义？→ **可保留 HOOK**。

---

## Code Review 检查项

- [ ] 新增 private/protected 方法是否通过判定流程？
- [ ] 是否对已有 util / Support / framework 工具做了再包装？
- [ ] 跨类重复是否达到 3 处仍未抽取？
- [ ] 是否新增了空体 `validate*` 或 todo 占位？
- [ ] HOOK 内是否只有单层无意义转发？
- [ ] 内联删除辅助方法时，是否同步删除配套注释与 Javadoc 中的旧方法名？
