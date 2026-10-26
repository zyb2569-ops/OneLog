# 质量规范

> 后端开发的代码质量标准。

---

## 概览

本仓库的后端代码质量主要依赖一致的框架使用方式，而不是非常重的静态规则体系。

已观察到的仓库约定：

- 复用共享框架契约：`CommonResult`、`ServiceException`、`BaseMapperX`、`BaseDO`、MapStruct convert。
- 显式保持层边界：controller 使用 VO，service 写业务逻辑，DAL 使用 DO/Mapper，API 层放 DTO/ErrorCode。
- 跨模块调用通过 `*-api` + Feign 契约完成，不直接依赖对方实现或数据库。
- 根 Maven 配置 `mom/pom.xml` 已包含 `maven-surefire-plugin`、Lombok、MapStruct 支持。
- 自动化测试在已提交代码中比较稀疏。本次扫描中，唯一明显的第一方 `src/test` 目录是 `mom/win-gateway/src/test`。

对于新增代码，比起在单个模块中发明新模式，更重要的是遵循这些已有约定。

Service 层辅助方法抽取与内联见 [方法抽象边界](../common/private-method-abstraction-guidelines.md)。

---

## 统一代码风格

### Convention: 代码保持直解、无隐藏兜底、不过度设计

**What**: 后端代码应让读者直接看出主路径、失败边界和差异点。实现应围绕真实业务契约组织入口、方法和命名；抽象只在能减少真实重复、表达稳定语义或隔离明确边界时引入。

**Why**: 代码结构比注释更能说明系统行为。主路径清晰、失败显式、抽象克制，能减少维护者在多层跳转中重建意图，也能避免把真实契约藏进补偿分支或临时结构。

**Signatures**:

```java
public Result handle(Command command)
private DomainRule buildDomainRule(Command command)
private void validateBusinessInvariant(DomainRule rule)
```

**Validation & Error Matrix**:

| 场景 | 不合格行为 | 合格处理 |
|------|------------|----------|
| 主路径和异常路径混在一起 | 读者需要从多个分支反推正常流程 | 先表达主路径，再用 guard clause 处理非法状态 |
| 两个入口语义不同但实现相似 | 为消除表面重复合并成含义模糊的方法 | 保留语义清晰的入口，复用稳定的底层构造 |
| 异常或缺失状态需要处理 | 用默认成功、空结果或静默补偿隐藏问题 | 让失败显式暴露，只有业务规则允许时才降级 |
| 注释解释了复杂实现但代码仍难读 | 依赖长注释弥补结构混乱 | 先重构命名和结构，再用短注释说明非显而易见的约束 |

**Good/Base/Bad Cases**:

- Good: 公开方法名表达业务目的，私有方法只承载稳定子步骤，失败状态以异常、错误码或明确返回结构暴露。
- Base: 两个相近入口共享一段私有条件构造，但入口仍保留各自业务语义。
- Bad: 为减少几行重复引入含义宽泛的通用方法，调用方必须读实现才能知道副作用和边界。

**Tests Required**:

- 编译检查：运行受影响模块 `mvn -pl <module> -am -DskipTests compile`。
- 行为检查：用关键路径验证主路径结果、失败暴露方式和边界条件。
- Diff 检查：确认没有新增隐藏兜底、含义模糊的过度抽象、无关格式化或靠长注释弥补的复杂结构。

**Wrong vs Correct**

#### Wrong

```java
private Result process(Command command, boolean countOnly, boolean skipValidation) {
    // 多种业务语义混在一个方法里，调用方必须理解布尔参数组合。
}
```

#### Correct

```java
public Result submit(Command command) {
    validateBusinessInvariant(command);
    return doSubmit(command);
}

public Long countVisible(Command command) {
    return doCount(command);
}
```

#### Wrong

```java
try {
    return remoteApi.load(command);
} catch (Exception ex) {
    return Result.success(Collections.emptyList());
}
```

#### Correct

```java
CommonResult<List<ItemDTO>> result = remoteApi.load(command);
if (result == null || !result.isSuccess()) {
    throw exception(REMOTE_QUERY_FAILED);
}
return result.getCheckedData();
```

---

## 禁止模式

- Controller 不要返回临时拼装的响应包，统一使用 `CommonResult`。
- Controller 不要直接调 Mapper，也不要跨模块直连数据库。
- 不要把 SQL 或 query-wrapper 构造写在 controller 里。
- 不要绕过模块 convert，到处手工拷贝字段。
- 业务校验失败不要抛笼统的运行时异常。
- 不要空 `catch`、只打日志不抛出，或用 `@Lazy` 掩盖循环依赖。
- 不要使用 `System.out.println()`。
- 不要把 API DTO、controller VO、DAL DO 混到同一层。
- 对于 `BaseMapperX + LambdaQueryWrapperX` 已能覆盖的简单单表 CRUD，不要额外写 XML mapper。
- 不要在字段声明、方法签名、泛型参数、静态调用或 `new` 表达式中直接写全类名，必须通过 `import` 引入后再使用简单类名。
- 不要在业务代码中使用 `stream().map().forEach()` 这类链式调用。改用 `for` 或增强 `for` 循环，保持代码直读。

推荐参考的项目模式示例：

- `mom/win-module-dbc/win-module-dbc-biz/src/main/java/com/win/module/dbc/controller/workstation/WorkstationController.java`
- `mom/win-module-dbc/win-module-dbc-biz/src/main/java/com/win/module/dbc/convert/workstation/WorkstationConvert.java`
- `mom/win-module-dbc/win-module-dbc-biz/src/main/java/com/win/module/dbc/dal/mysql/workstation/WorkstationMapper.java`

---

## 必须模式

- Controller 应标注 `@RestController`、`@Validated`，以及模块已在使用的 OpenAPI 注解。
- 请求体和查询对象在适用时应使用 `@Valid`。
- 更新和删除流程在修改数据前要先校验数据是否存在。
- 多行写入和导入流程应使用 `@Transactional`，但事务边界只放在 service 层，不做大而全的全链路事务包裹。
- 查询逻辑归 mapper 方法；业务编排归 service。
- 新增公开 HTTP 路径使用小写稳定片段，优先 kebab-case，并与模块既有风格保持一致。
- 新增远程调用必须能在配置层或 `RpcConfiguration` 中定位超时、重试和客户端配置。
- 新增代码优先使用构造器注入；如果所在模块已广泛使用 `@Resource`，可延续局部风格，但不得用 `@Lazy` 规避设计问题。
- Java 类型引用必须放在文件头部 `import` 区声明，正文中只保留简单类名；仅 `java.lang` 内建类型可直接使用。
- 复用已有框架工具：
  `ExcelUtils`、`ServiceExceptionUtil`、`BeanUtils`、模块 `*Convert`、`EnableDisableUtil`、`QueryWrapperUtils`
- 修 bug 或改跨层契约前，先判断是局部修复还是结构性修复；触及共享校验、权限、缓存、API、数据库、重复业务逻辑时，按结构性修复处理。
- 失败路径必须显式暴露：业务失败抛模块错误码，系统失败保留异常链路；禁止用空 catch、默认成功、静默 fallback 掩盖坏数据。

示例：

- `mom/win-module-iotgw/win-module-iotgw-biz/src/main/java/com/win/module/iotgw/controller/admin/assetparamconfig/AssetParamConfigController.java`
- `mom/win-module-iotgw/win-module-iotgw-biz/src/main/java/com/win/module/iotgw/service/assetparamconfig/AssetParamConfigServiceImpl.java`
- `mom/win-module-dbc/win-module-dbc-biz/src/main/java/com/win/module/dbc/service/workstation/WorkstationServiceImpl.java`

---

### Scenario: 后端 Debug-first 与结构性修复收口

#### 1. Scope / Trigger
- Trigger: 修复后端 bug、改共享业务规则、改 API/DB/缓存/权限/导入导出等跨层契约时。
- 风险点: 只在报错处补默认值或吞异常，会让坏数据继续向下游扩散，后续表现为更难定位的空字段、错库存、错权限或错导出。

#### 2. Signatures
- 业务失败:
  - `throw exception(ErrorCodeConstants.Xxx)`
  - `throw ServiceExceptionUtil.exception(ErrorCodeConstants.Xxx)`
- HTTP 返回:
  - `CommonResult<T>`
- 事务边界:
  - `@Transactional` 只放在 service 层写操作或批量导入入口。
- 查询边界:
  - Mapper 方法封装 `LambdaQueryWrapperX` / `QueryWrapper`，Controller 不拼查询。

#### 3. Contracts
- 输入:
  - Controller 只接收 VO；Service 可接收 VO/DO/DTO，但不能混用层模型。
  - 外部输入必须通过 `@Valid`、显式业务校验或模块既有校验工具进入业务流程。
- 输出:
  - Controller 返回 `CommonResult`。
  - 跨模块调用返回 `*-api` 定义的 DTO，不泄露 biz DO。
- 错误:
  - 可预期业务失败使用模块错误码。
  - 不可恢复系统失败保留异常，不允许伪造成成功结果。

#### 4. Validation & Error Matrix
| 场景 | 不合格行为 | 合格处理 |
|------|------------|----------|
| 上游字段为空导致下游展示异常 | 下游给默认值继续 | 追到第一个丢字段的写入/转换点并修复 |
| 调用外部或跨模块接口失败 | catch 后只打日志并返回空集合 | 让失败显式返回错误码或抛出异常，除非业务明确允许空结果 |
| 多个入口重复同一校验 | 每个入口各写一份 | 抽出单一业务校验点，入口保留阶段语义 |
| 权限/数据范围判断分散 | Controller、Service、Mapper 各自判断 | 明确唯一边界，其他层只消费结果 |
| 修复需要新增 fallback | 默认接受 fallback | 先证明 fallback 是业务规则；否则回到根因链路 |

#### 5. Good/Base/Bad Cases
- Good: 导入失败时抛出具体错误码，错误 Excel 能定位行号和字段；Service 事务回滚，无半写入数据。
- Base: 简单单表 CRUD 使用已有 `validateXxxExists` 后再 update/delete。
- Bad: `catch (Exception e) { log.error(...); return Collections.emptyList(); }` 导致调用方认为处理成功。

#### 6. Tests Required
- 目标行为: 用曾经失败的请求或数据断言错误码、字段写入、事务副作用符合预期。
- 静态检查: 后端改动至少运行受影响模块的编译或测试命令；业务模块没有测试时，说明无法自动化覆盖的原因。
- 数据检查: 涉及 DB 写入时，对比源表、中间表、目标表关键字段。
- Diff 检查: 确认没有新增空 catch、静默默认值、第二套校验或无关格式化。

#### 7. Wrong vs Correct
##### Wrong
```java
try {
    return remoteApi.getDetail(id);
} catch (Exception e) {
    log.error("get detail failed", e);
    return null;
}
```

##### Correct
```java
CommonResult<DetailRespDTO> result = remoteApi.getDetail(id);
if (result == null || !result.isSuccess()) {
    throw exception(DETAIL_REMOTE_QUERY_FAILED);
}
return result.getData();
```

---

### Convention: 模板 hook 覆盖必须承载本阶段业务规则

**What**: 覆盖模板方法时，子类方法必须在该 hook 的业务阶段内直接表达本模块规则；禁止只调用空父类方法，或只把调用转发给另一个私有方法。

**Why**: 模板方法的价值是把校验、转换、落库、事务、发布等阶段固定下来。子类覆盖如果只做空 `super.xxx()` 或单层转发，会让读者无法判断该 hook 的业务意义，也容易把前置校验错放到落库后、事务后或 MQ 后。

**Signatures**:

```java
@Override
protected void beforeCreate(RecordMainCreateReqVO createReqVO) {
    // 前置校验：失败时不得写入记录、库存事务或后续 MQ。
}
```

**Validation & Error Matrix**:

| 条件 | 期望行为 |
|------|----------|
| 父类 hook 是空实现 | 子类不要调用 `super.beforeCreate(...)` |
| hook 只包一层私有方法 | 不合规；把业务门控、空态判断和遍历写在 hook 内 |
| 多入口共用同一底层规则 | 允许抽取底层判定方法，但入口 hook 必须保留阶段语义 |
| 前置校验失败 | 抛模块既有 `ServiceException`，保持未落库状态 |

**Good/Base/Bad Cases**:

- Good: `beforeCreate` 内完成业务类型判断、明细空判断、逐条调用底层校验方法。
- Base: 简单 hook 无需覆盖，直接沿用父类模板。
- Bad: 覆盖 hook 后只写 `super.beforeCreate(reqVO); validateX(reqVO);`，而父类为空。

**Tests Required**:

- 编译检查：覆盖的方法签名必须与父类模板一致。
- 行为检查：构造前置校验失败数据，断言主表、子表、库存事务和 MQ 均未产生。
- 代码评审：确认 hook 名称表达的阶段与校验实际发生的位置一致。

**Wrong vs Correct**

#### Wrong

```java
@Override
protected void beforeCreate(RecordMainCreateReqVO createReqVO) {
    super.beforeCreate(createReqVO);
    validateBeforeCreate(createReqVO);
}
```

#### Correct

```java
@Override
protected void beforeCreate(RecordMainCreateReqVO createReqVO) {
    if (CollectionUtil.isEmpty(createReqVO.getSubList())) {
        return;
    }
    for (RecordDetailCreateReqVO detailVO : createReqVO.getSubList()) {
        validatePackageNotOccupied(detailVO);
    }
}
```

---

### Convention: WMS Service 校验优先使用具体 VO/DO 类型

**What**: WMS Service 内的业务校验方法优先使用具体的 `*CreateReqVO`、`*DO`、`*RespVO` 参数和显式字段访问。禁止为了少写几行重复代码，把主流程改成 `Function<T, String>`、过度泛型或反射式字段读取。

**Why**: WMS 业务字段依赖来源、目标、库存状态、批次、包装等上下文。函数式泛型参数会把字段契约拆散到调用点，读者需要来回跳转才能确认校验对象和字段来源，也不符合当前仓库 Service 层的主流写法。必要复用应下沉到“单个业务判断”或“批量查询”辅助方法，而不是抽象掉入口对象。

**Validation & Error Matrix**:

| 条件 | 期望行为 |
|------|----------|
| 入口是模板 hook | hook 内保留具体 VO 类型、业务门控、空态判断和循环 |
| 入口是直接操作或落库后续流程 | 使用具体 DO 类型的专用校验方法 |
| 两个入口字段相同 | 可抽取底层业务判断方法，参数使用明确字段值，如 `itemCode`、`fromLocationCode`、`toPackageNumber` |
| 为复用引入 `Function<T, String>` | 不合规；改为具体类型方法或明确字段值辅助方法 |
| WMS 校验依赖管理精度 | 复用链路既有 `jobUtils.getManageMode(...)` 等主流工具，不要新写局部查询口径 |

**Good/Base/Bad Cases**:

- Good: `beforeCreate(InventorymoveRecordMainCreateReqVO reqVO)` 内遍历 `InventorymoveRecordDetailCreateReqVO`，直接读取 `detail.getToPackageNumber()`。
- Base: DO 路径单独提供 `validateXxx(List<InventorymoveRecordDetailDO> detailList)`，内部仍使用显式 getter。
- Bad: `validateXxx(List<T> list, Function<T, String> packageGetter, Function<T, String> locationGetter)`。

**Wrong vs Correct**

#### Wrong

```java
private <T> void validatePackage(List<T> detailList, Function<T, String> packageGetter) {
    for (T detail : detailList) {
        String packageNumber = packageGetter.apply(detail);
    }
}
```

#### Correct

```java
private void validatePackage(List<RecordDetailDO> detailList) {
    for (RecordDetailDO detail : detailList) {
        String packageNumber = detail.getPackageNumber();
    }
}
```

---

### Convention: 自定义方法调用点必须说明调用目的

**What**: 当本轮新增自定义方法并在业务代码中调用时，每一个新增调用点上方都必须配套单行注释，说明这次调用要完成什么业务目的。既有自定义方法的新调用点同样适用；条件判断、批量收集、落库前校验、状态转换这类关键步骤，优先把方法调用拆成带语义的局部变量或独立语句，再在上方写注释。

**Why**: 新增自定义方法往往承载刚抽出的业务规则或副作用，只看方法名并不能可靠推断它为什么在这里被调用。调用点补上目的说明后，读者能快速区分“条件判断”“数据收集”“最终校验”“副作用执行”，也更容易识别调用顺序是否错误。

**Validation & Error Matrix**:

| 场景 | 期望行为 |
|------|----------|
| 本轮新增私有/保护/公共自定义方法并调用 | 每个新增调用点上方都有单行中文注释说明业务目的 |
| 既有自定义方法在新业务流程中新增调用 | 按新增调用点处理，补充单行目的注释 |
| 调用点只有方法名、没有目的注释 | 不合规；补充说明“为什么此处需要调用” |
| 注释只复述方法名或实现动作 | 不合规；改为说明业务规则、持久化目的、状态推进或副作用边界 |
| 纯 getter、setter、MapStruct convert 或框架工具调用 | 可省略；但一旦承担业务决策、落库前补齐或状态转换，仍需注释 |

**Good/Base/Bad Cases**:

- Good: 在 `validateScannedPackageNotInBalance(...)` 前写明“直接操作在落库前复用同一条包装占用校验”。
- Base: 简单纯 getter / setter 链路可省略，但新增自定义方法参与关键业务步骤时必须说明。
- Bad: 只有 `someCustomMethod();`，没有上下文说明。

**Tests Required**:

- Diff 检查：搜索本轮新增方法名，逐个确认新增调用点上方存在单行中文目的注释。
- Review 检查：注释必须解释业务目的或状态边界，不能只把方法名翻译成中文。

**Wrong vs Correct**

#### Wrong

```java
validatePackageNumbersNotInBalance(toPackageNumberSet);
```

#### Correct

```java
// 批量校验目标包装号是否已经占用，确保提交前拦住重复包装。
validatePackageNumbersNotInBalance(toPackageNumberSet);
```

---

### Convention: Java 类型必须通过 import 引入

**What**: 后端 Java 代码中，非 `java.lang` 类型必须通过文件头部 `import` 或 `import static` 引入，正文禁止直接写全限定类名。

**Why**: 全类名散落在方法体和字段定义中，会放大噪音、削弱可读性，也会让 review 难以识别真实依赖边界。项目现有代码普遍采用集中 `import` 的写法，新代码必须保持一致，避免形成两套风格。

**Example**:

```java
import com.win.framework.common.pojo.CommonResult;
import com.win.module.wms.controller.transaction.vo.TransactionCreateReqVO;
import com.win.module.wms.dal.dataobject.transaction.TransactionDO;

public CommonResult<Void> create(TransactionCreateReqVO reqVO) {
    TransactionDO transaction = new TransactionDO();
    return CommonResult.success(null);
}
```

**Validation**:

| 场景 | 期望 | 处理 |
|------|------|------|
| 使用第三方或项目内类型 | 文件头存在对应 `import` | 合规 |
| 使用静态工具方法/常量 | 使用 `import static` | 合规 |
| 使用 `java.lang.String`、`Long` 等内建类型 | 可直接写简单类名 | 合规 |
| 在方法体里写 `com.win...SomeType` | 不合规 | 重构为 `import` + 简单类名 |
| 为规避同名冲突保留全类名 | 不合规 | 调整命名、拆分职责，或仅在极少数冲突点重新组织代码后再提交 |

**Tests Required**:

- 代码评审时检查新增/修改的 Java 文件，确认正文不存在业务类、框架类、JDK 非 `java.lang` 类型的全类名引用。
- 如仓库已启用格式化或静态检查规则，提交前应保证不会因 import 未使用、顺序错误而失败。

**Wrong vs Correct**

#### Wrong

```java
import com.win.framework.common.pojo.CommonResult;
import com.win.module.wms.controller.transaction.vo.TransactionCreateReqVO;
import com.win.module.wms.dal.dataobject.transaction.TransactionDO;

public CommonResult<Void> create(TransactionCreateReqVO createReqVO) {
    TransactionDO data = new TransactionDO();
    return CommonResult.success(null);
}
```

#### Correct

```java
import com.win.framework.common.pojo.CommonResult;
import com.win.module.wms.controller.transaction.vo.TransactionCreateReqVO;
import com.win.module.wms.dal.dataobject.transaction.TransactionDO;

public CommonResult<Void> create(TransactionCreateReqVO createReqVO) {
    TransactionDO data = new TransactionDO();
    return CommonResult.success(null);
}
```

---

### Convention: 批量校验禁止循环查库

**What**: 对列表明细做存在性、占用性、重复性校验时，禁止在 `for` 循环中逐条调用 Mapper 查询。必须先收集候选业务键，再用 `in(...)` 或批量接口一次性查询，最后在内存中判断失败项。

**Why**: 循环查库会把一次提交放大成 N 次数据库往返，导入、任务执行、直接创建等批量入口会随明细行数线性退化。批量查询还能一次性返回所有失败键，错误信息更完整。

**Signatures**:

```java
private void validatePackageNumbersNotInBalance(Set<String> packageNumberSet) {
    QueryWrapper<BalanceDO> queryWrapper = new QueryWrapper<>();
    queryWrapper.in("package_number", packageNumberSet);
    List<BalanceDO> balanceDOList = balanceMapper.selectList(queryWrapper);
}
```

**Validation & Error Matrix**:

| 条件 | 期望行为 |
|------|----------|
| 明细列表为空 | 直接返回，不查库 |
| 候选业务键为空 | 直接返回，不查库 |
| 多行使用相同物料/库位派生管理精度 | 请求内缓存派生结果，避免重复解析 |
| 批量查询返回占用项 | 汇总占用键后抛模块既有 `ServiceException` |

**Good/Base/Bad Cases**:

- Good: 先收集 `Set<String> packageNumberSet`，一次 `selectList(in package_number)`，再组装错误信息。
- Base: 单条详情接口可单查，但要确认入口不会被导入或批量提交复用。
- Bad: 在 `for (detail : subList)` 内反复 `selectCount` 或 `selectOne`。

**Tests Required**:

- 行为检查：多条明细中任一包装号已存在库存余额时，断言提交被拒绝且错误信息包含占用包装号。
- 性能检查：评审新增批量校验时确认 Mapper 查询次数不随明细行数增长。
- 边界检查：空明细、空候选键不访问数据库。

**Wrong vs Correct**

#### Wrong

```java
for (RecordDetailCreateReqVO detailVO : createReqVO.getSubList()) {
    QueryWrapper<BalanceDO> queryWrapper = new QueryWrapper<>();
    queryWrapper.eq("package_number", detailVO.getToPackageNumber());
    if (balanceMapper.selectCount(queryWrapper) > 0) {
        throw exception(BALANCE_EXCEPTION);
    }
}
```

#### Correct

```java
Set<String> packageNumberSet = createReqVO.getSubList().stream()
        .map(RecordDetailCreateReqVO::getToPackageNumber)
        .filter(StrUtil::isNotBlank)
        .collect(Collectors.toSet());

QueryWrapper<BalanceDO> queryWrapper = new QueryWrapper<>();
queryWrapper.in("package_number", packageNumberSet);
List<BalanceDO> balanceDOList = balanceMapper.selectList(queryWrapper);
```

---

## 测试要求

当前项目的现实情况：

- 根工程已配置 Maven test 支持。
- 业务模块的自动化测试并不常见。
- 对 CRUD 较重的模块，手工验证仍是默认质量门。

后端改动的最低验证要求：

- 验证受影响接口的契约，尤其是 create/update/delete/page/export/import 流程。
- 修改 controller 或 service 时，验证权限、参数校验、错误码行为。
- 如果改动的是 framework 或 gateway，并且已有测试存在或补测试成本合理，应优先新增或扩展测试，而不是只依赖手工检查。

相关参考：

- `mom/pom.xml`
- `mom/win-gateway/src/test/java/com/win/ProjectReactor.java`

---

## Code Review 检查项

- 代码是否放在正确的模块和包中（`api`、`biz`、`framework`）？
- 如果模块注入了跨模块的 `*-api` 接口，所需的 Feign 客户端配置是否已在本地启用或由共享自动配置提供？
- Controller 是否返回 `CommonResult`，并使用了正确的 VO 类型？
- 业务失败是否通过模块 `ErrorCodeConstants` 和 `ServiceExceptionUtil` 表达？
- 查询条件是否封装在 mapper 方法中，并使用 `*IfPresent` wrapper？
- 批量/导入流程是否标注了 `@Transactional`？
- 请求/响应转换是否委托给 `*Convert` 或共享 bean 映射工具？
- 改动是否避免了重复日志，并遵守现有集中式错误/日志链路？
- Java 文件正文是否出现了可替换为 `import` 的全类名引用？
