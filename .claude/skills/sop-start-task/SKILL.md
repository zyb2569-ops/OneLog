---
name: sop-start-task
description: Use when creating a `.work/<slug>/` task so a change can resume across sessions, including 大改动 after a PRD exists, or a 普通改动 that will not finish in this session. Also use when the user says 创建任务, 建个任务, 开任务, 建任务, or sop-start-task.
---

# sop-start-task

在业务仓建进行中任务。不维护「当前任务」指针；`.work/` 里有几个目录就是几件进行中的事。

## 何时建

- **大改动**：必建（有 PRD 要验收和归档）。还没有 `sop-grill-with-docs` 产出的 PRD 时，**不要自己编 PRD**；转去 `sop-grill-with-docs`。
- **普通改动**：仅估计本会话做不完
- **琐碎改动**：不建

用户说「创建任务 / 建个任务 / 开任务」时先分档。大改动未确认或 PRD 未齐：不要建目录，走 `sop-grill-with-docs`。

## 步骤

1. 短名：`yyyy-MM-dd-` + 小写英文/数字/连字符，例如 `2026-08-20-pack-import`。日期取创建当天本地日期。不要省略日期、不要改格式、不要把日期放后缀。若 `.work/<短名>/` 已存在，换名或问用户。
2. 确保 `.gitignore` 含：

```
.work/
.agents/specs/.hits.json
.codegraph/
```

3. 建目录并写文件（从本 Skill `templates/` 拷）：

```
.work/<短名>/
  prd.md       # 仅大改动；把 grill 产出贴进来
  design.md    # 大改动必有；普通+任务可省略
  task.md      # 必有
```

大改动写 `design.md` 之前：**Read** `.agents/skills/sop-trim-cot-leakage/SKILL.md`，边写边守。PRD 仍只走 `sop-grill-with-docs` 的 `doc-voice`，不要对 PRD 跑 trim。

4. `task.md` 必须有：目标（大改动写「见 prd.md」）、设计方案（或「见 design.md」）、影响范围、拟改/已改文件、进度、验收项（大改动从 PRD 抄可勾项；普通改动当场写几条）。

不要写 `implement.md`，不要规定 TDD/分阶段怎么写代码。

5. 写出 `.work/<短名>/` 后**默认停**。不要接着改产品代码。仅当用户同一句明确用了「开工 / 开始改 / 开始写代码 / 实现吧」时，才 `sop-load-specs`（若还没加载）并改代码。「创建任务做 XX」不算开工。
