# 安全与权限规范

> 约束 Controller 查询接口与非查询接口的权限边界，以及权限注解写法。

---

## Scenario: Controller 查询接口与写接口权限边界

### 1. Scope / Trigger

- Trigger: 新增或修改 `mom/**/controller/**` 下的 HTTP 接口时。
- Scope: 适用于所有管理后台 Controller，包括标准 CRUD、导入导出、状态切换、发布、运行时解析等接口。
- Why: 当前项目中手写 Controller 较多；如果查询接口和写接口的权限边界不一致，很容易出现同模块不同人写法漂移，导致权限策略难以统一维护。

### 2. Signatures

- 查询接口：
  `@GetMapping`
  `@PostMapping`（仅当查询条件必须走请求体时）
- 非查询接口：
  `@PostMapping`
  `@PutMapping`
  `@DeleteMapping`
- 权限注解：
  `@PreAuthorize("@ss.hasPermission('<module>:<resource>:<action>')")`
- 返回体：
  `CommonResult<T>`
- 常见动作后缀：
  `create`
  `update`
  `delete`
  `import`
  `export`
  `enable`
  `disable`
  `publish`
  `save`

### 3. Contracts

#### 3.1 查询接口

- 查询接口不加权限限制。
- 查询接口按“业务语义”判断，而不是只按 HTTP 方法判断。
- 只要接口职责是读取、分页、详情、运行时上下文查询、解析只读资源等查询行为，即使使用 `POST` 提交复杂查询体，也按查询接口处理。
- 查询接口仍需保留 `@Operation`、`@Parameter`、`@Valid`、`CommonResult` 等既有契约。

#### 3.2 非查询接口

- 只要接口会新增、修改、删除、导入、导出、启停、发布、保存或触发其他业务动作，就必须加权限限制。
- 非查询接口统一使用 `@PreAuthorize("@ss.hasPermission('...')")`。
- 权限串格式保持：
  `<module>:<resource>:<action>`
- `action` 必须与业务动作一致，不要把写接口标成 `query`。

#### 3.3 混合型 Controller

- 同一个 Controller 可以同时存在“查询接口无权限”和“写接口有权限”两种模式。
- 不要因为同 Controller 里已经有写接口权限注解，就顺手给所有查询接口补一个 `query` 权限。
- 历史查询接口若已经带 `query` 权限，在被修改时应优先向当前规则收敛。

### 4. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| 查询接口添加了 `query` 权限注解 | 与当前权限边界不一致 | 去掉 `@PreAuthorize` |
| 非查询接口缺少权限注解 | 权限约束缺失 | 补齐 `@PreAuthorize` |
| 写接口错误使用 `query` 作为 action | 权限语义错误 | 改成真实动作后缀 |
| `POST` 只读解析接口未加权限 | 属于查询接口 | 允许 |
| 导出/导入/启停/发布接口未加权限 | 属于非查询接口 | 视为实现缺失 |

### 5. Good / Base / Bad Cases

#### Good

```java
@GetMapping("/get")
@Operation(summary = "获得仪表盘")
public CommonResult<DashboardRespVO> getDashboard(@RequestParam("id") Long id) {
    DashboardDO dashboard = dashboardService.getDashboard(id);
    return success(DashboardConvert.INSTANCE.convert(dashboard));
}
```

```java
@PostMapping("/create")
@Operation(summary = "创建仪表盘")
@PreAuthorize("@ss.hasPermission('report:dashboard:create')")
public CommonResult<Long> createDashboard(@Valid @RequestBody DashboardCreateReqVO createReqVO) {
    return success(dashboardService.createDashboard(createReqVO));
}
```

```java
@PostMapping("/resolve")
@Operation(summary = "解析 Superset 仪表盘嵌入上下文")
public CommonResult<DashboardBiResourceResolveRespVO> resolveDashboardBiResource(
        @Valid @RequestBody DashboardBiResourceResolveReqVO resolveReqVO) {
    return success(dashboardBiResourceService.resolveDashboardBiResource(
            resolveReqVO.getResourceId(), resolveReqVO.getResourceTitle()));
}
```

#### Base

- `get/page/list/detail/runtime/context/resolve` 这类查询语义接口不加权限注解。
- `create/update/delete/import/export/enable/disable/publish/save` 这类非查询接口必须带权限注解。

#### Bad

```java
@GetMapping("/page")
@Operation(summary = "获得分页")
@PreAuthorize("@ss.hasPermission('report:dashboard:query')")
public CommonResult<PageResult<DashboardRespVO>> getPage(@Valid PageParam pageVO) {
    return success(service.getPage(pageVO));
}
```

```java
@PutMapping("/publish-to-home")
@Operation(summary = "发布首页")
public CommonResult<Boolean> publishToHome(@RequestParam("id") Long id) {
    service.publish(id);
    return success(true);
}
```

### 6. Tests Required

- 注解检查：
  断言查询接口没有 `@PreAuthorize`
- 权限检查：
  断言非查询接口缺权限时返回 403 或项目既有拒绝结果
- 语义检查：
  断言 `POST` 的只读解析/查询接口不会因为方法类型被误加写权限
- 回归检查：
  验证 create/update/delete/import/export/publish/save 等接口的权限串 action 与业务动作一致

### 7. Wrong vs Correct

#### Wrong

```java
@GetMapping("/page")
@Operation(summary = "获得分页")
@PreAuthorize("@ss.hasPermission('report:dashboard:query')")
public CommonResult<PageResult<DashboardRespVO>> getPage(@Valid PageParam pageVO) {
    return success(service.getPage(pageVO));
}

@PutMapping("/save-my-page")
@Operation(summary = "保存页面配置")
public CommonResult<DashboardMyPageRespVO> saveMyDashboardPageConfig(
        @Valid @RequestBody DashboardMyPageSaveReqVO saveReqVO) {
    return success(service.saveMyDashboardPageConfig(saveReqVO));
}
```

#### Correct

```java
@GetMapping("/page")
@Operation(summary = "获得分页")
public CommonResult<PageResult<DashboardRespVO>> getPage(@Valid PageParam pageVO) {
    return success(service.getPage(pageVO));
}

@PutMapping("/save-my-page")
@Operation(summary = "保存页面配置")
@PreAuthorize("@ss.hasPermission('report:dashboard:save')")
public CommonResult<DashboardMyPageRespVO> saveMyDashboardPageConfig(
        @Valid @RequestBody DashboardMyPageSaveReqVO saveReqVO) {
    return success(service.saveMyDashboardPageConfig(saveReqVO));
}
```
