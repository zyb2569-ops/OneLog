# 配置规范

> 后端功能配置、环境配置与配置绑定约定。

---

## 概览

当业务能力需要新增可部署配置时，优先把同一逻辑域的配置收敛为一组稳定的 key，并通过单一配置对象绑定，不要在 service 中散落多个 `@Value`。

在当前工作区的 `win-module-report` 模块中，功能级环境配置以模块内 `src/main/resources/application-<profile>.yaml` 为准。不要把功能契约文档写成依赖某个外部配置中心的 dataId，否则很容易让实现和联调入口脱节。

需要额外注意：序列化相关配置同样属于接口契约的一部分，不是“纯后端内部实现”。例如 `write-dates-as-timestamps` 会直接改变前端拿到的时间字段 wire format，因此任何涉及接口联调、前端展示、跨模块复用的方案，都必须把这类配置写入契约说明。

---

## Scenario: 日期序列化配置属于跨层契约

### 1. Scope / Trigger
- Trigger: 模块新增或继承 Jackson 日期序列化配置，例如 `write-dates-as-timestamps`。
- Trigger: 接口对外返回 `LocalDateTime`、`LocalDate`、`Duration` 等时间相关字段。

### 2. Contracts

- `application.yaml` 中的 Jackson 时间序列化配置会直接决定 API 返回格式，必须视为后端到前端的公开契约。
- 如果模块启用了 `write-dates-as-timestamps: true`，则前端不能默认把 `LocalDateTime` 字段当成 ISO 字符串处理。
- 文档、接口说明、联调答复中，描述时间字段时必须写清楚真实 wire format，不能只写 Java 类型。
- 修改这类配置时，要同步检查前端展示、第三方消费者、历史接口兼容性。

### 3. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| 只看 DTO 里的 `LocalDateTime` 就认定前端收到字符串 | 检查真实接口返回与模块 YAML | 前端展示原始时间戳或解析失败 |
| 修改 Jackson 时间序列化配置但未通知消费者 | 检查跨层调用点 | 产生隐式兼容性破坏 |
| 设计文档只写“时间字段”未写格式 | 评审时补充 wire format | 视为契约信息不完整 |

---

## Scenario: Report 模块 Superset 嵌入配置

### 1. Scope / Trigger
- Trigger: 新增或调整 `win.report.dashboard.superset.*` 这类被后端 runtime 直接消费的功能配置。
- Trigger: 配置会跨越 `resources -> Spring 绑定 -> service -> API 错误码` 多层边界，需要明确代码绑定方式、环境文件位置和缺失时的报错行为。

### 2. Signatures

Java 配置绑定：

```java
@ConfigurationProperties(prefix = "win.report.dashboard.superset")
public record SupersetEmbedProperties(
        String baseUrl,
        String username,
        String password) {
}
```

环境文件：

```text
mom/win-module-report/win-module-report-biz/src/main/resources/application-local.yaml
mom/win-module-report/win-module-report-biz/src/main/resources/application-dev.yaml
mom/win-module-report/win-module-report-biz/src/main/resources/application-test.yaml
mom/win-module-report/win-module-report-biz/src/main/resources/application-prod.yaml
```

YAML key：

```yaml
win:
  report:
    dashboard:
      superset:
        base-url: ""
        username: ""
        password: ""
```

---

## Scenario: 微服务部署配置最小集

### 1. Scope / Trigger
- Trigger: 新增或调整服务注册、配置中心、Gateway 路由、Feign 客户端、鉴权相关配置时。
- Trigger: 需求虽然最终部署在 Nacos / Gateway / Spring Cloud 环境里，但仓库内仍需保留可定位、可验证的最小配置契约。

### 2. Signatures

配置键或等价配置入口通常包括：

```yaml
spring:
  application:
    name: report-service
  cloud:
    nacos:
      discovery:
      config:
    gateway:
      routes:
```

```java
@FeignClient(name = ApiConstants.NAME)
```

### 3. Contracts

- 如果模块以微服务方式部署，`spring.application.name` 使用小写 + 中划线命名。
- 环境配置按 `dev / test / prod` 拆分；禁止把密码、密钥、token 等敏感值明文写入仓库。
- 敏感配置通过环境变量、加密配置或部署态注入，不通过聊天说明替代真实配置点。
- Gateway 路由、Feign 超时、重试和安全相关最小集必须能在仓库配置或共享配置类中定位，禁止“默认就行”。
- 当回答或文档同时涉及本地 profile YAML 与部署态配置中心时，必须明确区分两者，避免把运行时契约写成模糊的“自行去 Nacos 配”。

### 4. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| 服务名混用大小写/下划线 | 使用小写 + 中划线 | 视为配置契约错误 |
| 敏感值明文进仓库 | 必须改走环境变量或密文配置 | 拒绝提交 |
| Feign 无超时配置 | 必须能定位超时与重试 | 视为阻断项 |
| Gateway/安全关键配置缺失 | 最小可运行配置必须可发现 | 视为部署风险 |

### 5. Good / Base / Bad Cases

#### Good

- 文档明确说明“模块内 `application-<profile>.yaml` 负责本地运行，Nacos/部署态配置负责环境覆盖”。
- Feign 客户端可在配置文件或 `RpcConfiguration` 中定位超时配置。

#### Base

- 服务可本地启动，部署态覆盖项有明确键名与来源。

#### Bad

- 文档只写“去 Nacos 配一下”但仓库里没有键名、没有 profile、没有超时配置。

### 3. Contracts

- 配置来源：`win-module-report-biz` 模块内的 `application-<profile>.yaml`。
- 配置绑定：通过单一 `SupersetEmbedProperties` 对象注入 service，不在同一逻辑域混用多个 `@Value`。
- `base-url` 表示 Superset 根地址，不包含尾部 `/api/...` 路径。
- `username` / `password` 表示服务端固定 Superset 身份，供 dashboard 列表、embedded config 与 guest token 调用复用。
- 当前 Superset 部署下，后端不要把 `/api/v1/security/login` 返回的 bearer token 当成浏览器登录态替代品。`dashboard` 目录、embedded config、guest token 都应先走 `/login/` 表单登录拿到 session cookie，再通过 `/api/v1/security/csrf_token/` 获取 API CSRF token。
- 允许配置值为空字符串，以便代码在运行时通过业务错误码显式暴露配置缺失，而不是在应用启动时直接失败。
- 文档和答复里都应把上述 3 个 key 说明为本地 profile 配置项，不要把它们表述成必须写入 Nacos dataId。

### 4. Validation & Error Matrix

| 场景 | 入口 | 期望行为 | 备注 |
|---|---|---|---|
| `base-url` / `username` / `password` 任一为空 | `page` / `resolve` / runtime | 抛 `report.dashboard.bi.config.missing` | 不静默降级 |
| 配置存在但账号密码错误 | Superset login | 抛 `report.dashboard.bi.auth.failed` | 由 service 统一翻译 |
| 仅使用 `/api/v1/security/login` 的 bearer token 调 dashboard 目录 | `page` / `resolve` | 可能出现“UI 里有 dashboard，但 API 列表为空” | 当前部署需要浏览器式 session 登录 |
| 配置存在但 dashboard 未开启 embedded | `resolve` / runtime | 抛 `report.dashboard.bi.embed.failed` 或资源无效错误 | 取决于远端返回 |
| 文档仍声称去 Nacos 配置 | 设计/联调 | 视为契约错误 | 应修正文档和 code-spec |
| `application.yaml` 把消息源写成 `spring.application.messages.*` | API 错误返回 | 前端直接看到 i18n key | 必须改成 `spring.messages.*` |

### 5. Good / Base / Bad Cases

#### Good

- 在对应环境的 `application-<profile>.yaml` 中填写 `win.report.dashboard.superset.*`。
- 后端通过 `SupersetEmbedProperties` 统一读取配置。
- 后端按浏览器登录语义先请求 `/login/`，再提交表单并复用 session cookie。
- 未配置时，页面接口显式返回 `report.dashboard.bi.config.missing`。

#### Base

- 环境文件已存在 key，但值仍为空字符串。
- 服务可以正常启动。
- 首次访问 Superset 目录或解析接口时返回配置缺失错误，便于联调定位。

#### Bad

- 在 `DashboardBiResourceServiceImpl` 中继续写多个 `@Value("${win.report.dashboard.superset...}")`。
- 只改聊天答复，不在仓库里的环境文件补出真实配置点。
- 把功能配置位置写成某个 Nacos dataId，而代码和联调实际上都看模块内 profile YAML。
- 把模块消息源写到 `spring.application.messages.basename`，导致 `MessageUtils` 无法解析 `report.*` 键。

### 6. Tests Required

- `mvn -pl win-module-report-biz -am -DskipTests compile`
  - 断言新增 `@ConfigurationProperties` 绑定后模块仍可编译。
- `rg -n "@Value\\(\" mom/win-module-report/win-module-report-biz/src/main/java/com/win/module/report -S`
  - 断言不再为 Superset 配置保留散落的 `@Value`。
- 手工接口校验：
  - 配置为空时，`/report/dashboard-bi-resource/page` 返回 `report.dashboard.bi.config.missing`。
  - 配置正确时，`page` / `resolve` 能继续访问 Superset。

### 7. Wrong vs Correct

#### Wrong

```java
@Value("${win.report.dashboard.superset.base-url:}")
private String supersetBaseUrl;
@Value("${win.report.dashboard.superset.username:}")
private String supersetUsername;
@Value("${win.report.dashboard.superset.password:}")
private String supersetPassword;
```

```text
“去 Nacos 的 report-server-local.yaml 配置 Superset 账号密码”
```

#### Correct

```java
@Resource
private SupersetEmbedProperties supersetEmbedProperties;
```

```yaml
win:
  report:
    dashboard:
      superset:
        base-url: ""
        username: ""
        password: ""
```
