# 检索电池

给 [taxonomy](../SKILL.md#taxonomy) 用的探针。只扫**这次改到的文件或段落**，不要拿电池当全仓审计。每条命中都要语义判断：电池会误报，也会漏报。零命中不能证明没有泄漏。

## 怎么跑

- 范围就是这次正在写或改的路径，不要默认全仓。
- 排除放在最后，避免后面的 include 又加回来：`--glob '!node_modules/**' --glob '!target/**' --glob '!**/src/test/**' --glob '!**/*.{spec,test}.*' --glob '!**/__snapshots__/**' --glob '!**/*.snap' --glob '!.agents/skills/sop-trim-cot-leakage/**' --glob '!**/skills/sop-trim-cot-leakage/**'`。本 Skill 目录会引用泄漏原句，命中不算正文泄漏。
- 自然语句加 `-i`。第一行代码型模式不要加 `-i`，否则 `\bT\d\b`、`\bP-I\b` 会变成噪音。

## 英文

```sh
rg -n --hidden '\(decision \d|\(audit [A-Z]\d|design §|plan §|design ledger|\(B ruling|\bP-I\b|\bW\d\b|\bT\d\b' <这次的路径>
rg -n --hidden -i 'this PR|this branch|this stack|later PR|previous commit|this commit' <这次的路径>
rg -n --hidden -i 'used to |no longer|previously|the old |was renamed|was moved' <这次的路径>
rg -n --hidden -i '\bv1\b|this cut|\bcut \d|\btoday\b|\bfor now\b|roadmap' <这次的路径>
rg -n --hidden -i 'rejected in review|review round|reviewer|as of v\d' <这次的路径>
rg -n --hidden -i 'probably |should be enough|should suffice|it simply|is safe —|is safe --' <这次的路径>
rg -n --hidden '§\d' <这次的路径>
```

## 中文

```sh
rg -n --hidden '设计稿|评审|上一?轮|旧版|老的|不再|以前|本版|遗留|这次 PR|本分支' <这次的路径>
```

## 常见误报

- **工具性 used to** — "the key used to sign requests" 是工具，不是时间。时间用法前面有旧状态（"colors used to come from…"）。
- **运行时旧/新** — 「旧连接排空后新连接才接」说活对象，不是仓库史。
- **讲 PR 流程的文档** — 「PR 正文应写…」可留；禁的是某篇说明用「这一次 PR」谈代码。
- **协议路径里的 v1** — `/v1/chat` 是标识符，不是版本戳。
- **有主人的 §N** — RFC、自己规定章节号的已提交文档可按节引用。
- **生成时间戳里的 today** — 录下来的输出保持原话。
- **「本版本」** — 版本化产物里可以。禁的是对着「这一刀」说话的「本版」。
