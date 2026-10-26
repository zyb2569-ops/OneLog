# RPC 规范

> 约束模块间 Feign 接口、RPC 路径、模块常量与错误码枚举契约。

---

## Scenario: 模块 RPC 接口与枚举契约

### 1. Scope / Trigger

- Trigger: 新增或调整 `*-api` 模块的 Feign 接口、DTO、`ApiConstants`、`DictTypeConstants`、`ErrorCodeConstants`，或在 `*-biz` 中实现 RPC 入口时。
- Scope: 适用于当前多模块 Spring 服务之间通过 API 模块共享契约的场景。
- Why: 若模块常量、Feign 名称、RPC 路径和返回体不统一，会出现调用方无法发现服务、路径漂移、错误码不可追踪等问题。

### 2. Signatures

- API 模块目录：
  `mom/win-module-${module}/win-module-${module}-api/src/main/java/...`
- 业务实现目录：
  `mom/win-module-${module}/win-module-${module}-biz/src/main/java/.../api`
- Feign 接口：
  `@FeignClient(name = ApiConstants.NAME)`
- 路径常量：
  `String PREFIX = ApiConstants.PREFIX + "/<resource>"`
- 返回体：
  `CommonResult<T>`
- 模块枚举文件：
  `ApiConstants.java`
  `DictTypeConstants.java`
  `ErrorCodeConstants.java`

### 3. Contracts

#### 3.1 模块职责

- `*-api` 只放共享契约：
  DTO
  Feign 接口
  常量
  错误码
  共享枚举
- `*-biz` 负责实现，对外 RPC 实现类落在模块内 `api` 包。
- 业务模块之间只能依赖对方 `*-api`；禁止跨模块直连数据库或直接依赖对方 `*-biz` 实现。

#### 3.2 Feign 与路径

- `@FeignClient(name = ...)` 必须引用模块自己的 `ApiConstants.NAME`。
- RPC 路径常量统一通过 `ApiConstants.PREFIX + "/<resource>"` 组合，禁止手写分散字符串。
- 现有内部 RPC 以稳定契约为优先，默认延续 `@PostMapping(PREFIX + "/...")` 风格；若历史接口已使用其他方式，新增实现必须保持调用方兼容。
- `@Operation`、`@Parameter` 应补齐对外语义。

#### 3.3 返回体与枚举

- RPC 接口统一返回 `CommonResult<T>`。
- `ApiConstants` 表达模块名称与前缀。
- `DictTypeConstants` 表达字典项常量。
- `ErrorCodeConstants` 表达稳定业务错误码；错误码按四段式维护：
  `1_模块编号_功能编号_错误编号`
- 对外返回值不直接暴露枚举类型或包含枚举字段的 POJO；需要稳定字符串/数值契约时，先转换为 DTO 字段。

#### 3.4 配置与实现

- Feign 超时、重试和相关客户端配置必须可在配置层或共享 `RpcConfiguration` 中发现。
- `RpcConfiguration` 这类本地配置只放业务模块的 `framework/rpc/config/`。
- RPC 实现仍遵循统一异常处理与日志规范，不在接口层吞异常。

### 4. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| `@FeignClient` 直接写字符串服务名 | 必须复用 `ApiConstants.NAME` | 视为契约漂移，拒绝提交 |
| RPC 路径散落在注解字符串里 | 必须收敛到 `PREFIX` | 继续重构 |
| 接口返回原始 List/DTO | 必须包裹 `CommonResult<T>` | 视为跨模块契约错误 |
| `*-api` 依赖 `*-biz` | API 模块只能被引用 | 视为分层错误 |
| 错误码不在 `ErrorCodeConstants` | 统一纳入模块错误码 | 拒绝提交 |
| 返回 DTO 直接携带枚举类型 | 先转换为基础类型字段 | 视为外部契约不稳定 |

### 5. Good / Base / Bad Cases

#### Good

```java
@FeignClient(name = ApiConstants.NAME)
@Tag(name = "RPC 服务 - 物料基础数据")
public interface BarBasicApi {

    String PREFIX = ApiConstants.PREFIX + "/bar-basic";

    @PostMapping(PREFIX + "/select-list-by-relate-number")
    CommonResult<List<BarBasicRespDTO>> selectListByRelateNumber(@RequestParam("relateNumber") String relateNumber);
}
```

#### Base

- API 模块提供 Feign 接口、错误码和常量。
- BIZ 模块通过本地 `RpcConfiguration` 或共享 starter 注入客户端。
- 所有跨模块结果统一包裹 `CommonResult<T>`。

#### Bad

```java
@FeignClient(name = "report-server")
public interface ReportApi {

    @GetMapping("/report/select")
    List<ReportRespDTO> select();
}
```

### 6. Tests Required

- 静态检查：
  `rg -n "@FeignClient|ApiConstants|DictTypeConstants|ErrorCodeConstants" mom/win-module-*`
- 编译检查：
  `mvn -pl <affected-api-or-biz-module> -am -DskipTests compile`
- 契约检查：
  断言新增接口使用 `CommonResult<T>`，并且路径由 `PREFIX` 组合。
- 配置检查：
  断言本地 Feign 相关配置可在 `RpcConfiguration` 或配置文件中定位。

### 7. Wrong vs Correct

#### Wrong

```java
@FeignClient(name = "wms")
public interface WarehouseApi {

    @PostMapping("/selectListByRelateNumber")
    List<BarBasicDTO> selectListByRelateNumber(@RequestParam String relateNumber);
}
```

#### Correct

```java
@FeignClient(name = ApiConstants.NAME)
public interface WarehouseApi {

    String PREFIX = ApiConstants.PREFIX + "/warehouse";

    @PostMapping(PREFIX + "/select-list-by-relate-number")
    CommonResult<List<BarBasicRespDTO>> selectListByRelateNumber(@RequestParam("relateNumber") String relateNumber);
}
```
