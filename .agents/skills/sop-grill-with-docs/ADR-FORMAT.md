# ADR Format

ADRs live in `docs/adr/` as `NNNN-slug.md`. Create the directory lazily.

```md
# {Short title}

{1-3 sentences: context, decision, why.}
```

Optional: Status, Considered Options, Consequences — only when they add value.

Number: highest existing + 1.

Write an ADR only when all three are true: hard to reverse, surprising without context, a real trade-off.
