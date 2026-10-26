# 前端开发规范

> 本项目前端开发最佳实践。

---

## 概览

本目录包含前端开发规范，各文件记录了项目实际使用的约定和模式。

---

## 规范索引

| 规范 | 说明 | 状态 |
|------|------|------|
| [目录结构](./directory-structure.md) | 模块组织与文件布局 | 已定制 |
| [路由规范](./router-guidelines.md) | 页面路由 `meta`、导航行为、标题复用；**站内跳转 path 与 `system_menu` 对齐（禁止猜路由）** | 已定制 |
| [组件规范](./component-guidelines.md) | 组件模式、Props、组合 | 已定制 |
| [CRUD 页面规范](./crud-page-guidelines.md) | `index.vue + *.data.ts + api` 页面骨架与共享 CRUD 契约 | 已定制 |
| [交互与安全规范](./feedback-security-guidelines.md) | 消息提示、loading、防重复提交、XSS 与数值处理 | 已定制 |
| [Hook 规范](./hook-guidelines.md) | 自定义 Hook、数据获取模式 | 已定制 |
| [状态管理](./state-management.md) | 本地状态、全局状态、服务端状态 | 已定制 |
| [质量规范](./quality-guidelines.md) | 代码标准与禁止模式 | 已定制 |
| [类型安全](./type-safety.md) | 类型模式与校验 | 已定制 |
| [注释规范](./comment-guidelines.md) | Vue/TS 注释规则及**组件内业务逻辑**与契约联动说明 | 已定制 |

---

## 如何维护这些规范

每份规范文件应当：

1. 记录项目**实际使用的约定**（而非理想状态）
2. 包含来自代码库的**代码示例**
3. 列出**禁止模式**及其原因
4. 记录团队踩过的**常见错误**

目标是帮助 AI 助手和新团队成员理解本项目的实际运作方式。

---

**语言**：所有文档使用**简体中文**编写。
