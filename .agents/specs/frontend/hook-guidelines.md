# Hook 规范

> 本项目 Hook 的使用方式。

---

## 概览

Hook 主要放在 `ui/src/hooks/web/` 下，用于封装可复用的 UI 或页面行为。

当前项目大量依赖 hook 来处理：

- 表格/搜索/分页状态
- 表单注册与命令式方法
- 消息与弹窗
- schema 转换
- 页面 loading 及其他应用工具能力

此外，hook 在项目中通过 auto-import 机制全局注册，所以许多文件会直接使用 `useI18n`、`useMessage`、`useTable` 以及 Vue 响应式 API，而无需显式写 import。

示例：

- `ui/src/hooks/web/useTable.ts`
- `ui/src/hooks/web/useForm.ts`
- `ui/src/hooks/web/useMessage.ts`
- `ui/src/hooks/web/useCrudSchemas.ts`
- `ui/src/types/auto-imports.d.ts`

---

## 自定义 Hook 模式

当前仓库常见的 hook 形态：

- 内部状态使用 `ref`、`reactive`、`computed`
- 暴露一个精简的 API 对象，例如 `methods`、`tableMethods`、`register`
- 通过配置接收可插拔回调或 API 函数
- 同时返回原始状态和命令式 helper

典型示例：

- `useForm`
  保存组件 ref，并暴露 `setProps`、`setValues`、`getFormData` 以及 schema 相关方法。
- `useTable`
  负责分页、loading、排序、选择、删除、导出、搜索等行为。
- `useCrudSchemas`
  将一份 `CrudSchema[]` 定义转换为 search、table、form、detail、table-form schema。

这些 hook 是 CRUD 页面架构的核心。新增需求时，优先考虑扩展或复用它们，而不是编写一次性的页面本地逻辑。

---

## 数据获取

项目中没有使用 Vue Query、SWR 之类的 server-state 库。

当前的数据获取模式：

- 请求函数放在 `src/api/.../index.ts`
- 页面把这些函数传给 `useTable` 等 hook
- `src/config/axios/service.ts` 中的 axios 拦截器统一处理认证 header、租户 header、refresh token 重放以及标准错误提示

常见 CRUD 请求拆分方式：

- 普通分页查询：`GET /page`
- 高级查询：`POST /senior`
- 导出：`download` 或 `downloadPost`

示例：

- `ui/src/api/dbc/workstation/index.ts`
- `ui/src/config/axios/service.ts`
- `ui/src/views/dbc/workstation/index.vue`

---

## 命名约定

- Hook 文件统一使用 `useXxx.ts`
- 返回的 helper 分组通常命名为 `methods`、`tableMethods`、`register` 这类名词
- 通用 hook 放在 `src/hooks/web/`，事件类工具可放在 `src/hooks/event/`
- 如果某个 hook 被纳入 auto-import，其公开 API 应保持简单、稳定、可预测，因为很多页面会在没有显式 import 的情况下直接使用它

示例：

- `useTable`
- `useForm`
- `useMessage`
- `usePageLoading`

---

## 常见错误

- 通用 hook 不要在内部写死某个业务域 API，应通过参数注入 API 回调。
- 当 `useTable` 已覆盖分页/搜索/删除/导出模式时，不要在每个页面重复维护一套状态。
- 除非某个状态明确作为返回值暴露，否则不要从 hook 外部直接修改 hook 的内部状态。
- CRUD 页面不要重复实现 schema 推导逻辑，`useCrudSchemas` 已覆盖该场景。
