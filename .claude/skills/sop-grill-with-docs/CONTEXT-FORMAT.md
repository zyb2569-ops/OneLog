# CONTEXT.md Format

## Structure

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction
```

## Rules

- Be opinionated. One concept, one word; others go under `_Avoid_`.
- One or two sentences. What it IS, not what it does.
- Only terms unique to this context. General programming concepts do not belong.
- Group under subheadings when clusters emerge.

## Single vs multi-context

One `CONTEXT.md` at repo root unless `CONTEXT-MAP.md` exists. Create lazily when the first term is resolved.
