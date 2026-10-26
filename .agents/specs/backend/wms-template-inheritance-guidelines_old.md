# WMS 模板继承规范

> 适用于 `win-module-wms` 中具有 `request / job / record` 主子表链路的业务模块，约束 Controller、Service、Mapper 如何复用 `core` 父类，并以库存移动模块的收敛结果作为基准。

---

## 场景：WMS 业务模块模板化改造

### 1. Scope / Trigger

- 新增或重构包含 `request`、`job`、`record` 任一完整主子表链路的 WMS 业务。
- Controller 或 Service 已继承 `BaseRequest*`、`BaseJob*`、`BaseRecord*`，但仍重写整套公开流程。
- 多个前端页面共用同一组数据库表，只通过 `businessType` 区分业务。
- Detail 列表需要同时使用明细表条件和主表条件。
- 清理历史 `doXxx`、同名转发方法、重复 Mapper 查询和兼容接口。

不适用：

- 没有 `request / job / record` 语义的普通单表 CRUD，不强制继承 WMS 模板父类。
- 只有独立业务表、没有对应主子生命周期的功能，不为了形式统一而套用模板。

### 2. Signatures

标准公开入口由父类提供：

```java
// Controller
POST   /create
PUT    /update
DELETE /delete
GET    /get
GET    /page
POST   /senior
PUT    /submit
PUT    /agree
PUT    /refused
PUT    /handle
PUT    /close
PUT    /reAdd
PUT    /execute

// Service
String create(MainCreateReqVO reqVO);
Integer update(MainUpdateReqVO reqVO);
Integer delete(Long id);
MainRespVO getById(Long id);
PageResult<MainRespVO> getPage(MainPageReqVO pageVO);
PageResult<MainRespVO> getSenior(CustomConditions conditions);
```

子类允许覆盖的签名主要是扩展点：

```java
protected void beforeCreate(...);
protected void afterCreate(...);
protected void beforeUpdate(...);
protected void afterUpdate(...);
protected void beforeSubmit(...);
protected void afterSubmit(...);
protected void beforeHandle(...);
protected void afterHandle(...);
protected void handleJob(...);
protected String afterExecute(...);
protected void publish(...);
protected void afterGetPage(...);
protected void afterGetSenior(...);
protected void applyBusinessPageFilters(...);
```

### 3. Contracts

#### 3.1 总体职责

- 父类负责完整且稳定的公开生命周期：参数转换、校验编排、主子表落库、状态流转、编号生成、趋势记录和公共返回结构。
- 子类只保留本业务字段校验、业务字段补齐和副作用扩展。
- 差异优先落在已有 `before / after / publish / generateTransaction` 等职责明确的 hook。
- 现有 hook 无法承接差异时，先给父类增加一个职责单一的窄 hook，再删除子类整段公开流程重写。
- 单次调用、只有一个直接判断且没有多个真实覆盖场景的方法不得包装成 `should*` hook；判断直接保留在生命周期方法中。特殊链路优先覆盖已有 lifecycle/hook，不用 `return false` 再另写一套平行流程。
- `beforeCreate / beforeUpdate` 已经是创建和修改校验入口，不得再增加 `validateMainMethod -> validateMainAfter` 这类空转 hook 链。业务主表校验直接写入对应 before hook；多项校验需要复用时可提取语义明确的 `private validateXxxFields`，但不能再暴露一层空 protected hook。
- 同一生命周期不得同时保留“旧签名 hook + 新签名 hook”，再由新签名转发旧签名。统一保留信息完整的签名（例如同时携带 old/new DO），子类直接覆盖该签名。
- Controller 不增加 `doCreate/doUpdate/doGetPage/doGetSenior` 等仅转发 Service 的 protected 方法；公开接口直接调用 Service。确有额外业务语义时迁移到 Service hook，不把 Controller 转发方法当扩展点。
- Base Service 的公开 `create/update/delete/submit/agree/handle/execute` 就是唯一模板主流程，不得再包装 `handleCreate/handleUpdate/handleDelete/handleJob/saveDO/updateDO/deleteDO/*Lifecycle/shouldGenerate*` 等中间方法。固定的校验、编号、状态机、主子表持久化、趋势和上下游生成直接编排在公开主流程中；业务层只能使用同名操作的 `beforeXxx/afterXxx`。方向层必须实现的预计库存、库存事务等步骤使用业务语义明确的方法名，不得使用笼统的 `handleXxx`。

#### 按业务链逐个收敛

- 每轮改造只允许修改 `core Base` 和当前明确指定的业务链，不得为了消除编译错误批量修改其他业务。
- 共享 Base 契约调整后，先完成当前业务的 Request/Job/Record Main/Detail 整条链迁移，再进入下一业务。
- 业务迁移顺序固定为：先 Main Service 公开流程与 hook，再 Detail Service，再 Mapper 查询条件，最后 Controller、VO 和 DO 属性边界。
- 在子类迁移完成前，不得仅删除 `@Override` 使旧 `handleXxx` 变成无人调用的死方法。必须把逻辑分别迁入 `beforeXxx/afterXxx`，然后删除整个旧方法。
- Base 方法最终删除前，必须确认当前业务已无 override、`super.handleXxx(...)` 和直接调用。

| 阶段 | 允许改动 | 禁止行为 |
|---|---|---|
| Base 契约确认 | `core` 与当前业务 | 全仓批量删 `@Override` |
| 当前业务迁移 | 当前业务六类对象 | 顺手修改其他业务 |
| 编译验证 | Base + 当前业务导致的错误 | 保留死方法或新增兼容包装 |

#### 废弃能力必删规则

- WMS 业务代码不再使用 DBC 开关决定主流程。每个业务收敛时必须删除 `SwitchApi`、`switchApi`、`selectSwitchExist`、开关编码、开关分支及为分支服务的临时变量。删除开关后直接保留已确认的唯一业务行为。
- WMS 业务不再保留 AGV 专用能力。每个业务收敛时必须删除 AGV 专用 Controller 路由、VO/DTO、Service 方法、Mapper/XML、异常码、枚举分支、接口日志和只为 AGV 服务的依赖。
- Service 公开写操作必须由 `@Transactional` 覆盖，包括标准增删改、状态流转、上下游生成、导入、标签生成和包装信息回写。纯查询、分页、导出和模板下载不加事务。
- 禁止用“暂时保留但不再调用”代替删除；禁止保留废弃路由、死方法或兼容 VO。
- 业务完成检查必须包含：
  - `rg -i "agv" <当前业务范围>` 无结果。
  - `rg "SwitchApi|switchApi|selectSwitchExist" <当前业务范围>` 无结果。
- 不允许为了少改文件，在子类长期保留一套与父类平行的完整生命周期。

#### 3.1.1 逐层属性查询与校验契约

##### 四项逐层职责契约

继承链中的每一层都必须形成完整、封闭的职责单元，而不是只继承字段：

| 本层内容 | 本层必须提供的能力 | 下一层如何扩展 |
|---|---|---|
| DO / VO 新增属性 | 只声明本层首次引入的属性 | 直接继承，不得重复声明 |
| 普通分页 / 高级查询 | Mapper 封装本层属性对应的查询条件 | 调用父层查询能力后，仅追加本层条件 |
| 创建 / 修改校验 | Service 封装本层属性的必填、合法性、关联数据校验和默认值 | 调用父层校验后，仅追加本层校验 |
| 生命周期差异 | 使用 `convert* / before* / after* / should* / resolve*` hook | 不覆盖父类完整公开流程和统一持久化步骤 |

强制执行顺序：

1. `convert*`：VO 转 DO，并补齐本层必须在校验、落库前存在的派生字段；不执行插库和外部副作用。
2. `beforeCreate / beforeUpdate`：执行本层新增属性校验、跨字段校验和落库前准备；不得复制父层校验。
3. 父类 `handleCreate / handleUpdate`：统一执行完整校验编排、编号、主子表持久化、并发控制等公共骨架；业务子类原则上不得覆盖。
4. `afterCreate / afterUpdate`：执行必须在落库成功后进行的生成任务、事务、预期清理、MQ、外部接口等联动。
5. `publish / generateTransaction / after*Lifecycle`：已有专用 hook 能表达时，优先使用专用 hook，避免把所有副作用堆入一个 `afterCreate`。

父层新增一个属性时，必须同步检查并在父层补齐：DO、VO、普通分页、高级查询、创建校验、修改校验和必要的转换/默认值。业务层新增属性时执行同一规则，但只能修改业务层自己的 Mapper/Service hook。任何一层都不得绕过上一层后重新实现整套逻辑。

```java
// Wrong：子类接管编号、校验和主子表插入
@Override
protected String handleCreate(XxxMainDO mainDO, List<XxxDetailDO> detailList) {
    validateXxx(mainDO, detailList);
    mainMapper.insert(mainDO);
    detailMapper.insertBatch(detailList);
    return mainDO.getNumber();
}

// Correct：每层只补本层属性和行为
@Override
protected void beforeCreate(XxxCreateReqVO reqVO, XxxMainDO mainDO, List<XxxDetailDO> detailList) {
    validateBusinessFields(mainDO, detailList);
    fillBusinessFieldsBeforeSave(mainDO, detailList);
}

@Override
protected void afterCreate(XxxCreateReqVO reqVO, XxxMainDO mainDO, List<XxxDetailDO> detailList) {
    createBusinessFollowUp(mainDO, detailList);
}
```

禁止把落库前必须保存的字段放到 `afterCreate`；也禁止在 `beforeCreate` 中提前插库。无法归入 before/after 的差异，先检查现有 `convert* / validate*After / beforeValidate* / publish / generateTransaction / should* / resolve*`，只有多个业务共同需要且确属父层职责时才增加窄 hook。

##### 属性唯一声明契约

- 同一继承链中，一个属性只能在首次引入它的层级声明一次；任何子类 VO、DO 都不得重新声明父类已有的同名属性。
- 该约束适用于 `BaseVO / CreateReqVO / UpdateReqVO / PageReqVO / RespVO / DO`。每层只声明、查询、校验本层新增的属性。
- 禁止为了必填注解、Swagger 描述、序列化配置或页面兼容而使用字段遮蔽。创建与修改的差异应使用校验分组、类级校验、`beforeCreate / beforeUpdate` 或业务校验 hook 表达。
- 历史参数兼容只能保留“不同名”的兼容字段，并在 Mapper 或 Service 边界显式映射到标准属性。
- 删除重复字段后，必须静态检查 BeanUtils、MapStruct、Jackson、MyBatis、普通分页、高级查询、导入导出是否仍通过继承 getter/setter 获得相同行为。

```java
// Wrong：父类已经声明 customerCode，创建 VO 再次遮蔽
class XxxMainCreateReqVO extends XxxMainBaseVO<XxxDetailCreateReqVO> {
    private String customerCode;
}

// Correct：子类只声明本层真正新增的属性
class XxxMainCreateReqVO extends XxxMainBaseVO<XxxDetailCreateReqVO> {
    private String createSource;
}
```

校验矩阵：

| 场景 | 正确行为 | 禁止行为 |
|------|----------|----------|
| 父 VO/DO 已有字段 | 子类直接继承 getter/setter | 子类重新声明同名字段 |
| 创建与修改必填规则不同 | 使用分组或对应 hook | 在 Create/Update VO 中复制字段只为改注解 |
| 历史页面参数名称不同 | 保留不同名兼容字段并显式映射 | 用同名字段遮蔽父属性 |

静态检查至少覆盖：父层字段在创建、修改、普通分页和高级查询中各只有一个声明来源；子类只包含本层业务特有字段；属性复制和序列化仍能访问继承属性。

模板继承不仅复用字段定义，还必须复用字段对应的查询和校验行为。每一层只负责自己声明的属性：

| 层级 | 查询职责 | 创建/修改职责 |
|------|----------|---------------|
| `Base*VO / Base*DO` | 父 Mapper 将本层公共属性加入普通分页和高级查询 | 父 Service 校验并补齐本层公共属性 |
| 业务 `Xxx*VO / Xxx*DO` | 子 Mapper 只追加业务新增属性的查询条件 | 子 Service 只追加业务新增属性的校验和赋值 |
| 页面/API | 显式传递需要过滤的字段 | 显式传递创建、修改所需字段，不依赖子类猜测默认值 |

父类公共属性增加或调整后，必须同时检查以下两个行为入口：

```java
// Mapper：父层字段统一进入基础查询条件
default void applyBasePageFilters(MPJLambdaWrapperX<DetailDO> wrapper, PageReqVO reqVO) {
    wrapper.eqIfPresent(DetailDO::getItemCode, reqVO.getItemCode());
    wrapper.eqIfPresent(DetailDO::getMasterId, reqVO.getMasterId());
}

// Service：父层字段统一完成公共校验与基础信息补齐
protected void validateDetailMethod(DetailVO reqVO, DetailDO detailDO) {
    validateBaseRequiredFields(detailDO);
    fillItemBasicFields(detailDO);
    validateBaseBusinessRules(detailDO);
}
```

子类标准写法：

```java
@Override
default void applyBusinessPageFilters(MPJLambdaWrapperX<XxxDetailDO> wrapper, XxxDetailPageReqVO reqVO) {
    wrapper.eqIfPresent(XxxDetailDO::getBusinessDetail, reqVO.getBusinessDetail());
}

@Override
protected void beforeCreate(XxxCreateReqVO reqVO, XxxMainDO mainDO, List<XxxDetailDO> details) {
    for (XxxDetailDO detailDO : details) {
        validateBusinessDetail(detailDO.getBusinessDetail());
    }
}
```

强制约束：

1. 父类已有属性不得在多个子 Mapper 重复写相同查询条件。
2. 父类已有校验不得在子 Service 再执行一次；远程物料、库位、库存和业务类型查询尤其不得重复。
3. 子类新增字段必须同时判断是否需要普通分页条件、高级查询字段映射、创建校验和修改校验。
4. 创建和修改默认复用同一套字段规则；仅创建或仅修改适用的规则使用 `beforeCreate / beforeUpdate` 单独表达。
5. 主表字段用于明细列表过滤时，使用参数化 JOIN 或公共主表条件能力，不拼接请求参数形成 `inSql`。
6. 父层新增字段后，应优先补父 Mapper/父 Service，使所有子类自动获得行为；禁止逐业务复制修补。

校验矩阵：

| 场景 | 期望行为 | 不合规表现 |
|------|----------|------------|
| 父类公共字段出现在 PageReqVO | 父 Mapper 自动应用条件 | 只有部分业务能过滤 |
| 子类新增业务字段 | 子 Mapper 增加条件 | 修改父 Mapper写死具体业务字段 |
| 父类公共必填字段创建/修改 | 父 Service 统一校验 | 每个子 Service 各写一遍 |
| 子类新增必填字段创建/修改 | 子 hook 校验 | 重写完整 `create/update` |
| 明细按主表字段过滤 | 参数化 JOIN/公共主表过滤 | 字符串拼接 `inSql` |

最低测试要求：

- 父层每个公共查询字段至少验证普通分页与高级查询各一次。
- 子类新增字段至少验证“传值生效、缺失不误过滤、非法值按业务错误码失败”。
- 创建和修改分别验证父层公共校验与子类特有校验均生效，且同一远程/数据库校验不重复执行。
- 检查 Customerreturn、Inventorymove 等基准业务，确认子类只保留自身新增字段的 `applyBusinessPageFilters` 和校验 hook。

#### 3.1.2 三层继承、六类对象与上下游生命周期契约

WMS 模板必须同时区分两个维度，禁止混为一谈：

1. **继承层级**决定属性、查询和校验归谁负责。
2. **业务对象类型**决定业务操作、查询展示和上下游单据生成归谁负责。

##### 三层继承模型

| 层级 | 定位 | 属性职责 | Mapper 职责 | Service 职责 |
|---|---|---|---|---|
| Base 层 | Request / Job / Record 的最小公共模型 | 只声明所有方向、所有业务都共有的属性 | 封装 Base 属性的普通分页、高级查询和主表关联条件 | 校验、转换、补齐 Base 属性，编排公共生命周期 |
| 单向/双向层 | 库存方向模型；数据属性主要落在 Detail，Main Service 可承接方向性生命周期 | 只声明单向或双向 Detail 首次引入的属性 | 追加本方向 Detail 属性的查询条件 | 校验来源/目标方向、库位、库存状态，并封装 Request→Job、Job→Record 的方向性转换和事务行为 |
| 具体业务层 | Customerreturn、Inventorymove 等业务模型 | 只声明业务首次引入的属性 | 只追加业务属性条件和确有必要的特殊 JOIN/权限 | 只处理业务属性校验、转换以及 before/after 副作用 |

三层中的每一层都必须闭环完成“属性声明、查询条件、创建校验、修改校验、转换/默认值”。子层只能在父层结果上追加本层行为，不能重新实现父层已有行为。

Main VO、Main DO、Main Mapper 不按单向/双向重复建立属性模型；Request Detail、Job Detail、Record Detail 根据库存方向进入单向或双向数据层。Main Service 允许存在 `BaseUnidirectional*MainService / BaseBidirectional*MainService` 中间层，用于复用 Detail 转换、预计入出和库存事务等方向性生命周期行为，但不得在该层重复声明 Main 属性或复制基础 Main 持久化流程。禁止为了形式对称新增没有方向性行为的空 Main 中间层。

##### 六类对象职责

| 对象 | 主要职责 | 禁止承担的职责 |
|---|---|---|
| Request Main | 申请创建、修改、提交、审批、处理、关闭等业务操作；决定下一阶段走 Job 还是直接走 Record | 不承载明细列表查询实现；不直接插入下游主子表 |
| Request Detail | 申请明细分页、高级查询、导出和明细字段展示 | 不负责申请处理、生成任务或生成记录 |
| Job Main | 任务承接、取消、关闭、执行等业务操作；执行成功后触发 Record 创建 | 不直接复制 Record 的落库流程 |
| Job Detail | 任务明细分页、高级查询、PDA 明细展示和明细字段查询 | 不负责执行任务主流程 |
| Record Main | 接收上游组装完成的 Record Create VO，通过统一 `create` 完成记录主子表落库、事务、趋势和发布 | 不反向处理 Request/Job 状态主流程；业务子类不自建平行创建入口 |
| Record Detail | 记录明细分页、高级查询、导出和追溯展示 | 不负责记录创建编排或库存事务生成 |

统一原则：**Main 用于业务操作和生命周期编排，Detail 用于明细查询与展示。** Detail 独立 CRUD 接口即使因历史兼容暂时保留，也不能成为标准业务写入入口；正常写入由 Main 的主子表流程统一完成。

##### 标准上下游链路

标准完整链路如下：

```text
Request Main.handle
  -> afterHandle / afterHandleLifecycle
  -> 组装 JobCreateReqVO
  -> JobMainService.create(jobCreateReqVO)

Job Main.execute
  -> afterExecute / afterExecuteLifecycle
  -> 组装 RecordCreateReqVO
  -> RecordMainService.create(recordCreateReqVO)
```

强制要求：

- 上游 Main 只负责决定是否生成下游，并在落库后的 `after*` 或专用 lifecycle hook 中组装下游 **Create VO**。
- 下游必须调用其公开 `service.create(...)`，由下游父类重新执行本层转换、校验、编号、主子表持久化、趋势和后置动作。
- 禁止上游直接调用下游 Mapper，禁止直接构造下游 DO 后插库，禁止调用下游 `handleCreate`，也禁止复制下游校验和编号逻辑。
- 组装下游 VO 的公共字段映射属于父层能力；业务新增字段通过窄转换 hook 补齐。字段差异不能成为重写整个 `handle/execute/create` 的理由。
- 上游状态更新必须先成功落库，再创建下游单据；两者需要原子性时由事务边界保证，不能把下游插库偷放进 `before*`。

推荐签名：

```java
protected JobMainCreateReqVO buildJobCreateReqVO(ReqMainDO requestMain,
                                                  List<ReqDetailDO> requestDetails);

protected RecordMainCreateReqVO buildRecordCreateReqVO(JobMainDO jobMain,
                                                        List<JobDetailDO> jobDetails);

protected void afterHandleLifecycle(ReqMainDO requestMain,
                                    List<ReqDetailDO> requestDetails) {
    if (shouldGenerateRecordDirectly(requestMain)) {
        recordMainService.create(buildRecordCreateReqVO(requestMain, requestDetails));
        return;
    }
    jobMainService.create(buildJobCreateReqVO(requestMain, requestDetails));
}

protected void afterExecuteLifecycle(JobMainDO jobMain,
                                     List<JobDetailDO> jobDetails) {
    recordMainService.create(buildRecordCreateReqVO(jobMain, jobDetails));
}
```

签名名称可按现有父类 hook 调整，但职责和调用方向不得改变。只有多个业务共同需要且属于同一层职责时，才允许向 Base 增加窄 hook；不得为单一业务增加同义兼容方法。

##### 跳过任务直接生成记录的开关

标准申请处理默认生成 Job；规则开关开启时，允许走 `Request -> Record`：

```text
Request.handle
  -> 读取并固化规则快照
  -> afterHandleLifecycle
      ├─ 开关关闭：build JobCreateReqVO -> JobMainService.create
      └─ 开关开启：build RecordCreateReqVO -> RecordMainService.create
```

- 开关解析、默认值和规则快照属于 Request 父层公共职责。
- 分支只能存在一个统一决策点，禁止在 Controller、`handle`、`afterHandle`、`generateJob` 多处重复判断。
- 开关关闭时不得生成 Record；开关开启时不得先生成 Job 再补 Record。
- 两条分支都必须调用下游公开 `create`，不能因为“直达记录”而直接插 Record 表。
- 子业务只补充组装 Job/Record VO 时的特有字段，不重新实现规则解析和完整处理流程。

##### 合法的裁剪链路

并非所有业务都必须同时存在 Request、Job、Record。应按真实业务阶段选择父类，禁止创建空壳层：

| 业务模型 | 合法链路 | 示例 | 实现要求 |
|---|---|---|---|
| 完整链路 | Request -> Job -> Record | 常规申请任务业务 | Request 处理创建 Job；Job 执行创建 Record |
| 直达记录 | Request -> Record | 开关开启或业务天然无需任务 | Request after hook 组装 Record VO 并调用 Record create |
| 无任务 | Request -> Record | 盘点调整 | 不创建 Job 类或空 Job Service；申请处理后直接创建记录 |
| 无申请 | 外部上游 -> Job -> Record | 生产收料 | 上游业务调用 Job Service 的标准创建入口；Job 执行后创建 Record |
| 仅记录 | 外部事件 -> Record | 确有直接记账语义的业务 | 外部入口组装 Record Create VO，并调用 Record Service create |

缺失某一阶段时，与该阶段相关的 Service、Controller、Mapper、VO、DO 不应为了继承结构完整而虚构。父类也不得通过 `return null`、空 Service、抛 `UnsupportedOperationException` 等兼容方法假装该阶段存在。

##### 生命周期校验矩阵

| 场景 | 必须发生 | 禁止发生 |
|---|---|---|
| 标准 Request 处理 | after 中创建一个 Job | Request 直接插 Job DO；同时创建 Job 和 Record |
| 跳过任务开关开启 | after 中创建一个 Record | 创建空 Job；绕过 Record Service |
| Job 执行 | after 中创建一个 Record | Job Service 复制 Record 持久化、趋势或事务逻辑 |
| 盘点调整 | Request -> Record | 为了套模板增加无业务意义的 Job |
| 生产收料上游发料 | 外部上游 -> Job -> Record | 为了链路对称增加无业务意义的 Request |
| 子类增加字段 | 本业务层补查询和校验 | 把业务字段放入 Base 或方向层；复制父层属性 |

##### 测试要求

- 分别验证完整链路、跳过任务开关开/关两条分支，断言下游单据数量、类型、来源编号和状态正确。
- 验证 Job 执行只产生一次 Record，Record 的创建趋势、事务和发布动作各执行一次。
- 验证盘点调整等无任务业务没有调用 Job Service；生产收料等无申请业务没有依赖 Request Service。
- 验证每个层级新增属性在普通分页、高级查询、创建和修改中均由本层生效，且父子层没有重复远程查询或重复校验。
- 验证下游创建失败时事务按业务约定回滚，上游不能留下“已处理/已执行但无下游单据”的不一致状态。

##### Wrong vs Correct

```java
// Wrong：Job 直接插入 Record，复制了下游生命周期
protected void afterExecute(JobMainDO jobMain, List<JobDetailDO> details) {
    RecordMainDO recordMain = BeanUtils.toBean(jobMain, RecordMainDO.class);
    recordMainMapper.insert(recordMain);
    recordDetailMapper.insertBatch(convert(details));
    createTrend(recordMain);
}

// Correct：Job 只组装 Record Create VO，下游自己完成创建
protected void afterExecute(JobMainDO jobMain, List<JobDetailDO> details) {
    RecordMainCreateReqVO createReqVO = buildRecordCreateReqVO(jobMain, details);
    getRecordMainService().create(createReqVO);
}
```

```java
// Wrong：用兼容方法掩盖不存在的 Job 阶段
protected JobMainService getJobMainService() {
    return null;
}

// Correct：明确声明该业务链路不生成 Job，在 Request after hook 直达 Record
protected boolean shouldGenerateJobAfterHandle(ReqMainDO requestMain) {
    return false;
}

protected void afterHandleLifecycle(ReqMainDO requestMain, List<ReqDetailDO> details) {
    getRecordMainService().create(buildRecordCreateReqVO(requestMain, details));
}
```

#### 3.2 Controller

- 父类已有的路由，子 Controller 不得再次声明相同 `@GetMapping`、`@PostMapping`、`@PutMapping` 或 `@DeleteMapping`。
- 子 Controller 只保留导入模板、业务专用导出、PDA 聚合、MQ 回调等父类不存在的真实业务接口；AGV 专用接口不属于可保留例外。
- Controller 只做 HTTP 参数接收、权限、幂等和响应封装，不组装 SQL，不直接调用 Mapper，不承载大段导出数据拼装。
- RPC/API 成功后必须返回合法 `CommonResult`，禁止业务成功后 `return null`。
- 历史路由只有在 UI、PDA、其他后端模块和外部调用均确认无引用后才能删除。

#### 3.3 Service

- 子 Service 不重写 `create / update / submit / agree / refused / handle / close / reAdd / execute / getPage / getSenior` 后转发到私有完整流程。
- 禁止无意义包装：`doExecute()`、`doCreate()`、`createXxx()` 仅调用父类同名能力时，应删除并让调用方直接使用父类入口。
- 临时兼容方法必须有真实调用方，保持为薄包装，并在备忘录中记录最终删除条件。
- `protected` 只用于父类扩展契约；仅本类使用的方法必须是 `private`；无外部调用的方法不得保留为 `public`。
- 同一校验只能执行一次。物料、业务类型、库位、余额等远程或数据库校验不得在创建流程中重复调用。
- 查询之外的趋势记录由父类统一完成。子类不得再次记录同一动作；MQ/系统操作人的差异通过父类操作人解析 hook 承接。
- 如果子类 `afterCreate` 与父类生命周期完全等价，应删除 override，直接走父类。

##### 单操作双 hook 契约

每一个公开业务操作只允许向业务子类开放一对扩展点：`beforeXxx` 和 `afterXxx`。父类内部编排步骤不属于扩展契约。

```text
public create   -> beforeCreate   -> 父类内部创建流程   -> afterCreate
public update   -> beforeUpdate   -> 父类内部更新流程   -> afterUpdate
public submit   -> beforeSubmit   -> 父类内部提交流程   -> afterSubmit
public agree    -> beforeAgree    -> 父类内部审批流程   -> afterAgree
public handle   -> beforeHandle   -> 父类内部处理流程   -> afterHandle
public execute  -> beforeExecute  -> 父类内部执行流程   -> afterExecute
public close    -> beforeClose    -> 父类内部关闭流程   -> afterClose
public delete   -> beforeDelete   -> 父类内部删除流程   -> afterDelete
```

强制约束：

- `handleCreate / handleUpdate / handleJob / afterHandleLifecycle / afterCreateLifecycle / shouldGenerateJobAfter* / generateJob` 等内部步骤不得作为业务子类 hook 暴露。
- 内部步骤只被父类使用时改为 `private`，或直接内联到公开模板方法。
- 子类不得覆盖编号生成、状态机推进、主子表落库、趋势、下游分支和事务编排。
- `beforeXxx` 只做该操作落库前的本业务校验、字段准备；不得提前持久化主流程数据。
- `afterXxx` 只做该操作成功后的业务联动；下游 Job/Record 创建由父类内部流程统一决定，子类只准备业务字段。
- 同一操作不得同时存在一参数、两参数、lifecycle、should、handle 等多组 hook。参数统一选择能满足业务扩展的完整签名。
- 转换、查询增强、Mapper 条件等非业务操作能力可保留语义明确的专用方法，但不能伪装成第二套生命周期 hook。

```java
// Wrong：一个 handle 暴露多层扩展点，开发者无法判断覆盖哪一个
beforeHandle(...);
handleHandle(...);
afterHandleLifecycle(...);
afterHandle(...);
shouldGenerateJobAfterHandle(...);

// Correct：子类只理解 before/after，内部流程由父类封闭
public Integer handle(Long id, String businessType) {
    beforeHandle(mainDO, businessType);
    doHandleInternally(mainDO, businessType); // private，或直接内联
    afterHandle(mainDO, businessType);
    return 1;
}
```

#### 3.4 同表多业务类型

- 一张主表/明细表对应多个业务页面时，后端只保留一套 Controller、Service、Mapper 和请求地址。
- UI、PDA 和其他调用方必须显式传递 `businessType`。
- 创建、分页、高级查询和导出必须使用调用方传入的 `businessType`。
- 父类只允许在调用方未传业务类型时补默认值，禁止删除或覆盖已经传入的业务类型条件。
- 子类不再为正常页面请求猜测、默认或兜底业务类型；导入等独立入口可以保留明确的白名单校验。

```java
// 正确：只在缺失时补默认类型
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

#### 3.5 业务类型规则

业务类型规则统一分为三类：

| 规则类型 | 父类职责 | 子类职责 |
|---------|---------|---------|
| 开关规则 | 统一解析布尔值和生命周期时机 | 在对应 hook 执行业务动作，例如是否生成上架申请 |
| 接口规则 | 统一判断是否发送、解析接口类型 | 在 `publish` 或 after hook 组装本业务消息 |
| 编号规则 | 按业务类型读取 `request_number_id / job_number_id / record_number_id` 并生成编号 | 不重复封装编号生成方法 |

- 规则解析结果应写入主表快照，后续流程优先使用快照，避免业务执行过程中 DBC 配置变化导致前后不一致。
- 已经有公共工具封装的规则解析，不在父类或子类再套一层同义方法。

#### 3.6 Detail 查询与主表条件

- 页面列表以 Detail 为查询主体时，明细条件直接落在 Detail wrapper，主表条件通过 `master_id` 子查询或已封装的 main filter 能力追加。
- 子 Mapper 只增加本业务独有查询条件，不复制父 Mapper 已具备的公共字段条件。
- 分页固定流程由 Base 私有 `convertPageResult` 完成：DO 转 VO、分页元数据、创建人/修改人名称和主表公共字段合并都不是 hook。
- Base、方向层和业务层均不得声明 `handlePage`。方向层和业务层只允许在 `afterGetPage/afterGetSenior` 增强本层批次、生产日期、仓库别名或业务显示字段；覆盖时必须先调用 `super`。
- 主表 `remark`、明细 `remark`、`extraProperties` 的覆盖优先级必须明确，禁止直接 `copyProperties` 导致字段被意外覆盖。
- 访问页码超过最大页时必须保留空页判断：

```java
PageResult<DetailDO> pageResult = mapper.selectPage(...);
if (CollectionUtils.isEmpty(pageResult.getList())) {
    return PageResult.empty();
}
```

##### 查询固定生命周期

普通分页、高级查询和导出必须复用同一套父类查询生命周期：

```text
父类规范化并限定 businessType
  -> Mapper 应用 Base 条件
  -> 单向/双向 Mapper 应用方向层条件
  -> 业务 Mapper.applyBusinessPageFilters 应用业务字段
  -> 执行分页/高级查询
  -> 父类批量补 creatorName/updaterName
  -> 单向/双向父层批量补 batchInfo
  -> 业务查询后 hook 只补业务特有展示字段
```

强制约束：

- `businessType` 是查询前必须执行的父类内部规则，不是可选 hook。调用方已传值时保留；缺失时按明确的单业务配置补默认值。共表多业务页面必须由调用方显式传入。
- `creatorName / updaterName` 由父类收集 creator/updater 后批量查询用户并统一赋值，子类不得逐条调用用户接口或复制相同循环。
- `batchInfo` 由方向层父类统一补齐：单向使用 `batchId`；双向使用 `fromBatchId/toBatchId`，并统一处理生产日期、批次号等公共展示字段。
- Main/Detail 的公共用户信息和主表字段合并由 Base 私有流程完成；方向层批次增强由方向层 `afterGetPage/afterGetSenior` 完成；业务层只补业务显示字段，不能复制完整分页转换。
- 查询前一般不向业务子类开放空 `beforeGetPage/beforeGetSenior`。业务字段过滤进入 Mapper `applyBusinessPageFilters`；确有参数转换时保留唯一且语义明确的查询前 hook。
- 查询后最多保留一个业务扩展点，用于补业务特有展示字段；用户名称、批次信息和公共字典不属于业务扩展。
- 普通分页、高级查询和导出必须使用相同增强能力，禁止页面有 creatorName/batchInfo 而高级查询或导出缺失。

```java
// Wrong：每个业务逐条补用户和批次
for (XxxDetailRespVO item : pageResult.getList()) {
    item.setCreatorName(userApi.getUser(Long.valueOf(item.getCreator())).getNickname());
    item.setBatchInfo(batchService.get(item.getBatchId()));
}

// Correct：父类批量增强，子类只补业务字段
enrichOperatorNames(pageResult);
enrichDirectionalBatchInfo(pageResult);
afterQuery(pageResult);
```

#### 3.7 Mapper

- 优先使用 `BaseRequest*Mapper`、`BaseJob*Mapper`、`BaseRecord*Mapper` 已提供的分页、主表映射和逻辑删除能力。
- `queryMainListToMap`、普通 `selectPage` 等父 Mapper 已有方法，子 Mapper 不重复实现。
- 子 Mapper 可保留：
  - `entityClass`、批次 getter 等泛型能力提供方法；
  - `applyBusinessPageFilters`；
  - 数据权限注解；
  - 明确需要主表过滤、批次 JOIN 或特殊排序的查询。
- 禁止仅为了调用 `BaseMapperX.super.selectPage(...)` 而在业务 Mapper 再声明同签名转发方法。
- MyBatis-Plus 实体 wrapper 查询会自动追加逻辑删除条件；手写 SQL、`inSql` 和 XML SQL 必须自行处理 `deleted`。
- 禁止字符串拼接用户输入构造 `inSql`。应使用 Lambda/MPJ wrapper、参数化 Mapper SQL，或先类型化查询主表 ID。
- `COLUMN_TENANT_ID` 等列常量只在 MPJ/反射无法正确解析映射时增加，并写明原因，不能作为普通查询的默认样板代码。
- `@DataScopeLocation` 按方向层提供默认值：单向 Detail Mapper 使用 `location_code`，双向 Detail Mapper 使用 `to_location_code`。业务 Mapper 没有特殊权限字段和特殊查询行为时，不得仅为重复注解而重写 `selectPage/selectSenior`。
- 业务确需使用其他权限字段，或必须重写查询方法时，子 Mapper 重写对应方法并重新声明 `@DataScopeLocation`；方法注解不会因重写自动继承。
- `@SubDataScope` 的 `deptAlias` 是具体业务主表名，无法由通用父 Mapper 静态确定。需要该权限的子 Mapper 保留薄方法并调用父类查询，方法体不得复制查询条件。

#### 3.8 MQ 与共享解析

- Request、Record MQ 使用相同字段解析、日期解析、批次创建和必填校验时，应提取为包内共享 Support。
- Support 方法默认包可见或 `private`，不作为公共 Service API 暴露。
- MQ 最终仍调用父类公开 `create`，业务差异进入 hook，不维护另一套 MQ 专用落库生命周期。

### 4. Validation & Error Matrix

| 检查条件 | 结论 | 处理 |
|---------|------|------|
| 子 Controller 重复声明父类已有路由 | 不合规 | 删除子路由，使用父类接口 |
| 子 Service 重写公开流程后只调用私有完整流程 | 不合规 | 将差异迁移到 hook |
| 子方法只调用父类同名方法 | 不合规 | 删除转发方法 |
| `protected` 方法没有被父类调用，也没有子类扩展语义 | 不合规 | 改为 `private` 或删除 |
| 同一明细创建过程中重复查询物料或余额 | 不合规 | 合并为单次校验 |
| 高级查询覆盖前端传入的 `businessType` | 功能错误 | 只在缺失时补默认值 |
| 父类和子类同时记录同一趋势动作 | 功能错误 | 只保留父类记录，差异走 hook |
| Mapper 重复实现父类 `queryMainListToMap` | 不合规 | 删除子 Mapper 方法 |
| 原始 SQL 拼接 `businessType`、用户 ID 等参数 | 安全错误 | 改为参数化查询 |
| 逻辑删除表使用手写 SQL 但没有 `deleted = false` | 功能错误 | 显式增加逻辑删除条件 |
| 页码超过最大页后返回包含旧数据的结果 | 功能错误 | 保留空列表提前返回 |
| 兼容接口无 UI/PDA/后端引用 | 可删除候选 | 全局确认后连同 Service、Mapper、VO、Convert 一起删除 |

### 5. Good/Base/Bad Cases

- Good：Controller 只实现 `getRequestMainService()`，CRUD、状态流转和执行接口全部继承父类。
- Good：Record 创建通过父类 `create`，业务事务在 `appendTransactionRequests`，消息发送在 `publish`。
- Good：Request、Job、Record 共用同一张表时，UI/PDA 调同一路径并传不同 `businessType`。
- Good：Detail Mapper 只实现业务字段筛选和主表条件扩展。
- Base：不保留 `handlePage`。主表备注与明细备注的覆盖规则由 Base 固定合并策略处理；确有业务差异时，只在业务 `afterGetPage/afterGetSenior` 中显式覆盖目标字段。
- Base：外部系统仍调用历史方法时，保留一层薄兼容包装，但内部新代码统一调用父类入口。
- Bad：子 Controller 再写一个 `/execute`，内部调用 `doExecute()`，`doExecute()` 再调用父 Service。
- Bad：Request 创建先调用一套 `validateDetailMethod`，随后又调用另一套同义校验。
- Bad：同表高级查询把调用方的 `TransferReceipt` 条件强制替换成 `Move`。
- Bad：子 Mapper 声明三个 `selectPage`，方法体只有 `BaseMapperX.super.selectPage(...)`。

### 6. Tests Required

每完成一个业务模块的模板化改造，至少验证：

- Controller 路由没有与父类重复，UI/PDA 请求地址和参数保持不变。
- `create / update / submit / agree / refused / handle / close / reAdd / execute` 状态流转与改造前一致。
- 自动生成 Job、直接生成 Record、MQ、第三方接口和规则开关仍按业务类型执行。
- 创建动作只生成一条对应趋势记录，操作人正确。
- 普通分页和高级查询均按调用方 `businessType` 返回数据。
- Detail 查询同时覆盖明细条件、主表条件、数据权限和逻辑删除。
- 页码超过最大页时返回空列表和正确分页结构。
- 导出普通查询、高级查询和空数据场景均可正常生成文件。
- 全局搜索被删除方法、路由、VO、Mapper 和 Convert，确认无残留引用。
- 执行 `git diff --check`；由业务负责人完成模块编译和关键流程回归。

### 7. Wrong vs Correct

#### Wrong：重复公开流程

```java
@PutMapping("/execute")
public CommonResult<String> execute(@Valid @RequestBody JobMainExecuteVO reqVO) {
    return success(doExecute(reqVO));
}

protected String doExecute(JobMainExecuteVO reqVO) {
    return getJobMainService().execute(reqVO);
}
```

#### Correct：直接继承父 Controller

```java
public class XxxJobMainController extends BaseJobMainController<...> {

    @Override
    protected XxxJobMainService getJobMainService() {
        return xxxJobMainService;
    }
}
```

#### Wrong：子 Service 复制完整创建流程

```java
@Override
public String create(MainCreateReqVO reqVO) {
    MainDO mainDO = convert(reqVO);
    validate(mainDO);
    mainMapper.insert(mainDO);
    detailMapper.insertBatch(...);
    trendsApi.createTrends(...);
    publish(...);
    return mainDO.getNumber();
}
```

#### Correct：差异进入 hook

```java
@Override
protected void beforeCreate(MainCreateReqVO reqVO) {
    validateBusinessFields(reqVO);
}

@Override
protected void publish(MainDO mainDO, List<DetailDO> detailDOList) {
    publishBusinessMessage(mainDO, detailDOList);
}
```

#### Wrong：覆盖显式业务类型

```java
conditions.getFilters().removeIf(condition ->
        "businessType".equals(condition.getColumn()));
conditions.getFilters().add(new Condition("businessType", "==", "Move"));
```

#### Correct：仅缺失时补默认值

```java
if (!hasBusinessTypeCondition(conditions)) {
    conditions.getFilters().add(new Condition("businessType", "==", defaultBusinessType));
}
```

#### Wrong：重复 Mapper 包装

```java
default PageResult<DetailDO> selectPage(PageReqVO reqVO, QueryWrapper<DetailDO> wrapper) {
    return BaseMapperX.super.selectPage(reqVO, wrapper);
}
```

#### Correct：继承父 Mapper，只扩展业务条件

```java
@Override
default void applyBusinessPageFilters(MPJLambdaWrapperX<DetailDO> wrapper, PageReqVO reqVO) {
    wrapper.eqIfPresent(DetailDO::getBusinessField, reqVO.getBusinessField());
}
```

---

## 固定执行顺序

1. 确认业务是否真的存在 `request / job / record`，只有存在的链路才继承对应父类。
2. 检查 Controller，删除父类已有路由和 `doXxx` 转发。
3. 检查 Service，先收敛公开主流程，再迁移差异到 hook。
4. 检查业务类型规则、编号规则、趋势记录和 MQ，确保只有一套公共实现。
5. 检查 Detail Service 与 Mapper，保留主表条件和返回增强，删除纯转发查询。
6. 全局搜索 UI、PDA、后端和 MQ 调用，确认兼容方法是否可删。
7. 一个业务功能完成后停止，编译和回归通过再处理下一个业务。

---

## 按层、按对象、按方法的业务验收契约

### 1. Scope / Trigger

- 每次优化一个 WMS 业务，必须覆盖该业务 Request/Job/Record Main/Detail 的 VO、DO、Mapper、Service、Controller。
- 验收单位是 `Base → 单向/双向 → 具体业务` 完整继承链；`customerreturn` 与 `inventorymove` 是当前基准实现。
- 其他业务逐个迁移，禁止为消除编译错误批量恢复兼容 hook 或修改未进入本轮的业务。

### 2. Signatures

父类公开方法是唯一主流程：

```java
create(...); update(...); delete(...);
submit(...); agree(...); refused(...); handle(...);
close(...); reAdd(...); execute(...);
getPage(...); getSenior(...);
```

子类只允许使用确有业务差异的明确扩展点：

```java
beforeCreate(...); afterCreate(...);
beforeUpdate(...); afterUpdate(...);
beforeHandle(...); afterHandle(...);
beforeExecute(...); afterExecute(...);
afterGetPage(...); afterGetSenior(...);
afterExportExcel(...); publish(...); generateTransaction(...);
```

禁止新增或保留：`handleCreate/handleUpdate/handleDelete/handlePage/handleJob`、`saveDO/updateDO/deleteDO`、`*Lifecycle`、只有一次判断的 `shouldXxx`、同义 `doXxx` 转发。

### 3. Contracts

#### 三层属性闭环

| 层级 | 属性职责 | Mapper 职责 | Service 职责 |
|---|---|---|---|
| Base | 声明所有业务共有属性 | 封装公共普通分页和高级查询条件 | 公共转换、默认值、校验、状态机和持久化 |
| 单向/双向 | 声明方向语义属性 | 追加本层条件和默认库位数据权限 | 校验库位、批次、库存状态，处理预计库存和库存事务 |
| 具体业务 | 只声明单据特有属性 | 只追加业务字段条件 | before/after 只处理业务字段和业务联动 |

- 同名属性只能在首次引入它的 VO/DO 层声明一次。
- PageReqVO 的每个本层字段必须在本层 Mapper 有普通分页条件；高级查询复用相同字段语义。
- Create/Update VO 的每个本层字段必须在本层 `convert*` 或 `beforeCreate/beforeUpdate` 中存在校验、默认值、派生赋值或明确的无需处理依据。
- 子层必须调用父层能力，只增加本层内容；不得把父层字段重新查询、重新校验或重新赋值一遍。

#### 六类对象职责

| 对象 | 负责 | 禁止 |
|---|---|---|
| Request Main | 申请生命周期、处理后生成一个下游 | 直接插 Job/Record Mapper、库存事务、Record 发布 |
| Request Detail | 申请明细查询和数据载体 | 编排主流程或生成下游 |
| Job Main | 接受、放弃、执行，执行后生成 Record | 复制 Record 持久化流程 |
| Job Detail | 作业明细查询和执行输入 | 独立改变主任务状态 |
| Record Main | 记录创建、库存事务、单条趋势和 `publish` | 接管 Request/Job 状态机 |
| Record Detail | 记录明细查询和展示增强 | 独立发布或独立生成事务主链 |

#### 上下游调用方向

```text
Request.handle
  ├─ 普通：组装 Job Create VO -> JobService.create
  └─ 跳过任务：组装 Record Create VO -> RecordService.create

Job.execute
  └─ afterExecute 组装 Record Create VO -> RecordService.create

Record.create
  ├─ Base 主子表持久化和一条趋势
  ├─ 方向层 generateTransaction
  └─ 业务层 publish
```

普通链路和跳过任务链路必须互斥。无 Job 或无 Request 的业务直接选择对应能力模型，不得用空 Service、`return null` 或无意义兼容方法伪造阶段。

#### 查询返回契约

- Base 私有 `convertPageResult` 固定完成 DO→VO、total/msg、creatorName/updaterName 和主表公共字段合并，它不是 hook。
- 方向层仅在 `afterGetPage/afterGetSenior` 增强批次信息和方向别名。
- 业务层覆盖 after hook 时先调用 `super`，再补生产日期、目标仓库、业务备注等本层显示字段。
- Main 负责业务操作；Detail 负责查询展示。Detail 可按 Main 字段过滤，但不得因此把业务操作下放到 Detail。

#### RedisMQ 回调保留契约

##### 1. Scope / Trigger

- 适用于由 RedisMQ 消费框架扫描并调用、使用 `@ConsumerMethod` 标记的 Service 公共方法。
- 此类方法通过注解注册、反射或消息路由触发，通常没有 Java 静态调用方；静态搜索“只有定义、没有引用”不能判定为死方法。

##### 2. Signatures

标准签名以实际消息契约为准，常见形式为：

```java
@Transactional
@ConsumerMethod
public String mesWorkOrderCloseRedisMQ(Map<String, Object> paramMap) {
    // 校验消息并调用领域 Service
}
```

方法名、参数类型和返回类型属于 MQ 路由契约，未同步修改消息生产者、消费者注册信息和运维配置前不得改名、改参或删除。

##### 3. Contracts

- 必须同时确认 `@ConsumerMethod` 注解、所属 Spring Bean 和消息路由约定有效。
- 回调是外部写入口时必须使用 `@Transactional`，确保主数据、明细、趋势和下游联动原子提交。
- 回调方法只负责消息参数校验、幂等控制和调用职责明确的领域 Service；复杂 Request/Job/Record 生命周期仍调用标准公开 Service，不复制父类流程。
- JSON 转换统一使用 Hutool；不得因为 MQ 入参是 `Map<String, Object>` 恢复 Fastjson。
- 方法应有明确的 RedisMQ 回调 Javadoc，说明消息来源、触发事件、核心业务动作和返回语义。

##### 4. Validation & Error Matrix

| 情况 | 处理 |
|---|---|
| 方法有 `@ConsumerMethod`、无静态引用 | 视为框架入口，保留并继续审查其内部职责 |
| 只有类似 MQ 的方法名但无 `@ConsumerMethod` | 查询消费者注册和消息配置；确认无外部路由后才能删除 |
| 修改方法名或参数 | 必须同步生产者、消费者路由、配置和测试，否则禁止修改 |
| 写操作没有事务 | 补 `@Transactional` |
| 回调内复制 Base 生命周期 | 改为组装标准 VO 并调用对应 Service 公开方法 |
| 重复消息可能重复落库 | 增加业务键/消息键幂等校验 |

##### 5. Good/Base/Bad Cases

- Good：`@ConsumerMethod` 回调校验工单号后，调用 Record Service 的明确业务方法完成推送。
- Base：无静态调用但有注解和路由配置的方法保留，不能按普通私有辅助方法处理。
- Bad：仅根据 `rg` 没有调用方就删除 MQ 回调。
- Bad：为减少方法数量，把多个不同消息契约合并成一个难以路由的通用 `handle(Map)`。

##### 6. Tests Required

- 启动时验证消费者扫描能够注册目标 Bean 和方法。
- 使用真实结构消息验证参数反序列化、返回值和异常传播。
- 重复投递同一消息，断言不会重复生成单据、趋势或第三方推送。
- 回调中途异常，断言事务回滚且消息按框架约定重试或进入失败处理。
- 静态清理报告必须单列所有 `@ConsumerMethod`，不得放入“零引用待删除”清单。

##### 7. Wrong vs Correct

```java
// Wrong：没有静态调用就当作死方法删除
// rg 只有定义 -> 删除 mesWorkOrderCloseRedisMQ

// Correct：注解方法是框架入口，保留契约并只收敛内部实现
@Transactional
@ConsumerMethod
public String mesWorkOrderCloseRedisMQ(Map<String, Object> paramMap) {
    String workOrderNumber = requireWorkOrderNumber(paramMap);
    return productionReceiptService.processMesWorkOrderClose(workOrderNumber);
}
```

### 4. Validation & Error Matrix

| 发现项 | 处理结果 |
|---|---|
| 子类重复父类属性 | 删除重复字段，并复核 BeanUtils、MapStruct、JSON、MyBatis、导入导出 |
| PageReqVO 字段无所属层查询条件 | 在所属 Mapper 补齐，不能下沉到具体业务重复实现 |
| Create/Update 字段无校验或赋值依据 | 在所属层 convert/before hook 补齐 |
| 子类覆盖父类公开模板方法 | 迁移差异到 before/after，删除 override |
| Request/Job 直接插下游 Mapper | 改为组装 VO 调用下游 Service `create` |
| 写操作无事务 | 公开写入口必须由 `@Transactional` 覆盖 |
| 一次操作重复趋势 | 只保留一条对应操作趋势 |
| Request/Job 发布 Record 数据 | 迁入 Record `publish` |
| 存在 `handlePage` | 固定转换收回 Base，差异迁入 after hook |
| 当前业务仍含 Switch/AGV/Alibaba JSON | 按业务删除，JSON 统一 Hutool |
| `@ConsumerMethod` 无静态调用 | 作为 RedisMQ 框架入口保留，核对消息路由、事务、幂等和内部职责 |

### 5. Good/Base/Bad Cases

- Good：Inventorymove Job 在 `beforeExecute` 准备执行字段，在 `afterExecute` 组装 Record VO 并调用 Record Service `create`。
- Good：Inventorymove Record Detail 先调用方向层 `super.afterGetPage`，再补生产日期、目标仓库和业务备注。
- Base：Customerreturn Request 在 `beforeCreate/beforeUpdate/beforeHandle` 校验本业务字段，下游生成交给父类模板。
- Bad：子类重写 `create/update/getPage`，复制编号、状态机、主子表持久化或用户名称填充。
- Bad：为了兼容一个旧子类，在 Base 新增只转发一次的 `handleXxx/doXxx/shouldXxx`。

### 6. Tests Required

- 静态搜索目标业务：`handleCreate|handleUpdate|handleDelete|handlePage|handleJob` 无结果。
- 静态搜索目标业务：`SwitchApi|switchApi|selectSwitchExist|AGV|agv|com.alibaba.fastjson` 无结果。
- 比较父子 VO/DO 字段名，父子同名字段交集为空。
- 每个 PageReqVO 本层字段验证普通分页；关键字段验证高级查询等价。
- 创建和修改验证本层必填、关联合法性、默认值、主子表同步。
- 分别验证 Request→Job、Request→Record、Job→Record，只生成一个下游主表且明细完整。
- 任一步骤异常时，主子表、趋势、库存事务不得部分提交。
- 分页验证用户名称、主表字段、批次信息及业务增强字段；空页安全返回。
- Record 创建成功只调用一次业务 `publish`；Request/Job 不直接发布 Record 数据。
- 枚举当前业务所有 `@ConsumerMethod`，逐个验证消费者注册、消息结构、事务和幂等；禁止用静态零引用结论删除。

### 7. Wrong vs Correct

```java
// Wrong：子类接管完整分页转换
protected void handlePage(PageResult<XxxDO> source, PageResult<XxxRespVO> target) {
    // convert、查用户、查主表、补批次……
}

// Correct：固定转换由 Base 完成，子类只补本层展示字段
@Override
protected void afterGetPage(XxxPageReqVO req, XxxDO query,
        PageResult<XxxDO> source, PageResult<XxxRespVO> target) {
    super.afterGetPage(req, query, source, target);
    fillBusinessDisplayFields(target.getList());
}
```

```java
// Wrong：Request 直接插入 Record
recordMainMapper.insert(recordMainDO);
recordDetailMapper.insertBatch(recordDetails);

// Correct：Request 只组装下游契约
RecordMainCreateReqVO recordVO = buildRecordCreateVO(requestMain, requestDetails);
recordMainService.create(recordVO);
```
