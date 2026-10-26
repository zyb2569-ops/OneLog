# 多语言规范

> 约束 MES 模块的多语言消息解析、错误码 key、占位符和资源文件维护方式。

---

## Scenario: MES 模块多语言消息与异常

### 1. Scope / Trigger

- Trigger: 当修改 `com.win.module.mes` 下的 `ErrorCodeConstants`、抛出业务异常、编写校验消息，或新增 `mes.*` 文案 key 时，必须遵循本规范。
- Scope: 适用于 Spring Boot 3 / JDK 17 环境下，不新增业务依赖的后端多语言改造。
- Why: 该流程涉及 HTTP Locale 解析、`LocaleContextHolder`、`MessageSource`、异常处理链路和资源文件同步；若实现不一致，会出现中英文不切换、占位符错位或 key 缺失。

### 2. Signatures

- 默认语言配置：
  `win.i18n.default-locale`
- Locale 解析：
  `WinLangFirstLocaleResolver`
  `MesWebI18nConfiguration`
  `LocaleContextHolder.getLocale()`
- 业务异常入口：
  `MesServiceExceptionUtil.message(String key, Object... args)`
  `MesServiceExceptionUtil.exception(ErrorCode errorCode, Object... args)`
- 消息解析：
  `messageSource.getMessage(errorCode.getMsg(), args, errorCode.getMsg(), locale)`
- 资源文件：
  `src/main/resources/i18n/mes.properties`
  `src/main/resources/i18n/mes_zh_CN.properties`
  `src/main/resources/i18n/mes_en_US.properties`
- 中文扫描正则：
  `[\u4e00-\u9fa5]`

### 3. Contracts

#### 3.1 Locale 来源

- 默认语言来自 `win.i18n.default-locale`。
- HTTP 请求优先由 `Win-Lang` 头解析，次选 `Accept-Language`。
- `DispatcherServlet` 将解析结果写入 `LocaleContextHolder`。
- 异步线程必须继承提交线程的 Locale 上下文；Locale 传递应依赖现有 `TaskDecorator` / 线程上下文方案，禁止自行 new `Locale` 或写死语言。

#### 3.2 错误码与消息 key

- `com.win.module.mes.enums.ErrorCodeConstants` 的第二个参数必须是 i18n key，不得再写中文文案。
- key 统一使用 `mes.` 前缀，例如：
  `mes.workstation.ability.not_exists`
- 业务代码统一通过 `MesServiceExceptionUtil` 取消息；禁止虚构 `I18nConfig`、`MessageUtils` 等不存在的工具。

#### 3.3 占位符

- `ErrorCodeConstants` 中的占位符必须使用 MessageFormat 风格：
  `{0}`、`{1}`
- 禁止继续使用 `{}`。
- 抛异常时参数数量必须与占位符数量一致。

#### 3.4 资源文件

- 新增 `mes.*` key 时，必须同时写入三份文件：
  `mes.properties`
  `mes_zh_CN.properties`
  `mes_en_US.properties`
- `mes.properties` 作为兜底文件，不允许只写某一种语言。
- `spring.messages.basename` 必须指向 `i18n/mes`，不得误写成 `spring.application.messages.*`。

#### 3.5 中文替换范围

- 必须处理：
  `throw new ...("中文")`
  `ValidationResult.fail("中文")`
  `Assert.*("中文")`
  `@NotBlank(message = "中文")`
- 中文扫描使用 `[\u4e00-\u9fa5]`。
- 日志消息如 `log.error/info/debug("中文")` 不在本轮 i18n 替换范围。

### 4. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| `ErrorCodeConstants` 第二参数仍是中文 | 必须为 `mes.*` key | 拒绝提交，继续改造 |
| 占位符仍为 `{}` | 必须改为 `{0}` / `{1}` | 拒绝提交，继续改造 |
| `exception(...)` 传参数量不匹配 | 与 key 文案占位符数量一致 | 单测失败或运行时显式报错 |
| 新增 key 只写一个 properties 文件 | 三份资源文件必须同时存在 | `ErrorCodeConstantsI18nCompletenessTest` 应失败 |
| 业务代码直接调中文字符串 | 必须改为 `MesServiceExceptionUtil` 或校验注解 key | 拒绝提交，继续改造 |
| Locale 手工指定 | 只能来自 `LocaleContextHolder` | 视为实现错误 |
| 中文扫描误把日志纳入改造 | 日志 message 需排除 | 回退错误替换，按规则重做 |

### 5. Good / Base / Bad Cases

#### Good

```java
public static final ErrorCode WORKSTATION_ABILITY_NOT_EXISTS =
    new ErrorCode(1_202_001_000, "mes.workstation.ability.not_exists");

throw MesServiceExceptionUtil.exception(WORKSTATION_ABILITY_NOT_EXISTS, abilityCode);
```

`mes_zh_CN.properties`

```properties
mes.workstation.ability.not_exists=工位技能配置不存在：{0}
```

`mes_en_US.properties`

```properties
mes.workstation.ability.not_exists=Workstation ability configuration does not exist: {0}
```

#### Base

- 读取请求头解析 Locale。
- 通过 `MesServiceExceptionUtil` 抛业务异常。
- 三份资源文件都存在同名 key。

#### Bad

```java
throw new ServiceException(400, "工位技能配置不存在");
throw MesServiceExceptionUtil.exception(WORKSTATION_ABILITY_NOT_EXISTS, "{}");
@NotBlank(message = "名称不能为空")
```

### 6. Tests Required

- Locale 解析测试：
  断言 `Win-Lang` 优先于 `Accept-Language`
- 异常翻译测试：
  断言同一个 `ErrorCode` 在 `zh_CN`、`en_US` 下返回不同文案
- 完整性测试：
  断言三份 `mes*.properties` 的 key 集合一致
- 占位符测试：
  断言 `{0}`、`{1}` 被正确替换，参数数量不匹配时显式失败
- 中文扫描测试：
  使用 `[\u4e00-\u9fa5]` 扫描 Java 文件，排除日志 message，重点检查异常、断言、校验注解
- 配置测试：
  断言 `spring.messages.basename=i18n/mes`

### 7. Wrong vs Correct

#### Wrong

```java
public static final ErrorCode WORK_ORDER_NOT_EXISTS =
    new ErrorCode(1_202_001_001, "工单不存在：{}");

throw new ServiceException(WORK_ORDER_NOT_EXISTS.getCode(), "工单不存在");
```

#### Correct

```java
public static final ErrorCode WORK_ORDER_NOT_EXISTS =
    new ErrorCode(1_202_001_001, "mes.work.order.not_exists");

throw MesServiceExceptionUtil.exception(WORK_ORDER_NOT_EXISTS, workOrderCode);
```
