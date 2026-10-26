# 路由规范

> 约束后台页面路由的 `meta` 契约、导航字段和标题复用方式。

---

## Scenario: 页面路由 `meta` 契约与导航行为

### 1. Scope / Trigger

- Trigger: 新增或修改 `ui/src/router/modules/**` 下的后台路由时。
- Scope: 适用于有实际页面含义的路由节点，包括菜单页、隐藏详情页、设计器页、预览页等“可进入页面”的路由。
- 豁免范围: `redirect`、登录页、错误页、纯布局容器、纯分组节点等不承载实际页面展示的路由，可省略 `meta.title` / `meta.icon`。
- Why: 当前项目的 `meta` 不只影响菜单展示，还影响标签页、面包屑、缓存、父菜单高亮，以及导入导出标题命名；如果不把这些字段收编为契约，后续页面会出现导航行为不一致。

### 2. Signatures

- 路由类型：
  `AppRouteRecordRaw`
- 页面路由最小 `meta` 契约：
  `meta.title: string`
  `meta.icon: string`
- 可选 `meta` 字段：
  `hidden?: boolean`
  `alwaysShow?: boolean`
  `noCache?: boolean`
  `breadcrumb?: boolean`
  `affix?: boolean`
  `noTagsView?: boolean`
  `activeMenu?: string`
  `followAuth?: string`
  `canTo?: boolean`
- 典型使用点：
  `route.meta.title`
  `download.excel(data, \`【${route.meta.title}】...\`)`
  `templateTitle: \`【${route.meta.title}】导入模版.xlsx\``

### 3. Contracts

#### 3.1 页面路由必填字段

- 只要该节点对应一个真实页面，`meta.title` 与 `meta.icon` 必填。
- 即使页面是 `hidden: true`，只要允许进入该页面，仍然要提供 `title` / `icon`。
- `title` 必须是用户可见、稳定的页面名称，不要留空字符串，也不要写临时占位文案。
- `icon` 必须使用项目现有图标命名方式，例如：`ep:grid`、`ep:monitor`、`ep:home-filled`。

#### 3.2 可选字段语义

- `hidden`
  控制是否在侧边栏显示。
- `alwaysShow`
  控制父路由在单子路由场景下是否仍强制显示。
- `noCache`
  控制是否进入 `<keep-alive>`。
- `breadcrumb`
  控制是否出现在面包屑中。
- `affix`
  控制是否固定在标签页。
- `noTagsView`
  控制是否进入标签页区域。
- `activeMenu`
  隐藏详情页、设计器页、预览页等需要回挂父菜单高亮时填写。
- `followAuth`
  当路由权限应跟随另一路由判断时填写。
- `canTo`
  隐藏但允许直接跳转的页面填写 `true`。

#### 3.3 `route.meta.title` 的业务复用

- 页面存在导入模板标题、导出文件名、弹窗标题等命名需求时，优先复用 `route.meta.title`。
- 不要在页面里再手写一份和路由标题并行的“页面名常量”，避免菜单标题、导出标题、导入模板标题三处漂移。
- 若页面无稳定标题，不应绕过路由契约临时硬编码，应先补齐该页面路由的 `meta.title`。

#### 3.4 容器与系统路由边界

- `redirect`、登录页、错误页、根布局容器、纯分组节点允许省略 `title` / `icon`。
- 这类节点如果未来开始承载实际页面内容，应同步补齐页面路由必填字段。

### 4. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| 真实页面路由缺 `meta.title` | 页面契约不完整 | 补齐 `title` |
| 真实页面路由缺 `meta.icon` | 页面契约不完整 | 补齐 `icon` |
| 隐藏详情页/预览页可进入但缺 `canTo` | 路由跳转行为不明确 | 补齐 `canTo` |
| 隐藏页需要父菜单高亮但缺 `activeMenu` | 菜单高亮错误 | 补齐 `activeMenu` |
| 页面导入/导出标题与路由标题各写一份 | 命名容易漂移 | 改为复用 `route.meta.title` |
| `redirect/login/error/container` 路由缺 `title/icon` | 属于豁免范围 | 允许 |

### 5. Good / Base / Bad Cases

#### Good

```ts
{
  path: 'manage',
  component: () => import('@/views/report/dashboard/designer/index.vue'),
  name: 'ReportDashboardManage',
  meta: {
    canTo: true,
    hidden: true,
    noCache: true,
    icon: 'ep:grid',
    title: '仪表盘设计器'
  }
}
```

```ts
const excelTitle = ref(route.meta.title)
download.excel(data, `【${excelTitle.value}】【${formatDate(new Date())}】.xlsx`)
```

#### Base

- 菜单页至少具备 `meta.title + meta.icon`。
- 隐藏但可进入的页面至少具备 `meta.title + meta.icon + canTo`。

#### Bad

```ts
{
  path: 'runtime',
  component: () => import('@/views/report/dashboard/runtime/index.vue'),
  name: 'ReportDashboardRuntime',
  meta: {
    hidden: true,
    canTo: true
  }
}
```

```ts
const exportName = '工作台列表'
const templateTitle = '工作台导入模板.xlsx'
```

### 6. Tests Required

- 路由结构检查：
  断言新增页面路由存在 `meta.title` 与 `meta.icon`
- 导航行为检查：
  验证菜单、面包屑、标签页、父菜单高亮符合 `meta` 约定
- 隐藏页检查：
  验证 `hidden + canTo` 页面可直接跳转
- 导入导出检查：
  验证页面导出文件名、导入模板标题跟随 `route.meta.title`
- 豁免检查：
  验证 `redirect/login/error/container` 节点不因缺 `title/icon` 被误判

### 7. Wrong vs Correct

#### Wrong

```ts
{
  path: 'manage',
  component: () => import('@/views/report/dashboard/designer/index.vue'),
  name: 'ReportDashboardManage',
  meta: {
    hidden: true
  }
}

const exportName = '仪表盘设计器导出'
```

#### Correct

```ts
{
  path: 'manage',
  component: () => import('@/views/report/dashboard/designer/index.vue'),
  name: 'ReportDashboardManage',
  meta: {
    hidden: true,
    canTo: true,
    icon: 'ep:grid',
    title: '仪表盘设计器'
  }
}

const exportName = route.meta.title
```

---

## Scenario: 动态菜单与站内跳转 path（`system_menu` 对齐）

### 1. Scope / Trigger

- Trigger: 任意需在登录后 **站内打开** 的页面跳转——包括但不限于：`router.push` / `router.replace` 的目标字符串、后端或配置下发的 **相对 path**、站内信/通知里的站内链接字段等。
- Scope: 凡作为 **`vue-router` 的 `location`（path + 可选 query）** 使用的字符串，须与 **base 库 `system_menu` 所登记菜单** 经前端 `ui/src/utils/routerHelper.ts` 中 `generateRoute` 生成后的 **浏览器地址栏 path** 一致。
- Why: 业务页路由由 **权限菜单动态挂载**；把 **REST `@RequestMapping`**、接口 URL 或「惯例路径」当成页面 path，或对 path 做 **启发式补全**（如自动加 `/index`、多候选依次尝试），会稳定出现 **404** 或无权限路由。

### 2. Signatures

- **权威来源**：`system_menu` 的 `path`、`parent_id`、`component`、`permission` 等（见 `MenuDO`）；父子 path 拼接规则与前端 `generateRoute` / `generateRoutePath` 一致。
- **消费方**：任意承载「站内跳转目标」的字段或配置（例如跨模块 DTO 中的跳转 URL 字段、运营配置、模板占位符）；**不**在本节绑定某一业务模块命名。

### 3. Contracts

- **有菜单**：跳转字符串须与 **侧栏进入同一页面** 时地址栏的 **path（及约定中的 query）** 一致；以库中菜单树为准，**不以** Controller 映射路径为准。
- **无菜单**：不得下发会导致用户点击后进入 **未注册动态路由** 的 path；对应产品能力应改为 **不展示跳转**、或使用外链（`http(s)://`）等非 `vue-router` 解析形态（按业务约定）。
- **禁止**：在前端对「后端下发的站内 path」做自动改写、后缀猜测、多路径轮询等 **未经 `system_menu` 校验** 的兜底逻辑。

### 4. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| 跳转 path 与 `router.resolve` 无匹配 | 与 `system_menu` 生成结果不一致 | 404 或业务侧「无路由」提示；应修正菜单或配置中的 path |
| 仅有接口路径、无对应菜单行 | 未登记动态路由 | 不应对用户暴露该站内 path |
| 用与某 API 前缀相同的字符串冒充页面 path | 未与菜单树核对 | 视为错误配置，须改为库中定稿 path |

### 5. Good / Base / Bad Cases

#### Good

- 在 base 库定位叶子菜单后，用浏览器 **从侧栏进入该页**，将地址栏 path（及约定 query）写入配置或下发字段。
- 菜单未就绪：不下发站内 path，或明确使用外链打开方式（若产品允许）。

#### Base

- 每次新增「可点击跳转」的站内目标，在文档或任务中记录：**`system_menu` 侧可查的标识（如 `permission` / `id`）与最终 path**，便于回归。

#### Bad

- 仅因与某后端 `@RequestMapping` 前缀相同，写死一段 path。
- 在前端对 resolve 失败的路径 **自动拼接 `/index`** 或 **遍历候选 path**。

### 6. Tests Required

- 目标环境：存在对应 `system_menu` 记录，且 `router.resolve(配置的 path).matched.length > 0`（在已登录、已注入动态路由的前提下）。
- 无菜单场景：不应再向用户展示依赖该路由的站内跳转（或行为符合产品对「无菜单」的约定）。

### 7. Wrong vs Correct

#### Wrong

```text
按接口前缀或经验写死 path；resolve 失败则在客户端尝试 path + "/index" 或备选列表
```

#### Correct

```sql
-- 在 base 库按业务自行限定条件（component / path / permission 等）
SELECT id, parent_id, name, path, component, permission
FROM system_menu
WHERE deleted = 0
  /* AND ... */
ORDER BY id;
```

```text
以侧栏进入该页时的浏览器 path 为唯一标准，写回配置或后端字段；前端对站内 path 仅做原样 resolve 与 push（或等价导航），不做路径猜测。
```
