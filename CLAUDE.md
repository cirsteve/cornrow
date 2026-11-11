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
  Renderer/playback programmer-error guards have the documented exception below.
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
commits.

## Renderer and playback boundary

The playback pipeline is model <- search contract <- trace <- render <- controller.
`trace` folds contract events without knowing a solver implementation. `render`
imports only its own modules, model, trace and search-contract types. Generation
and search import nothing from render or controller; `render/import-boundary.test.ts`
enforces these boundaries. Wall masks in the view model use N=1, E=2, S=4, W=8
for walls present (the inverse of model passage bits).

The DOM-free controller receives its generator, solver descriptors, frame scheduler
and render callback by injection. Replay uses the recorded event log. Drawing uses
CSS pixels through DrawingSurface; Canvas owns device pixel ratio and explicit
resize. Browser frame globals are resolved only when createAnimationFrameScheduler
is called. DOM mounting and lifecycle handling belong to the later mount layer.

The renderer/playback APIs retain the cohort's direct-return and void signatures.
`computeLayout`, `advanceAccumulator`, `createCanvasSurface`/`CanvasSurface.resize`
and controller speed/solver selection guards intentionally throw `RangeError` for
invalid caller configuration. These are programmer-error preconditions: positive
grid dimensions, finite nonnegative surface sizes, positive DPR/speed, valid timing
limits and a registered solver. Mutable operations check these preconditions before
changing state. Zero surface dimensions and negative elapsed time are supported
(hidden surfaces and elapsed time clamped to zero, respectively). This is a narrow
exception to the Result convention, preserving the specified renderer/playback
contracts without adding an error branch to each valid frame. The later mount
layer should validate user input with `Result` before calling these APIs; expected
solve outcomes (found, unreachable, cancelled) remain discriminated values.

## Mount layer

`src/mount` is the browser-facing boundary. Browser lifecycle APIs belong only
here; the renderer's injected Canvas adapter and frame-scheduler factory retain
their documented DOM-free import behavior. Importing the public API never reads
DOM globals. Mount appends its own wrapper and shadow-root style, leaving host
attributes, document.head and document stylesheets untouched.

Every listener, observer, media-query listener, controller subscription and rAF
registration goes through the local disposables collector. Destroy drains it and
removes the wrapper. Host suspension and explicit user pause are separate intents.

Mount tests opt into happy-dom per file and use
`src/mount/test-support/instrument-globals.ts` to verify balanced registrations,
no pending frames, preserved host content and unchanged global styles. Normalise
user options before invoking controller APIs; `getSolver` supplies Result-based
solver validation. Seed entropy is injected into the pure normaliser at mount.

`bun run dev` serves the tiny `demo/` host through Vite. It mounts exclusively via
`mountCornrow` from the public entry. Keep the manual keyboard, touch and live
reduced-motion checklist with screenshots in the PR body; this is a review
process step, not an additional application feature.

## Distribution and background mode

`bun run build` runs Vite's ESM library build then tsc declaration emit into
`dist/`. `npm pack` runs that build through prepack; `npm pack --dry-run` must
contain only dist/, package.json, README.md and LICENSE. `bun run example:pack`
packs and installs the tarball in the independent static examples/host-page.
Serve it with `python3 -m http.server 4174 --directory examples/host-page`.

No module reachable from src/index.ts may touch DOM/window globals at load
time, enforced by src/public-entry.node.test.ts. Browser APIs are resolved only
inside mount calls (including the injected Canvas and frame-scheduler factories).
Mode-specific behavior belongs in the mount layer. Background mode reuses the
controller, host signals and disposables; its pure phase function owns transitions
and its hold clock advances only with frame-scheduler timestamps.

`npm publish` is operator-only, after confirming the package name and MIT licence.
