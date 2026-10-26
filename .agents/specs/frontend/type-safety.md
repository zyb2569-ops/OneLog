# 类型安全

> 本项目的类型安全模式。

---

## 概览

前端基于 TypeScript，但整个代码库更偏向"实用型强类型"，而不是追求极致的类型纯洁性。

当前项目的现实情况：

- 共享 UI 契约放在 `src/types/*.d.ts`
- 环境声明和模块声明放在 `types/*.d.ts`
- 业务请求/响应接口通常定义在 API 模块旁边
- auto-import 声明文件是自动生成并提交进仓库的
- 运行时校验主要依赖 form rules，而不是 schema 校验库

当前 lint 规则允许 `any`，因此类型安全更多依赖团队遵循既有模式，而不是完全依赖编译器做强约束。

示例：

- `ui/src/types/table.d.ts`
- `ui/types/env.d.ts`
- `ui/src/types/auto-imports.d.ts`
- `ui/src/api/dbc/workstation/index.ts`

---

## 类型组织

- 共享应用/UI 类型：
  `ui/src/types/*.d.ts`
- 自动生成的 auto-import/component 声明：
  `ui/src/types/auto-imports.d.ts`
  `ui/src/types/auto-components.d.ts`
- 环境与 Vue 模块声明：
  `ui/types/env.d.ts`
- 功能特定的 payload interface：
  `ui/src/api/<domain>/<feature>/index.ts`

如果某个类型只服务于一个功能，就放在该功能附近；如果它会被多个共享组件或 hook 使用，则移动到 `src/types/`。

---

## 校验

项目中未使用 Zod、Yup 等运行时 schema 校验库。

当前的校验模式：

- 在 `*.data.ts` 页面 schema 文件中声明 Element Plus form rules
- 使用 `@/utils/validator` 中的自定义校验器
- 通过 axios 拦截器处理后端响应码

示例：

- `ui/src/views/dbc/workstation/workstation.data.ts`
- `ui/src/utils/validator.ts`
- `ui/src/config/axios/service.ts`

---

## 常见模式

- 在 `defineStore` 之前先定义明确的 store state interface。
- 功能 payload interface 放在使用它的 API 函数附近。
- 对 schema 驱动的 UI 复用共享泛型类型：
  `CrudSchema`、`FormSchema`、`TableColumn`、`DescriptionsSchema`、`TableFormColumn`
- 对 Vue API 和常用 hook，依赖自动生成的 auto-import 类型声明，而不是手工维护一套声明文件。

示例：

- `ui/src/store/modules/user.ts`
- `ui/src/hooks/web/useCrudSchemas.ts`
- `ui/src/types/table.d.ts`

---

## 时间字段边界类型

后端返回的日期字段，不能只按命名或 Java 类型推断成 `string`。

本仓库多个后端模块启用了 `write-dates-as-timestamps: true`，因此前端在处理 `createTime`、`updateTime`、`readTime`、`dueTime` 等字段时，必须把它们视为边界类型，而不是单一格式。

推荐约束：

- API 响应类型优先声明为 `string | number | null`，不要在接口层直接收窄成纯 ISO 字符串
- 展示层统一经过时间归一化函数，再进入文案或日期格式化逻辑
- 时间归一化至少兼容：
  - ISO 字符串
  - 10 位秒级时间戳
  - 13 位毫秒时间戳
  - 数字字符串形式的时间戳

错误示例：

```ts
const text = row.createTime?.slice(0, 16) ?? '-'
```

上面这种写法隐含假设 `createTime` 一定是字符串。一旦后端返回毫秒时间戳字符串，页面就会直接显示原始数字。

正确方向：

```ts
type BackendDateValue = string | number | null | undefined
```

先把 `BackendDateValue` 归一化为可格式化的 `Date` 或标准时间字符串，再交给组件展示。

---

## 禁止模式

- 当已有共享类型或一个很小的本地 interface 就能表达时，不要继续新增宽泛的 `any`。
- 不要在 `ui/types/env.d.ts` 之外重复声明环境类型。
- 不要手工重建 auto-import 声明行为，应继续使用 `ui/src/types/` 下的生成文件。
- 不要假设每个符号都必须显式 import。本项目有意使用 auto-import 的 Vue API 与 hook，而这些自动生成的声明本身就是类型契约的一部分。
- 不要在页面组件里直接假设后端时间字段一定可被字符串 API 处理，例如直接 `slice()`、`replace()` 或原样渲染。

补充说明：

`@typescript-eslint/no-explicit-any` 当前在 ESLint 中被禁用，因此仓库中存在一定历史 `any`。但对新增代码来说，只要结构明确，仍应优先使用具体的 interface。
