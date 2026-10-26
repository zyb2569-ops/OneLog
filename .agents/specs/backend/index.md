# 后端开发规范

> 本项目后端开发最佳实践。

---

## 概览

本目录包含后端开发规范，各文件记录了项目实际使用的约定和模式。

---

## 规范索引

| 规范 | 说明 | 状态 |
|------|------|------|
| [目录结构](./directory-structure.md) | 模块组织与文件布局 | 已定制 |
| [数据库规范](./database-guidelines.md) | ORM 模式、查询、迁移 | 已定制 |
| [代码生成规范](./codegen-guidelines.md) | 按表元数据同构生成 CRUD、Swagger 与前端页面 | 已定制 |
| [配置规范](./config-guidelines.md) | 环境配置来源、配置绑定与功能配置契约 | 已定制 |
| [安全与权限规范](./security-guidelines.md) | Controller 查询接口与非查询接口的权限边界 | 已定制 |
| [异常处理](./error-handling.md) | 异常类型与处理策略 | 已定制 |
| [多语言规范](./i18n-guidelines.md) | MES 模块 i18n key、Locale、资源文件与异常消息契约 | 已定制 |
| [RPC 规范](./rpc-guidelines.md) | Feign、ApiConstants、错误码与跨模块返回体契约 | 已定制 |
| [工作台接口规范](./workbench-api-guidelines.md) | 工作台消息/待办聚合接口、动作矩阵；**`pcUrl` 与 `system_menu` 对齐** | 已定制 |
| [Excel 导入导出规范](./excel-import-export-guidelines.md) | Excel 字典字段 label/value/DO 类型转换契约 | 已定制 |
| [WMS 模板继承规范（入口）](./wms-template-inheritance-guidelines.md) | 选型、继承树、Main/Detail 与 Uni/Bi 边界；子文档导航（原版归档 `*_old.md`） | 已定制 |
| [WMS 模板 · Hook 与迁移](./wms-template-hook-and-migration.md) | 操作—hook 全矩阵、Controller 边界、兼容包装、按链迁移 | 已定制 |
| [WMS 模板 · 逐层属性](./wms-template-layer-attributes.md) | 四项逐层职责；字段只声明一次；同层查询/校验闭环 | 已定制 |
| [WMS 模板 · 上下游生命周期](./wms-template-chain-lifecycle.md) | Request→Job→Record；directCreateRecord 单决策点 | 已定制 |
| [WMS 模板 · 查询与 Mapper](./wms-template-query-mapper-businesstype.md) | businessType 目标契约、分页/导出增强、Mapper | 已定制 |
| [WMS 模板 · 导入导出](./wms-template-import-export.md) | ImportConfig/Workbench；导出仅 before + ExportConfig | 已定制 |
| [WMS 模板 · 验收](./wms-template-acceptance.md) | 验收矩阵、RedisMQ+Support、改造顺序 | 已定制 |
| [WMS 模板 · VO 泛型规范](./wms-template-vo-generic-spec.md) | Request/Job/Record 三条链 VO 继承关系与 Service/Controller 泛型填充规则全表 | 已定制 |
| [质量规范](./quality-guidelines.md) | 代码标准与禁止模式 | 已定制 |
| [WMS 业务类型快照规范](./wms-business-type-snapshot-guidelines.md) | 申请/任务/记录创建时业务类型配置快照字段与写入约定 | 已定制 |
| [日志规范](./logging-guidelines.md) | 结构化日志与日志级别 | 已定制 |
| [注释规范](./comment-guidelines.md) | Javadoc、内联注释及**方法内业务逻辑**注释要求 | 已定制 |

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
