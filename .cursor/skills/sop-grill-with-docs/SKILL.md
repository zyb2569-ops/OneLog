---
name: sop-grill-with-docs
description: Use when a change would alter business flow, code behavior, or upstream/downstream systems and needs a PRD; or when the user says grill, 大改动, PRD, 需要对齐再动手, or sop-grill-with-docs.
---

# sop-grill-with-docs

大改动访谈。边问边写术语和 ADR，对齐后产出 PRD。实现方法不在这里规定。

未得到用户确认「这是大改动」之前，不要写产品代码、不要 `sop-start-task`、不要写 `prd.md`。

## 步骤

1. 若用户还没确认大改动：先给出结论和理由，停。确认后再继续。用户只说「创建任务 / 建个任务」，但改动会改业务流程、代码行为或上下游时：同样先给出「这是大改动」的结论和理由，停。
2. 读本目录 [grilling.md](grilling.md)，按设计树一轮问完整个 frontier，等用户回答再问下一轮。提问**优先用内置结构化提问工具**（如 `AskQuestion`）；只有宿主没有这类工具时，才在对话里用编号问题 + 推荐答案。事实自己查，决策留给用户。没问完不准进入写 PRD。
3. 读 [domain-modeling.md](domain-modeling.md)。术语一锤定音就写入当前仓库 `CONTEXT.md`（格式见 [CONTEXT-FORMAT.md](CONTEXT-FORMAT.md)）。三条都满足才写 ADR（格式见 [ADR-FORMAT.md](ADR-FORMAT.md)）：难逆转、缺了会让人奇怪、当时有过取舍。
4. frontier 空了、用户确认理解一致后，按 [prd-template.md](prd-template.md) 写出 **PRD 初稿**。
5. **文档文风 pass（仅 PRD，必做）**：Read [doc-voice.md](doc-voice.md)。启动 **fresh subagent**，传入 PRD 初稿 + `doc-voice.md`，按该文件产出审计表与修订稿。主 agent 做保真核对：决策、验收项、边界含义须与初稿一致，且无典型 AI 套话残留。通过后才可下一步；失败则**阻塞** `sop-start-task`，不得落盘 `prd.md`。主 agent 自改冒充 pass、或未 Read `doc-voice.md` 就落盘，均视为不合格。
6. 调用 `sop-start-task` 把 pass 后的 PRD/设计/任务落到 `.work/<短名>/`。不要把 PRD 只留在对话里。
7. 之后改代码前用 `sop-load-specs`。对照 PRD 验收，不对照聊天记录。

不要调用名为 `grilling` / `domain-modeling` 的外部 Skill；协议已在本目录。
