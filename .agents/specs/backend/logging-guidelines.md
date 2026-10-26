# 日志规范

> 本项目的日志实践。

---

## 概览

日志基于 SLF4J，结合 Lombok `@Slf4j` 使用。

仓库中已有两层集中式日志能力：

- `win-spring-boot-starter-web` 中的应用 API 日志
- `win-gateway` 中的网关请求/响应日志

由于请求生命周期日志已由框架集中处理，业务代码只在框架日志不足以表达业务上下文时才需要补充业务日志。

示例：

- `mom/win-framework/win-spring-boot-starter-web/src/main/java/com/win/framework/apilog/core/interceptor/ApiAccessLogInterceptor.java`
- `mom/win-framework/win-spring-boot-starter-web/src/main/java/com/win/framework/web/core/handler/GlobalExceptionHandler.java`
- `mom/win-gateway/src/main/java/com/win/gateway/filter/logging/AccessLogFilter.java`

---

## 日志级别

- `info`
  用于请求生命周期、启动、注册，以及成功的运行事件。
  示例：
  `ApiAccessLogInterceptor`、`AccessLogFilter`、MQ 注册日志。

- `warn`
  用于可恢复的客户端或环境问题，例如参数缺失、访问被拒绝、fallback 路由决策等。
  示例：
  `GlobalExceptionHandler` 中的校验/权限分支，负载均衡 fallback 日志。

- `error`
  用于非预期异常、序列化失败、安全违规、后台任务失败等。
  示例：
  `GlobalExceptionHandler`、`TokenAuthenticationFilter`、websocket 发送失败日志。

- `debug`
  很少使用，仅用于低价值排障。
  示例：
  `win-spring-boot-starter-protection/.../DefaultLockFailureStrategy.java`

---

## 结构化日志

当前项目并非所有调用点都采用 JSON-first 风格，但整体上通过约定形成了结构化日志：

- 使用占位符风格消息并附带上下文值：
  `log.warn("[accessDeniedExceptionHandler][userId({}) 无法访问 url({})]", userId, url)`
- 日志前缀使用方括号包裹方法名或动作名：
  `[preHandle]`、`[afterCompletion]`、`[writeAccessLog]`、`[defaultExceptionHandler]`
- 尽量携带稳定的业务标识：
  URL、userId、serviceId、sessionId、routeId、message type、duration

网关 filter 会进一步构造 map 并输出格式化 JSON，便于请求/响应诊断。

示例：

- `mom/win-framework/win-spring-boot-starter-web/src/main/java/com/win/framework/apilog/core/interceptor/ApiAccessLogInterceptor.java`
- `mom/win-gateway/src/main/java/com/win/gateway/filter/logging/AccessLogFilter.java`
- `mom/win-framework/win-spring-boot-starter-security/src/main/java/com/win/framework/security/core/handler/AccessDeniedHandlerImpl.java`

---

## 应该记录什么

- 非 生产 API 运行时的请求 URL 和耗时，这部分已由 `ApiAccessLogInterceptor` 处理。
- 联调或集成排障时的网关请求/响应元数据，这部分已由 `AccessLogFilter` 处理。
- 在进入全局异常处理前仍需补充业务上下文的异常。
- 会影响路由、MQ 投递、websocket 投递、租户/安全控制的基础设施行为。
- 当框架日志不足以解释失败原因时，记录导入或批处理任务的摘要。

优先记录标识符和数量，不要倾向于直接输出整块领域对象。

---

## 不应该记录什么

- access token、refresh token、password、secret 配置值。
- 每个 controller 中重复的 CRUD 成功日志。框架已记录请求的开始和结束。
- 普通 service 代码中的超大原始 payload。若确实需要 body 级追踪，应依赖 gateway/API 日志层，而不是到处增加临时 body 日志。
- 大块二进制内容或文件内容。
- 敏感用户或租户数据，除非出于安全调查所必需，并且已纳入受保护的日志链路。
