# grilling

Interview until shared understanding. Map a **design tree**: every decision branches into the decisions that hang off it.

Work in **rounds**. The **frontier** is every decision whose prerequisites are already settled. Ask the whole frontier in one round. Wait for answers before the next round.

## How to ask

**Prefer a built-in structured question tool** (e.g. Cursor `AskQuestion`) when the host provides one: one form per frontier round; each decision is a question with options; mark the recommended option (e.g. “推荐”). Do not paste the same questions as plain chat text when the tool is available.

**Fallback** — only when no structured question tool exists — use numbered questions in chat:

```
❓ **Q1** - **<title>**: <body, options if any>

➡️ <recommended answer>
```

A question that depends on another still open this round belongs to a later round.

Finding **facts** is the agent's job (filesystem, tools, sub-agents). Don't ask the user what you can look up. **Decisions** are the user's.

The session is done when the frontier is empty. Do not implement until the user confirms shared understanding.
