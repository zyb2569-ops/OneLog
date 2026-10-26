<!-- AGENT-SKILLS:START -->
# Skills 工具包

本仓的编码辅助流程在 `.agents/skills/`。改代码、初始化或跨会话续跑时，先按下面分档，再 **Read 对应 SKILL.md 并按其步骤执行**。不要用记忆或自拟流程替代这些 Skill。不要删本段起止标记；重新跑 `sop-init` 只更新这一段。

## 先分档

模糊则升一档。大改动必须先讲结论和理由，**等人确认**后再写 PRD；确认前不要改产品代码、不要 `sop-start-task`、不要写 `prd.md`。

用户说「创建任务 / 建任务 / 建个任务 / 开任务」时也先分档，不要直接 `sop-start-task`。大改动走 `sop-grill-with-docs`，确认并访谈齐了再 `sop-start-task`。普通改动且估计本会话做不完，才直接 `sop-start-task`。琐碎改动不建任务。

| 档 | 什么情况 | 规范 | PRD | 任务 |
|----|----------|------|-----|------|
| 琐碎 | 错别字、格式、注释、明显一行修复 | 不加载 | 无 | 不建 |
| 普通 | 真改代码，但不改业务流程 / 代码行为 / 上下游 | `sop-load-specs` | 无 | 估计本会话做不完才 `sop-start-task` |
| 大改动 | 改业务流程、代码行为、或影响上下游 | 执行时 `sop-load-specs` | 必有，`sop-grill-with-docs` | 必建，`sop-start-task` |

## 何时用哪个 Skill

场景匹配，或用户提到对应说法时，立刻读并执行该 Skill，不要只口头答应，也不要用记忆或自拟流程替代。

| 场景 / 用户说法 | Skill | 读这个文件 |
|-----------------|-------|------------|
| 第一次进仓、工作路径缺失、初始化、安装工作目录、CodeGraph | `sop-init` | `.agents/skills/sop-init/SKILL.md` |
| 准备写代码、加载规范、选规范编号。琐碎改动除外 | `sop-load-specs` | `.agents/skills/sop-load-specs/SKILL.md` |
| 大改动、PRD、grill、sop-grill-with-docs、需要对齐再动手、写方案 | `sop-grill-with-docs` | `.agents/skills/sop-grill-with-docs/SKILL.md` |
| 已有 PRD 的大改动，或普通改动本会话做不完，需要 `.work/`、跨会话续跑 | `sop-start-task` | `.agents/skills/sop-start-task/SKILL.md` |
| 用户明确说「归档」/ archive。一次 commit 不等于归档 | `sop-archive-task` | `.agents/skills/sop-archive-task/SKILL.md` |
| 用户说「提交」/ commit / 提交代码。不要因为写完代码就提交 | `sop-commit-code` | `.agents/skills/sop-commit-code/SKILL.md` |
| 用户说简化、找死代码、收敛重复、删无用代码 | `sop-find-simplifications` | `.agents/skills/sop-find-simplifications/SKILL.md` |
| 写规范、设计说明、注释、JSDoc 等将进仓库的说明性文字 | `sop-trim-cot-leakage` | 立刻 Read，不必等用户点名 |
<!-- AGENT-SKILLS:END -->
