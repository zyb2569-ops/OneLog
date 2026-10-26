# domain-modeling

Sharpen language while grilling. Update files as terms crystallise — don't batch.

## Files

- `CONTEXT.md` at repo root: glossary only, no implementation details.
- `docs/adr/NNNN-slug.md`: only when the ADR bar is met.
- If `CONTEXT-MAP.md` exists, pick the matching context.

Create files lazily.

## During the session

- If the user contradicts `CONTEXT.md`, call it out.
- Vague or overloaded words: propose a canonical term and `_Avoid_` the rest.
- Stress-test relationships with concrete scenarios.
- If the user states how something works, check the code.

## ADR bar (all three)

1. Hard to reverse
2. Surprising without context
3. A real trade-off with rejected alternatives

Skip otherwise. One paragraph is enough.

Formats: [CONTEXT-FORMAT.md](CONTEXT-FORMAT.md), [ADR-FORMAT.md](ADR-FORMAT.md).
