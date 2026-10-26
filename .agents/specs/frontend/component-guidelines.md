# 组件规范

> 本项目组件的构建方式。

---

## 概览

大多数前端组件都是使用 `<script setup lang="ts">` 的 Vue SFC。

目前主要有两类组件风格：

- 位于 `src/views/.../index.vue` 的页面编排组件
- 位于 `src/components/...` 和 `src/layout/components/...` 的可复用共享组件

页面组件通常会复用 `ContentWrap`、`Table`、`Search`、`BasicForm`、`Detail`、`ImportForm` 等现有积木，而不是从零开始直接拼 Element Plus CRUD UI。

示例：

- `ui/src/views/dbc/workstation/index.vue`
- `ui/src/components/XButton/src/XButton.vue`
- `ui/src/layout/components/UserInfo/src/UserInfo.vue`

---

## 组件结构

典型页面结构：

1. template 中使用共享布局 wrapper 和 slot
2. `<script setup lang="ts">`
3. 导入 API、schema、共享 hook，以及本地 refs/state
4. 事件处理函数中调用共享 hook 或 API 模块

标准 CRUD 页面通常按以下顺序编排：

1. `ContentWrap + Search`
2. `ContentWrap + TableHead`
3. `ContentWrap + Table`
4. `BasicForm` / `Detail` / `ImportForm` 等弹窗或抽屉

其中字段元数据、rules、table/search/form/detail 配置应来自同级 `*.data.ts`，而不是写死在页面组件里。

典型共享组件结构：

- 实现文件放在 `src/<Name>.vue`
- 通过 `index.ts` 重新导出

示例：

- 页面编排：
  `ui/src/views/dbc/workstation/index.vue`
- CRUD 表单容器：
  `ui/src/components/BasicForm/index.ts`
- 共享组件导出模式：
  `ui/src/components/XButton/index.ts`
- 布局组件导出模式：
  `ui/src/layout/components/UserInfo/index.ts`

---

## Props 约定

当前可观察到的 props 约定：

- 可复用组件通常通过强类型 props，以及 `src/types/` 或组件本地类型文件来暴露公共接口。
- 页面组件通常把配置对象、回调、API、schema 传给共享组件，而不是定义大量页面本地 props。
- 重 schema 组件接收 `allSchemas`、`rules`、API handlers，而不是写死 form/table 定义。
- 对设计器/属性面板这类“接收外部配置对象并允许直接编辑”的组件，不要在 `setup` 阶段把 `props.config` 快照成普通常量后长期持有；如果父组件会在同一实例上切换到另一份配置，子组件必须使用 `toRef/computed` 跟随 props 变化，或由父组件通过稳定 `key` 强制重建实例。

示例：

- `ui/src/views/dbc/workstation/index.vue`
  向 `BasicForm` 传入 `formAllSchemas`、`rules`、`apiCreate`、`apiUpdate`。
- `ui/src/hooks/web/useCrudSchemas.ts`
  定义了被多个组件消费的强类型 schema 对象。
- `ui/src/types/table.d.ts`
  包含应用内复用的 table props 类型。
- `ui/src/views/report/dashboardMvp/designer/index.vue`
  在同类型 widget 间切换属性面板时，通过 `:key="selectedItem.i"` 保证实例边界；对应属性组件内部也使用响应式 `props.config` 引用。

---

## 样式模式

当前样式体系由以下部分混合组成：

- `src/styles/` 下的全局 SCSS
- `src/styles/variables.scss` 和 `src/styles/var.css` 中的主题变量
- Element Plus 组件样式
- UnoCSS 工具类支持

`vite.config.ts` 会在 SCSS 预处理中注入 `variables.scss`，因此共享样式 token 应放在那里，而不是在各组件中重复声明。

示例：

- `ui/src/styles/index.scss`
- `ui/src/styles/variables.scss`
- `ui/vite.config.ts`

---

## 可访问性

当前代码库没有很强的自定义无障碍层。项目现状是：

- 大多数 CRUD UI 借助 Element Plus 提供基础语义能力
- 交互控件通常带可见文本标签
- schema 驱动的表单通常显式定义字段 label

新增代码时，优先沿用这套方式：

- 优先使用 Element Plus 表单控件，而不是纯 `div` 拼交互
- 在 schema 和按钮中保留可见文本标签
- 如果文本按钮能够满足场景，就避免只放图标按钮

示例：

- `ui/src/views/dbc/workstation/workstation.data.ts`
- `ui/src/views/dbc/workstation/index.vue`

---

## 常见错误

- 当项目已经采用同级 `*.data.ts` 模式时，不要把大段 CRUD 字段定义直接内联到 `index.vue`。
- 标准后台 CRUD 场景不要绕过 `Table`、`Search`、`BasicForm`、`Detail` 这些共享封装。
- 已经有 `TableHead + defaultButtons` 时，不要每个页面再新造一套顶部按钮结构。
- `@/` 可用时，不要再写很深的相对路径导入。
- 避免在组件里继续新增调试用 `console.log`。旧文件里虽然存在，但新代码不应扩大这种模式。
- 对可复用属性面板或编辑器组件，不要写 `const config = props.config` 这类一次性引用并假设父组件不会切换 props；这会在同类型组件复用实例时把修改落到旧对象上。
