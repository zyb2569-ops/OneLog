---
name: sop-load-specs
description: Use when about to write or change non-trivial code, when selecting project 规范 by number, when recording spec hits, or when the user says 加载规范 / sop-load-specs. Skip typos, formatting, comments, and one-line obvious fixes.
---

# sop-load-specs

按需注入业务仓 `.agents/specs/` 里的规范。编号是当次菜单号；命中按文件路径计。

## 先分档

| 档 | 做什么 |
|----|--------|
| 琐碎 | 错别字/格式/注释/明显一行。**停，不要跑本 Skill。** |
| 普通 | 跑本 Skill。不写 PRD。估计本会话做不完才 `sop-start-task`。 |
| 大改动 | 改业务流程、代码行为或上下游。先给结论和理由，**等人确认**，再 `sop-grill-with-docs`。确认前不要加载规范、不要改产品代码。 |

模糊则升一档。

## 步骤

在业务仓根目录：

```bash
node .agents/skills/sop-load-specs/scripts/specs.mjs list
```

把编号表给用户看（或自己选）。多选：

```bash
node .agents/skills/sop-load-specs/scripts/specs.mjs pick "1,3,7"
```

PowerShell 必须给编号加引号。然后 **Read 选中的每个文件**。若没选中该层 `index.md`，仍要读所选文件所在层的 `index.md`，并在改完后对照「改完对照什么」。

没有 Node：按同样规则自己扫 `frontend` / `backend` / `common` 的 `index.md`、其中的 `.md` 链接、以及同目录其它 `.md`（忽略点文件）。编号跨三层连成一张表，层顺序固定为 frontend → backend → common，每层 `index.md` 最先。选中后给 `.agents/specs/.hits.json` 里对应 posix 路径 +1。

## 不要

- 不要在会话开始时无故加载
- 不要按菜单号记命中
- 不要擅自改规范正文（只能建议）
- 规范目录不存在时：说明需要 `frontend/index.md`、`backend/index.md`、`common/index.md`，可从本 Skill 的 `templates/` 拷贝，不要编造规范内容
