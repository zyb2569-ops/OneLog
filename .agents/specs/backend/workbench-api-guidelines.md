# 工作台消息与待办接口规范

> 约束 `report/workbench` 聚合接口的签名、字段、动作矩阵、降级语义，以及前端仪表盘消息/待办组件的消费方式。

---

## Scenario: 工作台消息与待办聚合接口

### 1. Scope / Trigger

- Trigger: 新增或调整 `ui/src/api/report/workbench/index.ts`、`WorkbenchController`、消息/待办 widget，或扩展新的来源模块、动作编码、字段映射时。
- Scope: 适用于当前 `report` 模块对外暴露的工作台聚合接口，以及仪表盘中的消息组件、待办组件。
- Why: 这组接口是典型跨层契约。若前后端对 `kinds/typeFilters/actions/degradedSources` 的理解不一致，会直接导致角标错误、列表混排错误、动作无效或降级信息被吞掉。

### 2. Signatures

- 后端 Controller 根路径：
  `POST/GET /report/workbench/*`
- 前端消费入口：
  `ui/src/api/report/workbench/index.ts`
- 当前四个正式接口：
  - `GET /report/workbench/type-catalog`
  - `GET /report/workbench/summary`
  - `POST /report/workbench/items/page`
  - `POST /report/workbench/items/actions/execute`
- 统一返回体：
  `CommonResult<T>`
- 列表分页体：
  `WorkbenchPageRespVO { page: PageResult<WorkbenchItemRespVO>, degradedSources: string[] }`

#### 2.1 Controller 签名

```java
@RestController
@RequestMapping("/report/workbench")
public class WorkbenchController {

    @GetMapping("/type-catalog")
    public CommonResult<List<WorkbenchTypeCatalogItemRespVO>> getTypeCatalog()

    @GetMapping("/summary")
    public CommonResult<WorkbenchSummaryRespVO> getSummary()

    @PostMapping("/items/page")
    public CommonResult<WorkbenchPageRespVO> getPage(@Valid @RequestBody WorkbenchPageReqVO reqVO)

    @PostMapping("/items/actions/execute")
    public CommonResult<WorkbenchActionResultRespVO> execute(@Valid @RequestBody WorkbenchActionReqVO reqVO)
}
```

#### 2.2 前端 API 签名

```ts
export const getWorkbenchTypeCatalog = async () =>
  await request.get<WorkbenchTypeCatalogItemVO[]>({ url: '/report/workbench/type-catalog' })

export const getWorkbenchSummary = async () =>
  await request.get<WorkbenchSummaryVO>({ url: '/report/workbench/summary' })

export const getWorkbenchPage = async (data: WorkbenchPageReqVO) =>
  await request.post<WorkbenchPageVO>({ url: '/report/workbench/items/page', data })

export const executeWorkbenchAction = async (data: WorkbenchActionReqVO) =>
  await request.post<WorkbenchActionResultVO>({ url: '/report/workbench/items/actions/execute', data })
```

### 3. Contracts

#### 3.1 当前来源边界

- 当前消息来源只有 `SYSTEM`。
- 当前待办来源只有 `MES`。
- `type-catalog` 当前只服务待办类型目录，不返回消息类型。
- 当前没有 WMS 待办接入；若后续接入，必须同步更新本规范中的来源、动作和降级矩阵。

#### 3.2 `GET /report/workbench/type-catalog`

- 返回值：`WorkbenchTypeCatalogItemRespVO[]`
- 字段契约：
  - `source: string`
  - `category: string`
  - `typeCode: string`
  - `typeName: string`
  - `enabled: boolean`
- 当前实现：直接透传 MES RPC 的类型目录并映射为前端 VO。
- 失败语义：当前实现捕获异常后返回空数组，不返回 `degradedSources`，也不抛业务错误。

#### 3.3 `GET /report/workbench/summary`

- 返回值：

```json
{
  "total": 12,
  "unreadMessageCount": 4,
  "todoCount": 8,
  "bySource": {
    "SYSTEM": 4,
    "MES": 8
  },
  "byType": {
    "SYSTEM_NOTIFY_MESSAGE": 4,
    "MES_WORK_ORDER_RUN": 8
  },
  "degradedSources": []
}
```

- 字段契约：
  - `total = unreadMessageCount + todoCount`
  - `unreadMessageCount` 当前只统计 `SYSTEM` 未读消息
  - `todoCount` 当前只统计 `MES` 待办总数
  - `bySource` 为来源维度统计
  - `byType` 为消息/待办类型维度统计
  - `degradedSources` 表示本次汇总中失败的来源，例如 `["MES"]`
- 降级语义：
  - `SYSTEM` unread 读取失败时，`degradedSources` 加入 `SYSTEM`
  - `MES` 类型目录或待办总数读取失败时，`degradedSources` 加入 `MES`
  - 已降级来源的统计值允许缺失，不应被前端误判为真实 `0`

#### 3.4 `POST /report/workbench/items/page`

- 请求体：

```json
{
  "kinds": ["MESSAGE", "TODO"],
  "typeFilters": ["MES_WORK_ORDER_RUN"],
  "pageNo": 1,
  "pageSize": 20
}
```

- 请求字段：
  - `kinds?: string[]`
    - 可传 `MESSAGE`、`TODO`
    - 为空或缺失时，表示同时查询消息和待办并进行混排
  - `typeFilters?: string[]`
    - 仅对 `TODO` 生效
    - 为空或缺失时，表示不过滤待办类型
  - `pageNo: integer`
    - `@Min(1)`
  - `pageSize: integer`
    - `@Min(1)`
    - `@Max(50)`
- 响应体：

```json
{
  "page": {
    "list": [],
    "total": 0
  },
  "degradedSources": []
}
```

- 查询语义：
  - 只传 `["MESSAGE"]` 时，只查系统消息。
  - 只传 `["TODO"]` 时，只查 MES 待办。
  - 未传 `kinds` 或同时包含二者时，后端分别取消息页、待办页的前 `pageNo * pageSize` 条，再按 `createTime` 倒序混排并切当前页。
- 降级语义：
  - 某来源拉取失败时，该来源返回空列表且将来源名加入 `degradedSources`
  - 其他来源继续返回，接口整体仍为成功态

#### 3.5 `WorkbenchItemRespVO` 统一工作项模型

- 统一字段：

```json
{
  "source": "MES",
  "kind": "TODO",
  "id": "1024",
  "type": "MES_WORK_ORDER_RUN",
  "bizKey": "WO-20260418-001",
  "title": "工单运行待处理",
  "summary": "等待处理",
  "priority": 1,
  "status": "PENDING",
  "createTime": 1744943640000,
  "dueTime": 1744947240000,
  "pcUrl": "/mes/workorder-info-run/index",
  "mobileUrl": null,
  "actions": [
    { "code": "VIEW_DETAIL", "name": "查看详情" }
  ]
}
```

> 上例中 `pcUrl` 仅为**形状示例**；真实取值必须以 base 库 `system_menu` 与浏览器侧栏进入该页的 path 为准，无菜单时为 `null` 且无 `VIEW_DETAIL` 动作。

- 字段说明：
  - `source`: 来源模块稳定字符串，当前为 `SYSTEM` 或 `MES`
  - `kind`: 类别稳定字符串，当前为 `MESSAGE` 或 `TODO`
  - `id`: 工作项主键字符串；动作执行统一用它回源
  - `type`: 业务类型编码；前端待办过滤只认它
  - `bizKey`: 业务主键，可为空
  - `title`: 卡片主标题
  - `summary`: 卡片摘要，可为空
  - `priority`: 优先级，可为空
  - `status`: 状态稳定字符串
  - `createTime/dueTime`: 当前 `report` 模块配置 `write-dates-as-timestamps: true`，应按时间戳契约理解；前端可容忍字符串时间，但不得反向要求后端返回格式漂移
  - `pcUrl/mobileUrl`: 跳转目标；工作台当前实际使用的是 `pcUrl`。**`pcUrl` 必须与 base 库 `system_menu` 登记的前端路由 path 一致**（见 `.trellis/spec/frontend/router-guidelines.md`「动态菜单与站内跳转 path」）；禁止用 Controller `@RequestMapping`、接口 path 或前端猜测后缀代替。无对应菜单时 **`pcUrl` 应为 `null`**，且不得下发依赖跳转的动作。
  - `actions[]`: 当前可展示动作列表，每项至少包含 `code/name`

#### 3.6 消息项映射契约

- `source = SYSTEM`
- `kind = MESSAGE`
- `type = SYSTEM_NOTIFY_MESSAGE`
- `bizKey = String.valueOf(message.id)`
- `title = templateNickname`，空值回退为 `系统消息`
- `summary = templateContent`
- `priority`
  - 未读 `UNREAD` -> `1`
  - 已读 `READ` -> `3`
- `pcUrl = "/user/notify-message"`
- `actions`
  - 未读时：`[{ code: "MARK_READ", name: "设为已读" }]`
  - 已读时：`[]`

#### 3.7 待办项映射契约

- `source = MES`
- `kind = TODO`
- `type = todo.typeCode`
- `bizKey = todo.bizKey`
- `title = todo.title`
- `summary = todo.summary`
- `priority = todo.priority`
- `status = todo.status`
- `createTime = todo.createTime`
- `dueTime = todo.dueTime`
- `pcUrl = todo.pcUrl`：由 MES Provider 配置；**须与 `system_menu` 定稿后的浏览器 path 一致**，无菜单时为 `null`（见前端路由规范「动态菜单与站内跳转 path」）
- `mobileUrl = todo.mobileUrl`
- `actions`（由 `report` 聚合层根据是否可跳转裁剪）：
  - `pcUrl` 非空：仅 `[{ code: "VIEW_DETAIL", name: "查看详情" }]`
  - `pcUrl` 为空：`[]`

#### 3.8 `POST /report/workbench/items/actions/execute`

- 请求体：

```json
{
  "source": "SYSTEM",
  "kind": "MESSAGE",
  "id": "1024",
  "actionCode": "MARK_READ",
  "payload": {}
}
```

- 校验：
  - `source` 非空
  - `kind` 非空
  - `id` 非空
  - `actionCode` 非空
- 当前动作矩阵：

| source | kind | actionCode | payload | 当前行为 |
|------|------|------|------|------|
| `SYSTEM` | `MESSAGE` | `MARK_READ` | 无 | 调用 system 已读单条 |
| `SYSTEM` | `MESSAGE` | `MARK_READ_BATCH` | `{"ids": ["1", "2"]}` | 调用 system 批量已读 |
| `SYSTEM` | `MESSAGE` | `MARK_ALL_READ` | 无 | 调用 system 全部已读 |
| `MES` | `TODO` | `VIEW_DETAIL` | 无 | 返回成功；无后端副作用（实际打开页面以前端 `pcUrl` 为准；无 `pcUrl` 时不应展示该动作） |

- 返回体：

```json
{
  "success": false,
  "code": "workbench.action.not_implemented",
  "message": "当前动作尚未接入"
}
```

- 特殊说明：
  - `MARK_READ_BATCH` 的有效负载在 `payload.ids`
  - `MARK_READ_BATCH` / `MARK_ALL_READ` 虽然 `id` 仍必填，但当前仅作为占位字段，前端分别传 `"BATCH"`、`"ALL"`
  - `VIEW_DETAIL` 当前主要由前端直接使用 `pcUrl` 打开页面；若存在 `pcUrl`，widget 不会先调 execute 接口

#### 3.9 前端组件消费约束

- 消息组件：
  - 请求 `getWorkbenchPage({ kinds: ['MESSAGE'], pageNo, pageSize })`
  - 头部角标读取 `summary.unreadMessageCount`
  - 未读批量选择依赖 `item.status === 'UNREAD'`
  - 显示字段为 `title`、可选 `summary`、可选 `createTime`、`actions`
- 待办组件：
  - 请求 `getWorkbenchPage({ kinds: ['TODO'], typeFilters, pageNo: 1, pageSize })`
  - 头部角标读取 `summary.todoCount`
  - 当前显示字段为 `title`、可选 `source`、可选 `priority`、可选 `summary`、`actions`
  - 待办组件不显示 `status/createTime/dueTime`，但这些字段仍属于接口契约，后续扩展时应保持稳定
- 两个组件都必须展示 `degradedSources`，不能把来源降级误渲染为“暂无数据”

### 4. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| `pageNo < 1` | `@Min(1)` | 参数校验失败 |
| `pageSize < 1 or > 50` | `@Min(1)` + `@Max(50)` | 参数校验失败 |
| `execute` 缺 `source/kind/id/actionCode` | `@NotEmpty` | 参数校验失败 |
| `type-catalog` 拉取 MES 失败 | 服务层降级 | 返回空数组 |
| `summary` 某来源失败 | 服务层降级 | 返回成功态，来源写入 `degradedSources` |
| `page` 某来源失败 | 服务层降级 | 返回成功态，失败来源数据为空并写入 `degradedSources` |
| 消息动作不支持 | 服务层返回业务失败 | `success=false` + `workbench.action.not_supported` |
| 非消息已读动作或未实现动作 | 服务层返回业务失败 | `success=false` + `workbench.action.not_implemented` |
| `MARK_READ_BATCH` 缺 `payload.ids` | 当前实现按空列表处理 | 返回成功，不执行任何已读 |

### 5. Good / Base / Bad Cases

#### Good

- 消息组件只查消息：

```json
{
  "kinds": ["MESSAGE"],
  "pageNo": 1,
  "pageSize": 10
}
```

- 待办组件按类型过滤：

```json
{
  "kinds": ["TODO"],
  "typeFilters": ["MES_WORK_ORDER_RUN"],
  "pageNo": 1,
  "pageSize": 6
}
```

- 批量已读：

```json
{
  "source": "SYSTEM",
  "kind": "MESSAGE",
  "id": "BATCH",
  "actionCode": "MARK_READ_BATCH",
  "payload": {
    "ids": ["1001", "1002"]
  }
}
```

#### Base

- `summary` 负责角标和来源/类型统计。
- `items/page` 负责实际卡片列表。
- `execute` 只处理状态写回或动作确认，不替代前端导航。
- `degradedSources` 是正式响应字段，不是日志辅助信息。

#### Bad

- 把待办过滤错误写成 `sources`：

```json
{
  "kinds": ["TODO"],
  "sources": ["MES"],
  "pageNo": 1,
  "pageSize": 6
}
```

- 把来源降级当成真实空列表：

```json
{
  "page": { "list": [], "total": 0 },
  "degradedSources": ["MES"]
}
```

上面这种响应不能直接渲染成“暂无待办”，必须显示来源降级提示。

### 6. Tests Required

- Controller 契约检查：
  - 断言四个接口路径、HTTP 方法和 `CommonResult<T>` 形状不漂移
- 参数校验检查：
  - 断言 `pageNo/pageSize` 的边界校验生效
  - 断言 `execute` 对 `source/kind/id/actionCode` 的非空校验生效
- 汇总检查：
  - 断言 `total = unreadMessageCount + todoCount`
  - 断言来源失败时 `degradedSources` 被填充而不是直接抛错
- 列表检查：
  - 断言 `kinds=["MESSAGE"]` 只返回消息项
  - 断言 `kinds=["TODO"]` + `typeFilters` 只过滤待办类型，不影响消息
  - 断言混排时按 `createTime` 倒序分页
- 动作检查：
  - 断言 `MARK_READ` 真正回源到 system 已读接口
  - 断言 `MARK_READ_BATCH` 读取 `payload.ids`
  - 断言 `VIEW_DETAIL` 仍为只读型成功返回，不引入后端写副作用
  - 断言 `pcUrl` 为空时待办项 `actions` 为空，避免无菜单仍展示「查看详情」
- 前端联调检查：
  - 断言消息 widget 使用 `summary.unreadMessageCount`
  - 断言待办 widget 使用 `summary.todoCount`
  - 断言组件在 `degradedSources` 非空时展示降级文案

### 7. Wrong vs Correct

#### Wrong

```ts
await getWorkbenchPage({
  kinds: ['TODO'],
  pageNo: 1,
  pageSize: 6
})

// 渲染时直接把空列表视为“暂无待办”
if (resp.page.list.length === 0) {
  emptyText.value = '暂无待办'
}
```

#### Correct

```ts
const resp = await getWorkbenchPage({
  kinds: ['TODO'],
  typeFilters: selectedTypeCodes.length > 0 ? selectedTypeCodes : undefined,
  pageNo: 1,
  pageSize: 6
})

if (resp.degradedSources.length > 0) {
  footerTip.value = `部分来源暂不可用：${resp.degradedSources.join('、')}`
}
```

---

## Source Of Truth

- 后端入口：
  `mom/win-module-report/win-module-report-biz/src/main/java/com/win/module/report/controller/admin/workbench/WorkbenchController.java`
- 后端聚合与映射：
  `mom/win-module-report/win-module-report-biz/src/main/java/com/win/module/report/service/workbench/WorkbenchServiceImpl.java`
- 前端 API：
  `ui/src/api/report/workbench/index.ts`
- 前端消息组件：
  `ui/src/views/report/dashboard/widgets/WorkbenchMessageWidget.vue`
- 前端待办组件：
  `ui/src/views/report/dashboard/widgets/WorkbenchTodoWidget.vue`
