# doc-voice

`sop-grill-with-docs` 写 PRD 初稿后的**文风 pass**。只改 register，不改契约。未执行本 pass 就 `sop-start-task` 落盘 `prd.md`，视为不合格。

## 适用

| 对象 | 是否强制 pass |
|------|----------------|
| PRD 全文 | **是** |
| `CONTEXT.md` 新条目 | 否（写作时遵守 protected spans 与本 register） |
| ADR 正文 | 否（同上） |
| 访谈对话、`task.md` / `design.md` | 不在范围 |

## 目标 register

场景固定为 **`docs`**（PRD / 设计说明 register）。

- **在说事，不在表演聪明。** 每句问：是在陈述事实/决策，还是在用类比、反转、 punchline 证明作者会写？
- **直接、具体、可核对。** 目标语域参考：内部设计说明、维基百科技术条目——不端着，也不滑到 Mintlify 式 coaching，更不滑到公众号腔。
- **力度 `minimal`～`standard`。** 禁止 `aggressive`（易删决策、伤术语）。允许删整句空话、并相邻事实句；**禁止**为去味删掉验收项或已拍板决策。

## Protected spans

改写时**允许改表述，禁止改含义**：

- 「已拍板的决策」各条及其理由（决策结论、因果方向不变）
- 「验收项」各条的可观察条件（可改措辞，不可改测什么）
- 「不做什么」边界
- `CONTEXT.md` 中已定的 canonical term 与 `_Avoid_`
- 模块名、接口名、配置项、命令、报错原文
- 数字及其修饰对象（「3 个模块」不能变成「若干模块」）
- 责任主体与各自动作/目标的配对
- 用户原话引用

完整短语与结构清单见 [doc-voice-phrases.md](references/doc-voice-phrases.md)、[doc-voice-structures.md](references/doc-voice-structures.md)。

## 必做清理

先跑 **nofluff 两问**（与清单冲突时以两问为准）：

1. 删掉这句，信息有没有损失？没有就删。
2. 读者问「这具体指什么」，能否用事实回答？不能则是空话。

再按下面清理（详见 references）：

- **Tier-1 套话**：「值得注意的是」「综上所述」「这不仅…更是…」、无出处「研究表明」等
- **二元对比骨架**：「不是 X，而是 Y」→ 直接写 Y
- **空总结**、段末价值拔高、段末单行 punchline
- **压缩标点**：句中 `：` 引解释、三个以上 `、` 串并列 → 拆句或改列表；`——` 能拆则拆
- **中文 coaching「你」**：PRD 默认删非对比场景的「你」「你可以」；保留「你的 agent vs 别人的 agent」这类真对比
- **表演动词/黑话**：「落地、收口、赋能、抓手、闭环、兜住、打穿、命中（非断言/测试语境）」→ 换成具体动作名
- **禁止同义词轮换**：关键词该重复就重复
- **协作对话痕迹**：「希望有帮助」「如需我可以…」等 chatbot 收尾

## 执行（subagent）

**必须由 fresh subagent 执行**（主 agent 刚写完初稿，自读易漏 tell）。主 agent 只做保真核对与放行/阻塞。

### 交给 subagent 的输入

1. PRD 初稿全文
2. 本文件 `doc-voice.md`
3. 指令摘要：
   - 场景 `docs`，力度 `minimal`～`standard`
   - 产出**审计表** + **修订稿**
   - 不得删改 protected spans 的含义

### Subagent 步骤

1. 按 protected spans 标记不可改义段落
2. 逐段清理（nofluff 两问 + 必做清理 + references）
3. **保真回读**：决策、验收项、数字、责任主体与初稿一致
4. **残留味回读**（按需）：空收尾、narrator 腔（「这说明…」）、节奏过匀
5. **可选自检**（不强制打分交差）：四指标趋向 0—— staged reversal（「不是…而是…」）、破折号 `——`/`—`、句中顿号串并列、句中冒号引解释

### Subagent 输出格式

```md
## 审计表

| 位置 | 原文摘录 | 类别 | 处理 |
|------|----------|------|------|
| … | … | 套话/二元对比/… | 删/改/保留 |

## 修订稿

（完整 PRD 正文）
```

### 主 agent 放行条件

- 已 Read 审计表与修订稿
- 逐条对照：决策、验收项、边界与初稿**含义一致**
- 无明显 Tier-1 残留、无大面积 coaching「你」
- 通过 → 用修订稿进入 `sop-start-task`；不通过 → **阻塞落盘**，让 subagent 再改或主 agent 手工修后重跑 pass

## 与模板的关系

- [prd-template.md](prd-template.md) 章节结构**不变**；pass 只改各节表述
- 写 `CONTEXT.md` / ADR 时不强制 subagent pass，但遵守本节 protected spans 与 register

## 不合格路径

- 未 Read `doc-voice.md` 就落盘 `prd.md`
- 主 agent 自改 PRD 冒充 pass（未走 subagent）
- 保真回读失败仍 `sop-start-task`
- 为去味删除或弱化验收项 / 已拍板决策
