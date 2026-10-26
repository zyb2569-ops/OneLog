# 目录结构

> 本项目前端代码的组织方式。

---

## 概览

前端位于 `ui/`，技术栈为 Vite + Vue 3 + TypeScript 的管理后台。

代码按职责组织：

- `src/views/`：页面级业务功能
- `src/api/`：按业务域组织的后端请求封装
- `src/components/`：共享 UI 组件
- `src/hooks/`：可复用组合逻辑
- `src/store/`：Pinia store
- `src/config/axios/`：共享 HTTP 客户端与拦截器
- `src/plugins/`：应用/插件注册
- `src/styles/`：全局主题与样式资源
- `src/types/` 与 `types/`：共享 TypeScript 声明

功能页面通常是 schema 驱动的 CRUD 页面：`index.vue` 负责编排共享组件，同目录下的 `*.data.ts` 负责描述 table、search、form、detail schema。

---

## 目录布局

```text
ui/
├── package.json
├── vite.config.ts
├── src/
│   ├── api/<domain>/<feature>/index.ts
│   ├── components/<Component>/src/*.vue
│   ├── config/axios/{config,index,service}.ts
│   ├── hooks/web/use*.ts
│   ├── layout/
│   ├── plugins/
│   ├── router/
│   ├── store/modules/*.ts
│   ├── styles/
│   ├── types/*.d.ts
│   └── views/<domain>/<feature>/
│       ├── index.vue
│       ├── <feature>.data.ts
│       └── *Form.vue
└── types/
    └── env.d.ts
```

---

## 模块组织

新增前端代码时遵循以下放置规则：

- 页面入口组件放到 `src/views/<domain>/<feature>/index.vue`。
- 若页面使用共享 CRUD 框架，则页面 schema 和字段元数据放在同级 `*.data.ts`，不要散落到 `index.vue`。
- 同级目录通常还会包含 `*Form.vue`、`Detail.vue`、`ImportForm` 等封装文件，用于承载新增/编辑、详情、导入等扩展流程。
- 业务请求封装放到 `src/api/<domain>/<feature>/index.ts`。
- 跨页面共享 UI 放到 `src/components/`。
- 可复用组合逻辑放到 `src/hooks/web/` 或 `src/hooks/event/`。
- 应用级共享状态放到 `src/store/modules/`。
- 环境/全局声明放在 `types/`，自动生成的 auto-import 声明放在 `src/types/`。

如果某个页面可以通过专门的 `src/api/...` 模块拥有自己的业务 API，就不要把这些 API 调用埋进共享组件里。

---

## 命名约定

- 页面入口文件：`index.vue`
- 页面配置/schema 文件：`<feature>.data.ts`
- 弹窗/表单/详情组件：`*Form.vue`、`Detail.vue`、`*Dialog.vue`
- Hook：`useXxx.ts`
- Store 模块：`src/store/modules/<name>.ts`
- 共享组件目录：PascalCase，内部 `src/` 放实现，`index.ts` 做导出
- import 统一使用 `@/` 别名，不使用过深的相对路径

`views/` 和 `api/` 中的目录通常使用小写或 lower camel 的业务命名；可复用组件目录则使用 PascalCase。

---

## 示例

- `ui/src/views/dbc/workstation/index.vue`
- `ui/src/views/dbc/workstation/workstation.data.ts`
- `ui/src/components/BasicForm/index.ts`
- `ui/src/api/dbc/workstation/index.ts`
- `ui/src/components/XButton/index.ts`
- `ui/src/layout/components/UserInfo/index.ts`
- `ui/src/config/axios/service.ts`
