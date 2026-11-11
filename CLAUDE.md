# Cornrow

Cornrow is a dependency-free maze generation and search library. The parent
oakridge/kbbl conventions (React, Tailwind, Zustand, core/pwa layout, Hono)
do not apply to this repository.

## Standards

- Strict TypeScript, including noUncheckedIndexedAccess and exactOptionalPropertyTypes.
- No `any`: use `unknown` and narrow. No non-null assertions without a comment
  explaining the invariant.
- Use discriminated unions for variants, branded domain ids, and the local
  `Result<T, E>` at IO and validation boundaries. Errors carry an operation and detail.
- Write pure named transforms with co-located unit tests and descriptive names.
- Named exports only in source modules (Vite's configuration requires a default).
- No runtime dependencies. Generator code must never use `Math.random`.
- Core modules must never reference DOM globals, even though DOM types are available
  for later mount code. All mutable algorithm state belongs to a single invocation.

## Layout and dependency direction

`src/primitives` contains Result, brands and seeded randomness. `src/model` owns
the wall-maze and fixtures. `src/generate` owns generation and provenance.
`src/search` owns solver contracts, algorithms and registry. `src/index.ts`
provides the explicit public core API. Future layers are `src/render`,
`src/controller`, and `src/mount`.

Dependencies flow inward: primitives <- model <- generate/search <-
render/controller <- mount. Search contracts do not import solver implementations.

Coordinates are (row, col) from the top-left; node id = row * cols + col.
The 4-neighbour grid uses passage bits N=1, E=2, S=4, W=8: absent passages are
walls. Neighbours are ordered N, E, S, W. Passages are symmetric. Start defaults
to (0,0); goal defaults to (rows-1, cols-1). Every constructor rounds and clamps
each side to 5-80 cells. Non-finite sizes normalize to 5 (positive infinity to 80).
Mazes and their passage arrays are frozen at construction.

The documented sample is seed `cornrow` at 10x10. Any intentional generator
topology change must bump generatorVersion and update the inline ASCII golden.

## Commands

Use Bun: `bun install`, `bun run typecheck`, `bun run test`, `bun run test:watch`.
Commit bun.lock. Vitest defaults to node. Future DOM tests opt in per file with
`// @vitest-environment happy-dom`.

Commit each logical subgoal only after tests and typecheck pass. Stage explicit
paths, never `git add -A`: the untracked `peaks/` tooling directory must not enter
commits. Remote git and PR operations go through gated-review tools.
