# 状态管理

> 本项目的状态管理方式。

---

## 概览

全局状态使用 Pinia，本地页面状态直接使用 Vue 响应式能力。持久化浏览器缓存通过 `useCache` 和 `wsCache` 处理。

项目中没有专门的 server-state 缓存库（如 Vue Query）。服务端数据通过 `src/api` 模块命令式拉取后存放在：

- Pinia store 中，用于应用级/会话级共享场景
- 页面本地状态或 `useTable` 状态中，用于 CRUD 页面

示例：

- `ui/src/store/index.ts`
- `ui/src/store/modules/user.ts`
- `ui/src/store/modules/app.ts`
- `ui/src/hooks/web/useCache.ts`
- `ui/src/hooks/web/useTable.ts`

---

## 状态分类

- 本地页面状态
  通常在 `index.vue` 或某个 hook 中使用 `ref`、`reactive`。
  示例：
  `ui/src/views/dbc/workstation/index.vue`

- 全局应用状态
  使用 Pinia module 管理认证、权限、布局、语言、tags 等共享关注点。
  示例：
  `ui/src/store/modules/user.ts`
  `ui/src/store/modules/app.ts`

- 持久化浏览器状态
  `useCache` 会把布局、主题、用户数据写入 web storage。
  示例：
  `ui/src/store/modules/app.ts`

- 服务端状态
  通过 `src/api/...` 获取，并按页面或 hook 存放，尤其常见于 `useTable`。
  示例：
  `ui/src/api/dbc/workstation/index.ts`

---

## 何时使用全局状态

当状态需要跨路由共享，或在应用启动阶段就要用到时，使用 Pinia。例如：

- 登录用户信息和权限
- 缓存的角色菜单
- 主题/布局/语言设置
- 全局 loading 和导航设置

不要仅仅因为某个状态是响应式的就把它提升到 Pinia。页面级表单值、筛选条件、弹窗显隐、表格列设置等应保持本地，除非多个相隔较远的页面确实需要共享。

示例：

- 全局：
  `ui/src/store/modules/user.ts`
  `ui/src/store/modules/app.ts`
- 本地：
  `ui/src/views/dbc/workstation/index.vue`

---

## 服务端状态

当前的服务端状态处理方式简单直接：

- API wrapper 统一调用 `src/config/axios` 下的共享 axios 客户端
- `useTable` 统一协调列表加载、分页、排序、删除、导出
- token 刷新逻辑集中在 axios 响应拦截器中处理
- 部分用户/会话数据缓存在 `wsCache` 中

这意味着新增功能通常应按以下方式接入：

1. 新增或更新 `src/api/<domain>/<feature>/index.ts`
2. 在页面或 hook 中接入该 API
3. 除非确实需要共享，否则将拉取到的数据保留在页面本地

示例：

- `ui/src/config/axios/service.ts`
- `ui/src/hooks/web/useTable.ts`
- `ui/src/api/dbc/workstation/index.ts`

---

## 常见错误

- 不要把只属于单页的 CRUD 筛选条件或弹窗状态放进 Pinia。
- 当 `useTable` 或页面本地 `ref/reactive` 已足够时，不要新建全局 store。
- 不要绕过 `useCache`，在各个功能里散落地硬编码 storage key。
- 不要在共享 axios 层之外重复实现 token 刷新逻辑。
