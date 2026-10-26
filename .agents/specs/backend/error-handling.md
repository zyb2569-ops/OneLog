# 异常处理

> 本项目的异常处理方式。

---

## 概览

后端采用集中式异常处理链路：

- Controller 返回 `CommonResult<T>`
- 参数校验使用 `@Validated`、`@Valid` 和 Jakarta Validation 注解
- 业务失败使用 `ServiceException`
- 各模块的 `ErrorCodeConstants` 提供稳定的错误码和错误信息
- `GlobalExceptionHandler` 将异常转换为 `CommonResult.error(...)`，并记录 API 错误日志

这意味着普通 service 代码只需要抛出有意义的业务异常，再交给框架统一翻译。

MES 模块的多语言异常消息、`mes.*` key、`{0}` 占位符和资源文件同步规则，见 [多语言规范](./i18n-guidelines.md)。

---

## 异常类型

仓库中主要的异常类型：

- `ServiceException`
  用于业务规则失败、数据缺失等业务性异常。
  示例：
  `mom/win-framework/win-common/src/main/java/com/win/framework/common/exception/ServiceException.java`

- `ErrorCode`
  在各模块的 `ErrorCodeConstants` 中声明，并传入 `ServiceExceptionUtil.exception(...)`。
  示例：
  `mom/win-module-iotgw/win-module-iotgw-api/src/main/java/com/win/module/iotgw/enums/ErrorCodeConstants.java`

- 校验异常
  例如 `MethodArgumentNotValidException`、`BindException`、`ConstraintViolationException` 等 Spring/Jakarta 异常，统一由 `GlobalExceptionHandler` 处理。

- 非预期框架/运行时异常
  这类异常会落入默认异常分支，并被转换为内部错误的 `CommonResult`。

---

## 异常处理模式

推荐模式：

- 在 service 内用专门的私有方法校验存在性或业务前置条件，校验失败时抛 `exception(ERROR_CODE)`。
- 业务失败使用 `ServiceExceptionUtil.exception(...)`，不要直接 `new RuntimeException(...)`。
- Controller 层的异常翻译和日志记录交给 `GlobalExceptionHandler`。
- `catch` 之后要么转译为明确的业务异常，要么补充上下文后继续抛出；禁止空 `catch` 或只打印日志不处理。
- 只有当业务流程需要累计逐行错误而不是立即中断时，才在 service 方法内部捕获 `ServiceException`，例如 Excel 导入。

示例：

- 存在性校验：
  `mom/win-module-iotgw/win-module-iotgw-biz/src/main/java/com/win/module/iotgw/service/assetparamconfig/AssetParamConfigServiceImpl.java`
- 行级导入错误处理：
  `mom/win-module-dbc/win-module-dbc-biz/src/main/java/com/win/module/dbc/service/workstation/WorkstationServiceImpl.java`
- 统一翻译与日志：
  `mom/win-framework/win-spring-boot-starter-web/src/main/java/com/win/framework/web/core/handler/GlobalExceptionHandler.java`
- 错误格式化工具：
  `mom/win-framework/win-common/src/main/java/com/win/framework/common/exception/util/ServiceExceptionUtil.java`

---

## API 错误响应

标准响应契约为 `CommonResult<T>`。

- 成功路径：
  `CommonResult.success(data)`
- 失败路径：
  `CommonResult.error(code, message)`

关键行为：

- 校验异常由 `GlobalExceptionHandler` 映射为 bad-request 风格响应。
- 权限失败统一翻译。
- 未处理异常会记录为 error，并作为内部服务器错误返回。
- API 错误详情也会在全局处理器中经由 `ApiErrorLogFrameworkService` 落库。

示例：

- `mom/win-module-iotgw/win-module-iotgw-biz/src/main/java/com/win/module/iotgw/controller/admin/assetparamconfig/AssetParamConfigController.java`
- `mom/win-module-dbc/win-module-dbc-biz/src/main/java/com/win/module/dbc/controller/workstation/WorkstationController.java`
- `mom/win-framework/win-spring-boot-starter-web/src/main/java/com/win/framework/web/core/handler/GlobalExceptionHandler.java`

---

## WMS 业务错误码约定

- 用户可见的业务拦截必须使用当前业务域的专用错误码，例如库存转移记录使用 `INVENTORYMOVE_RECORD_*`。
- 不要把可预期的业务失败塞进 `BALANCE_EXCEPTION`、`LOCATION_EXCEPTION` 等泛用错误码占位参数里；泛用错误码会削弱前端识别业务异常的能力，容易展示成“系统异常：【状态码】xxx”这类噪音文案。
- 批量校验命中多个失败对象时，把失败业务键作为专用错误码参数传入，保持 `ServiceExceptionUtil.exception(ERROR_CODE, args...)` 链路，不要直接拼完整异常字符串后抛普通运行时异常。

示例：

```java
Set<String> occupiedPackageNumberSet = balanceDOList.stream()
        .map(BalanceDO::getPackageNumber)
        .collect(Collectors.toCollection(LinkedHashSet::new));

throw exception(INVENTORYMOVE_RECORD_DETAIL_TOPACK_BALANCE_EXISTS,
        String.join(",", occupiedPackageNumberSet));
```

### 查询失败 ErrorCode

适用范围：因数据库或 Feign 查询未命中而抛出的业务异常，典型为 `*_NOT_EXISTS`、`*_BY_CODE_NOT_EXISTS`，以及 i18n key 形如 `wms.*.not.exists` 的错误码。不包含「不能为空」等字段校验失败。

- i18n 文案必须包含 MessageFormat 占位符 `{0}`（复合条件可用 `{1}`…），禁止 `{}`。
- 抛出时必须传入实际查询条件（id、编码、单号、包装号等），使最终异常消息可见查询条件。
- 同一 ErrorCode 的所有抛出点，参数个数必须与占位符一致；禁止部分调用点无参、部分有参。
- 新增或修改 key 时，同步五份 WMS 资源文件：`wms.properties`、`wms_zh_CN.properties`、`wms_en_US.properties`、`wms_es_ES.properties`、`wms_hu_HU.properties`。
- 查询失败不要用 `String.format` 拼整句，统一走 `ServiceExceptionUtil.exception(ERROR_CODE, args...)`。

Good：

```java
// ErrorCodeConstants
new ErrorCode(1_001_001_001, "wms.location.not.exists");

// wms_zh_CN.properties
// wms.location.not.exists=【{0}】库位不存在

throw exception(LOCATION_NOT_EXISTS, locationCode);
```

Bad：

```java
// i18n 无占位符
// wms.balance.not.exists=库存余额不存在

throw exception(BALANCE_NOT_EXISTS);

// 用校验文案承载查询失败
// wms.balance.item.not.exists=查询库存余额 物料不能为空
```

---

## 常见错误

- 业务校验失败不要抛普通 `RuntimeException`。
- 用户可见的业务报错信息不要用 `String.format` 组装，应使用模块约定的异常工具。
- WMS 可预期业务校验失败不要使用 `BALANCE_EXCEPTION` 等泛用错误码承载整句业务文案，应优先使用当前单据/记录/任务域下的专用错误码。
- WMS 查询失败 ErrorCode 的 i18n 必须带 `{0}` 占位符，且 `throw exception(...)` 必须传入查询条件；禁止只抛「xx不存在」而无具体条件。
- MES 模块的 `ErrorCodeConstants` 不要再写中文 message，也不要继续使用 `{}`；必须使用 `mes.*` key 与 `{0}`、`{1}` 风格占位符。
- 不要在 controller 里捕获并吞掉 `ServiceException`，应交给全局异常处理。
- 不要为了"接口返回成功"而吞掉远程调用或持久化异常；失败必须通过 `CommonResult.error(...)` 或异常链路显式暴露。
- Controller 不要重复记录错误日志，因为同一异常往往会在 `GlobalExceptionHandler` 中再次记录。
- 不要返回自定义临时错误 JSON，应统一使用 `CommonResult`。
