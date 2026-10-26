# WMS 模板 · VO 泛型规范

> 约束 Request / Job / Record 三条链下 Main 和 Detail 的 VO 继承关系与泛型填充规则。

---

## 场景：VO 层继承定义与 Service/Controller 泛型填写

### 1. Scope / Trigger

适用：
- 新增或重构 WMS 模板化模块时，定义 VO 继承关系
- Service/Controller 填写泛型参数时选型
- 审查现有模块的 VO 泛型合规性（对照本规范逐项检查）

不适用：
- 非模板化模块（无 Request/Job/Record 语义的单表 CRUD）
- DO / Mapper / Convert 层的泛型问题

---

### 2. 一句总规则

- **所有 Main VO / Main DO / Main Mapper / Main Controller 不分单向/双向。**
- **Detail 的 VO / DO / Mapper / Controller 按单向/双向分家族。**
- **MainBaseVO 的泛型约束必为 DetailBaseVO；具体 Create/Update/Resp VO 分别绑定对应子类型。**
- **MainService/Controller 的明细 VO 泛型位（Request 链第 3 位）填 DetailCreateReqVO，与 Base 层 convertDetailList 类型链路对齐。**

---

## 3. Request 链

### 3.1 主 VO 继承体系

```
BaseRequestMainVO<ReqDetailVO extends BaseRequestDetailVO>     ← core 基类
│
├── XxxRequestMainBaseVO<ReqDetailVO extends XxxDetailBaseVO>  ← 业务 BaseVO
│       │
│       ├── XxxRequestMainCreateReqVO
│       │     extends XxxRequestMainBaseVO<XxxDetailCreateReqVO>
│       │
│       └── XxxRequestMainUpdateReqVO
│             extends XxxRequestMainBaseVO<XxxDetailUpdateReqVO>
│
└── BaseRequestMainPageRespVO<ReqDetailVO extends BaseRequestDetailVO>
        │
        └── XxxRequestMainRespVO
              extends BaseRequestMainPageRespVO<XxxDetailRespVO>

WinPageParam
  └── BaseRequestMainPageReqVO  ← XxxRequestMainPageReqVO
```

#### 3.1.1 MainBaseVO

| 项目 | 规范 |
|------|------|
| 必须存在 | 是。每个模块必须创建独立的 `XxxRequestMainBaseVO` |
| 继承 | `extends BaseRequestMainVO<ReqDetailVO>` |
| 泛型约束 | `<ReqDetailVO extends XxxRequestDetailBaseVO>` |
| 自身字段 | 仅声明本业务主表首次引入的字段 |

```java
// Correct
public class CustomerreturnRequestMainBaseVO<ReqDetailVO extends CustomerreturnRequestDetailBaseVO>
        extends BaseRequestMainVO<ReqDetailVO> {
    private String deliverRecordNumber;
    private String soNumber;
    private String businessDetail;
}

// Wrong：泛型约束绑定 CreateReqVO（基础层不应绑定创建场景）
public class DeliverRequestMainBaseVO
        extends BaseRequestMainVO<DeliverRequestDetailCreateReqVO> { }

// Wrong：无 BaseVO 中间层，直接 extends BaseRequestMainVO
public class CountRequestMainCreateReqVO
        extends BaseRequestMainVO<CountRequestDetailCreateReqVO> { }
```

#### 3.1.2 MainCreateReqVO

| 项目 | 规范 |
|------|------|
| 继承 | `extends XxxRequestMainBaseVO<XxxRequestDetailCreateReqVO>` |
| 自身字段 | 仅声明创建场景独有字段 |

```java
// Correct
public class CustomerreturnRequestMainCreateReqVO
        extends CustomerreturnRequestMainBaseVO<CustomerreturnRequestDetailCreateReqVO> {
    // 无额外字段（或声明创建特有字段）
}
```

#### 3.1.3 MainUpdateReqVO

| 项目 | 规范 |
|------|------|
| 继承 | `extends XxxRequestMainBaseVO<XxxRequestDetailUpdateReqVO>` |
| 自身字段 | 仅声明更新场景独有字段 |

**CreateReqVO 和 UpdateReqVO 必须分开两个类**，即使字段完全相同也不得合并。原因：创建和更新是两个独立演进场景。

#### 3.1.4 MainRespVO

| 项目 | 规范 |
|------|------|
| 继承 | `extends BaseRequestMainPageRespVO<XxxRequestDetailRespVO>` |
| 注意 | **不继承** MainBaseVO；直接继承 PageResp 基类 |

#### 3.1.5 MainPageReqVO

| 项目 | 规范 |
|------|------|
| 继承 | `extends BaseRequestMainPageReqVO` |
| 泛型 | 无子表泛型参数 |

### 3.2 明细 VO 继承体系

```
BaseRequestDetailVO                              ← core 基类
│
├── Base(Unidirectional|Bidirectional)RequestDetailVO  ← 方向层
│       │
│       └── XxxRequestDetailBaseVO               ← 业务 BaseVO
│               │
│               ├── XxxRequestDetailCreateReqVO
│               └── XxxRequestDetailUpdateReqVO
│
├── BaseRequestDetailPageRespVO
│       │
│       └── Base(Unidirectional|Bidirectional)RequestDetailPageRespVO
│               │
│               └── XxxRequestDetailRespVO
│
└── BaseRequestDetailPageReqVO
        │
        └── Base(Unidirectional|Bidirectional)RequestDetailPageReqVO
                │
                └── XxxRequestDetailPageReqVO
```

#### 3.2.1 DetailBaseVO

| 项目 | 规范 |
|------|------|
| 继承 | `extends BaseUnidirectionalRequestDetailVO` 或 `BaseBidirectionalRequestDetailVO` |
| 泛型 | 无。DetailBaseVO 是叶子节点，不携带泛型参数 |

```java
// Correct (双向)
public class CustomerreturnRequestDetailBaseVO extends BaseBidirectionalRequestDetailVO {
    private String soLine;
    private LocalDateTime produceDate;
}

// Correct (单向)
public class ScrapRequestDetailBaseVO extends BaseUnidirectionalRequestDetailVO {
    private String scrapReason;
}
```

#### 3.2.2 DetailCreateReqVO / DetailUpdateReqVO

| 项目 | 规范 |
|------|------|
| 继承 | `extends XxxRequestDetailBaseVO` |
| 泛型 | 无 |

**必须分开两个类**，同 Main 层规则。

#### 3.2.3 DetailRespVO

| 项目 | 规范 |
|------|------|
| 继承 | `extends BaseUnidirectionalRequestDetailPageRespVO` 或 `BaseBidirectionalRequestDetailPageRespVO` |
| 注意 | **不继承** DetailBaseVO；直接继承 PageResp 基类 |

#### 3.2.4 DetailPageReqVO

| 项目 | 规范 |
|------|------|
| 继承 | `extends BaseUnidirectionalRequestDetailPageReqVO` 或 `BaseBidirectionalRequestDetailPageReqVO` |

### 3.3 RequestMainService 泛型填充

`BaseBidirectionalRequestMainService` 共 19 个泛型位。`BaseUnidirectionalRequestMainService` 同理。

| 位 | 参数名 | 基类约束 | 应填类型 | 来源 |
|:--:|--------|----------|----------|------|
| 1 | `ReqMainCreateVO` | `extends BaseRequestMainVO` | `XxxRequestMainCreateReqVO` | Request VO |
| 2 | `ReqMainUpdateVO` | `extends BaseRequestMainVO` | `XxxRequestMainUpdateReqVO` | Request VO |
| **3** | **`ReqDetailVO`** | `extends BaseBidirectionalRequestDetailVO` | **`XxxRequestDetailCreateReqVO`** | **Request VO** |
| 4 | `ReqDetailReqVO` | `extends BaseBidirectionalRequestDetailPageReqVO` | `XxxRequestDetailPageReqVO` | Request VO |
| 5 | `ReqMainPageReqVO` | `extends BaseRequestMainPageReqVO` | `XxxRequestMainPageReqVO` | Request VO |
| 6 | `ReqMainPageRespVO` | `extends BaseRequestMainPageRespVO` | `XxxRequestMainRespVO` | Request VO |
| 7 | `ReqMainDO` | `extends BaseRequestMainDO` | `XxxRequestMainDO` | Request DO |
| 8 | `ReqDetailDO` | `extends BaseBidirectionalRequestDetailDO` | `XxxRequestDetailDO` | Request DO |
| 9 | `JobMainVO` | `extends BaseJobMainVO` | `XxxJobMainCreateReqVO` | Job VO |
| 10 | `JobDetailVO` | `extends BaseBidirectionalJobDetailVO` | `XxxJobDetailCreateReqVO` | Job VO |
| 11 | `JobDetailPageReqVO` | `extends BaseBidirectionalJobDetailPageReqVO` | `XxxJobDetailPageReqVO` | Job VO |
| 12 | `JobMainPageReqVO` | `extends BaseJobMainPageReqVO` | `XxxJobMainPageReqVO` | Job VO |
| 13 | `JobMainPageRespVO` | `extends BaseJobMainPageRespVO` | `XxxJobMainRespVO` | Job VO |
| 14 | `JobMainDO` | `extends BaseJobMainDO` | `XxxJobMainDO` | Job DO |
| 15 | `JobDetailDO` | `extends BaseBidirectionalJobDetailDO` | `XxxJobDetailDO` | Job DO |
| 16 | `RecMainVO` | `extends BaseRecordMainVO` | `XxxRecordMainCreateReqVO` | Record VO |
| 17 | `RecDetailVO` | `extends BaseBidirectionalRecordDetailVO` | `XxxRecordDetailCreateReqVO` | Record VO |
| 18 | `RecMainDO` | `extends BaseRecordMainDO` | `XxxRecordMainDO` | Record DO |
| 19 | `RecDetailDO` | `extends BaseBidirectionalRecordDetailDO` | `XxxRecordDetailDO` | Record DO |

**第 3 位为什么填 DetailCreateReqVO 而非 DetailBaseVO：**

基类 `BaseUnidirectionalRequestMainService.convertDetailList()` 中：
```java
List<ReqDetailVO> subList = reqMainVO.getSubList();  // subList 实际元素类型 = DetailCreateReqVO
```
Java 泛型是不变的：`List<DetailCreateReqVO>` 无法赋值给 `List<DetailBaseVO>`。
只有填入一致类型 `DetailCreateReqVO`，基类 `convertDetailList` 才能直接复用，无需子类覆写。

### 3.4 RequestMainController 泛型填充

`BaseRequestMainController` 共 19 个泛型位，与 Service 一一对应，填充规则相同。

| 位 | 应填类型 |
|:--:|----------|
| 1 | `XxxRequestMainCreateReqVO` |
| 2 | `XxxRequestMainUpdateReqVO` |
| **3** | **`XxxRequestDetailCreateReqVO`** |
| 4 | `XxxRequestDetailPageReqVO` |
| 5 | `XxxRequestMainPageReqVO` |
| 6 | `XxxRequestMainRespVO` |
| 7-19 | 与 Service 对应位相同 |

### 3.5 RequestDetailService / Controller 泛型

`BaseBidirectionalRequestDetailService` 共 15 个泛型位。

| 位 | 应填类型 |
|:--:|----------|
| 1 | `XxxRequestMainCreateReqVO` |
| 2 | `XxxRequestDetailCreateReqVO` |
| 3 | `XxxRequestDetailPageReqVO` |
| 4 | `XxxRequestDetailRespVO` |
| 5 | `XxxRequestMainPageReqVO` |
| 6-15 | 对应 DO / Job VO / Record VO |

---

## 4. Job 链

### 4.1 主 VO 继承体系

```
BaseJobMainVO<JobDetailVO extends BaseJobDetailVO>           ← core 基类
│
├── XxxJobMainBaseVO<JobDetailVO extends XxxJobDetailBaseVO> ← 业务 BaseVO
│       │
│       ├── XxxJobMainCreateReqVO
│       │     extends XxxJobMainBaseVO<XxxJobDetailCreateReqVO>
│       │
│       ├── XxxJobMainUpdateReqVO
│       │     extends XxxJobMainBaseVO<XxxJobDetailUpdateReqVO>
│       │
│       └── XxxJobMainExecuteReqVO                           ← Job 特有
│             extends XxxJobMainBaseVO<XxxJobDetailUpdateReqVO>
│
└── BaseJobMainPageRespVO<JobDetailVO extends BaseJobDetailVO>
        │
        └── XxxJobMainRespVO
              extends BaseJobMainPageRespVO<XxxJobDetailRespVO>
```

规则与 Request 主 VO 完全一致，仅将链路名从 `Request` 替换为 `Job`。

#### 4.1.1 Job 特有：ExecuteReqVO

任务执行 VO 继承 `XxxJobMainBaseVO`，泛型绑定 `XxxJobDetailUpdateReqVO`：
```java
public class CustomerreturnJobMainExecuteReqVO
        extends CustomerreturnJobMainBaseVO<CustomerreturnJobDetailUpdateReqVO> {
}
```

### 4.2 明细 VO 继承体系

```
BaseJobDetailVO
  └── Base(Unidirectional|Bidirectional)JobDetailVO
        └── XxxJobDetailBaseVO
              ├── XxxJobDetailCreateReqVO
              └── XxxJobDetailUpdateReqVO

BaseJobDetailPageRespVO
  └── Base(Unidirectional|Bidirectional)JobDetailPageRespVO
        └── XxxJobDetailRespVO

BaseJobDetailPageReqVO
  └── Base(Unidirectional|Bidirectional)JobDetailPageReqVO
        └── XxxJobDetailPageReqVO
```

规则与 Request 明细 VO 一致，替换链路名即可。

### 4.3 JobMainService 泛型填充

`BaseBidirectionalJobMainService` 共 17 个泛型位。

| 位 | 参数名 | 应填类型 |
|:--:|--------|----------|
| 1 | `ReqMainVO` | `XxxRequestMainCreateReqVO` |
| 2 | `ReqDetailVO` | `XxxRequestDetailCreateReqVO` |
| 3 | `ReqMainDO` | `XxxRequestMainDO` |
| 4 | `ReqDetailDO` | `XxxRequestDetailDO` |
| 5 | `JobMainCreateVO` | `XxxJobMainCreateReqVO` |
| 6 | `JobMainUpdateVO` | `XxxJobMainUpdateReqVO` |
| 7 | `JobMainExecuteVO` | `XxxJobMainExecuteReqVO` |
| 8 | `JobDetailCreateVO` | `XxxJobDetailCreateReqVO` |
| 9 | `JobDetailPageReqVO` | `XxxJobDetailPageReqVO` |
| 10 | `JobMainPageReqVO` | `XxxJobMainPageReqVO` |
| 11 | `JobMainPageRespVO` | `XxxJobMainRespVO` |
| 12 | `JobMainDO` | `XxxJobMainDO` |
| 13 | `JobDetailDO` | `XxxJobDetailDO` |
| 14 | `RecMainVO` | `XxxRecordMainCreateReqVO` |
| 15 | `RecDetailVO` | `XxxRecordDetailCreateReqVO` |
| 16 | `RecMainDO` | `XxxRecordMainDO` |
| 17 | `RecDetailDO` | `XxxRecordDetailDO` |

### 4.4 JobMainController 泛型填充

`BaseJobMainController` 共 17 个泛型位，与 Service 填充规则相同。

---

## 5. Record 链

### 5.1 主 VO 继承体系

```
BaseRecordMainVO<RecDetailVO extends BaseRecordDetailVO>           ← core 基类
│
├── XxxRecordMainBaseVO<RecDetailVO extends XxxRecordDetailBaseVO> ← 业务 BaseVO
│       │
│       ├── XxxRecordMainCreateReqVO
│       │     extends XxxRecordMainBaseVO<XxxRecordDetailCreateReqVO>
│       │
│       └── XxxRecordMainUpdateReqVO
│             extends XxxRecordMainBaseVO<XxxRecordDetailUpdateReqVO>
│
└── BaseRecordMainPageRespVO<RecDetailVO extends BaseRecordDetailVO>
        │
        └── XxxRecordMainRespVO
              extends BaseRecordMainPageRespVO<XxxRecordDetailRespVO>
```

规则与 Request/Job 主 VO 一致。

### 5.2 明细 VO 继承体系

```
BaseRecordDetailVO
  └── Base(Unidirectional|Bidirectional)RecordDetailVO
        └── XxxRecordDetailBaseVO
              ├── XxxRecordDetailCreateReqVO
              └── XxxRecordDetailUpdateReqVO

BaseRecordDetailPageRespVO
  └── Base(Unidirectional|Bidirectional)RecordDetailPageRespVO
        └── XxxRecordDetailRespVO

BaseRecordDetailPageReqVO
  └── Base(Unidirectional|Bidirectional)RecordDetailPageReqVO
        └── XxxRecordDetailPageReqVO
```

### 5.3 RecordMainService 泛型填充

`BaseBidirectionalRecordMainService` 共 16 个泛型位。

| 位 | 参数名 | 应填类型 |
|:--:|--------|----------|
| 1 | `ReqMainVO` | `XxxRequestMainCreateReqVO` |
| 2 | `ReqDetailVO` | `XxxRequestDetailCreateReqVO` |
| 3 | `ReqMainDO` | `XxxRequestMainDO` |
| 4 | `ReqDetailDO` | `XxxRequestDetailDO` |
| 5 | `JobMainVO` | `XxxJobMainCreateReqVO` |
| 6 | `JobDetailVO` | `XxxJobDetailCreateReqVO` |
| 7 | `JobMainDO` | `XxxJobMainDO` |
| 8 | `JobDetailDO` | `XxxJobDetailDO` |
| 9 | `RecMainCreateVO` | `XxxRecordMainCreateReqVO` |
| 10 | `RecMainUpdateVO` | `XxxRecordMainUpdateReqVO` |
| 11 | `RecDetailVO` | `XxxRecordDetailCreateReqVO` |
| 12 | `RecDetailPageReqVO` | `XxxRecordDetailPageReqVO` |
| 13 | `RecMainPageRespVO` | `XxxRecordMainRespVO` |
| 14 | `RecMainPageReqVO` | `XxxRecordMainPageReqVO` |
| 15 | `RecMainDO` | `XxxRecordMainDO` |
| 16 | `RecDetailDO` | `XxxRecordDetailDO` |

### 5.4 RecordMainController 泛型填充

`BaseRecordMainController` 共 16 个泛型位，与 Service 填充规则相同。

---

## 6. 禁止事项

| # | 禁止 | 原因 | 示例 |
|:--:|------|------|------|
| 1 | CreateReqVO/UpdateReqVO 合并为一个类 | 两个独立演进场景 | `class PurchasereceiptRequestMainCreateReqVO`（同时充当 Update） |
| 2 | 无 MainBaseVO 中间层，CreateReqVO 直接 `extends BaseXxxMainVO<DetailCreateReqVO>` | 压扁分层，BaseVO 层职责丢失 | `CountRequestMainCreateReqVO extends BaseRequestMainVO<CountRequestDetailCreateReqVO>` |
| 3 | MainBaseVO 泛型约束绑定 `DetailCreateReqVO` | 基础层不应绑定创建场景 | `DeliverRequestMainBaseVO extends BaseRequestMainVO<DeliverRequestDetailCreateReqVO>` |
| 4 | MainRespVO 继承 MainBaseVO | RespVO 应继承 PageResp 基类 | `MainRespVO extends MainBaseVO` |
| 5 | DetailRespVO 继承 DetailBaseVO | DetailRespVO 应继承 DetailPageRespVO 基类 | `DetailRespVO extends DetailBaseVO` |
| 6 | 同一继承链中，子类重复声明父类已有字段 | 属性唯一声明 | 子类再声明 `private String customerCode;` |
| 7 | Request MainService/Controller 第 3 位泛型填 DetailBaseVO | 类型不匹配，强制子类覆写 convertDetailList | `RequestMainService<..., XxxRequestDetailBaseVO, ...>` |
| 8 | 双向业务给 Main Controller 错配 `BaseBidirectionalXxxMainController` | Main 永远不分方向 | `extends BaseBidirectionalRequestMainController` |

---

## 7. 完整示例（customerreturn）

### 7.1 Request 主 VO

```java
// ① MainBaseVO：泛型约束 DetailBaseVO
public class CustomerreturnRequestMainBaseVO<ReqDetailVO extends CustomerreturnRequestDetailBaseVO>
        extends BaseRequestMainVO<ReqDetailVO> {
    private String deliverRecordNumber;
    private String soNumber;
    private String businessDetail;
}

// ② MainCreateReqVO：绑定 DetailCreateReqVO
public class CustomerreturnRequestMainCreateReqVO
        extends CustomerreturnRequestMainBaseVO<CustomerreturnRequestDetailCreateReqVO> {
}

// ③ MainUpdateReqVO：绑定 DetailUpdateReqVO
public class CustomerreturnRequestMainUpdateReqVO
        extends CustomerreturnRequestMainBaseVO<CustomerreturnRequestDetailUpdateReqVO> {
}

// ④ MainRespVO：继承 PageResp 基类，绑定 DetailRespVO
public class CustomerreturnRequestMainRespVO
        extends BaseRequestMainPageRespVO<CustomerreturnRequestDetailRespVO> {
}
```

### 7.2 Request 明细 VO

```java
// ⑤ DetailBaseVO：继承方向层
public class CustomerreturnRequestDetailBaseVO extends BaseBidirectionalRequestDetailVO {
    private String soLine;
    private LocalDateTime produceDate;
}

// ⑥ DetailCreateReqVO
public class CustomerreturnRequestDetailCreateReqVO
        extends CustomerreturnRequestDetailBaseVO {
}

// ⑦ DetailUpdateReqVO
public class CustomerreturnRequestDetailUpdateReqVO
        extends CustomerreturnRequestDetailBaseVO {
}

// ⑧ DetailRespVO：继承 PageResp 基类
public class CustomerreturnRequestDetailRespVO
        extends BaseBidirectionalRequestDetailPageRespVO {
}
```

### 7.3 RequestMainService 泛型

```java
public class CustomerreturnRequestMainService extends BaseBidirectionalRequestMainService<
        // 本链
        CustomerreturnRequestMainCreateReqVO,       // 1  ReqMainCreateVO
        CustomerreturnRequestMainUpdateReqVO,       // 2  ReqMainUpdateVO
        CustomerreturnRequestDetailCreateReqVO,     // 3  ReqDetailVO        ← DetailCreateReqVO
        CustomerreturnRequestDetailPageReqVO,       // 4  ReqDetailReqVO
        CustomerreturnRequestMainPageReqVO,         // 5  ReqMainPageReqVO
        CustomerreturnRequestMainRespVO,            // 6  ReqMainPageRespVO
        CustomerreturnRequestMainDO,                // 7  ReqMainDO
        CustomerreturnRequestDetailDO,              // 8  ReqDetailDO
        // Job 链
        CustomerreturnJobMainCreateReqVO,           // 9  JobMainVO
        CustomerreturnJobDetailCreateReqVO,         // 10 JobDetailVO
        CustomerreturnJobDetailPageReqVO,           // 11 JobDetailPageReqVO
        CustomerreturnJobMainPageReqVO,             // 12 JobMainPageReqVO
        CustomerreturnJobMainRespVO,                // 13 JobMainPageRespVO
        CustomerreturnJobMainDO,                    // 14 JobMainDO
        CustomerreturnJobDetailDO,                  // 15 JobDetailDO
        // Record 链
        CustomerreturnRecordMainCreateReqVO,        // 16 RecMainVO
        CustomerreturnRecordDetailCreateReqVO,      // 17 RecDetailVO
        CustomerreturnRecordMainDO,                 // 18 RecMainDO
        CustomerreturnRecordDetailDO                // 19 RecDetailDO
        > {
```

---

## 8. 迁移检查清单

对任意模板化模块，逐项检查：

- [ ] MainBaseVO 存在且泛型约束为 `DetailBaseVO`
- [ ] MainCreateReqVO 绑定 `DetailCreateReqVO`
- [ ] MainUpdateReqVO 绑定 `DetailUpdateReqVO`（与 Create 分属两个类）
- [ ] MainRespVO 继承 `BaseXxxMainPageRespVO`，绑定 `DetailRespVO`
- [ ] DetailBaseVO 继承 `Base(Unidirectional\|Bidirectional)XxxDetailVO`
- [ ] DetailCreateReqVO / DetailUpdateReqVO 分属两个类
- [ ] DetailRespVO 继承 `Base(Unidirectional\|Bidirectional)XxxDetailPageRespVO`
- [ ] RequestMainService 第 3 位 = `DetailCreateReqVO`
- [ ] RequestMainController 第 3 位 = `DetailCreateReqVO`
- [ ] Controller 与 Service 泛型位一一对齐
- [ ] 无父子类同名字段重复声明
- [ ] 子类仅通过 `beforeXxx / afterXxx` 扩展，不做父类方法整段覆写
