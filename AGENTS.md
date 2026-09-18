# Repository Guidelines

## Project Structure & Module Organization
ECHO is an Electron-packaged, top-down roguelite. `index.html` contains the game UI, CSS, and JavaScript; there is no separate `src/` tree. `main.js` manages the desktop lifecycle and persistence, while `preload.js` exposes the restricted IPC bridge. Operator portraits live in `assets/operators/`; packaging icons live in `build/`. Generated packages go to `dist/` (ignored by Git). Regression suites and golden fixtures live in `tests/` and `tests/fixtures/`. Root-level system documents and `PR*.md` reports explain mechanics and prior validation; `audit_pr*/` directories contain audit material.

## Build, Test, and Development Commands
- `npm ci`: install dependencies from the lockfile.
- `npm start`: launch the game in Electron.
- `npm run dev`: launch with Electron logging enabled.
- `npm test`: run all automatically discovered regression suites.
- `npm run test:list`: list discovered suites.
- `npm run test:grep -- operators`: run suites matching a filename pattern.
- `npm run build`: clean `dist/` and create a Windows x64 portable executable.
- `npm run build:dir`: create an unpacked Windows x64 build.
- `git diff --check`: check patch whitespace before review.

## Coding Style & Naming Conventions
Match nearby JavaScript: two-space indentation, semicolons, and single-quoted strings. Use camelCase for functions/variables and uppercase names for constants. Electron and test files use CommonJS. No formatter or linter is configured; avoid broad reformatting of `index.html`. Preserve existing section boundaries and Portuguese terminology. Keep operator IDs stable: HARDEN uses `warden`, NÔMADE uses `nomad`, and ECHO-0 uses `echo0`.

## Testing Guidelines
Tests use custom Node harnesses, built-in `assert`, and often `vm` with mocked DOM/Canvas APIs. Name suites `tests/<feature>.test.js` for automatic discovery. Store baselines in local fixtures; never require historical Git commits. No coverage percentage is configured. After code changes, run the full suite and report actual suite/check/failure counts. Gameplay, UX, and visual changes also require human playtesting; include reproduction steps and screenshots where useful.

## Commit & Pull Request Guidelines
History uses scoped milestone prefixes such as `PR15.5-F3-ASSETS:` and `AUDIT-FIX-A:`, plus occasional `chore:` messages, usually with Portuguese descriptions. Follow the relevant pattern and describe the concrete change. Use a dedicated branch; never push directly to `main`. PRs should explain scope, behavior changes, validation results, and related issues or audit reports.

## Change Boundaries
Consult `.github/copilot-instructions.md`. Preserve save compatibility, deterministic systems, and approved portraits. Keep Anchored Replay independent of Echo mechanics. Inspect consumers and harnesses before removing symbols; avoid unrelated refactors or balance changes.
## Current Engineering State

- Current baseline: 78 suites, 4939 checks, 0 failures.
- AUDIT-FIX-A is complete: tests no longer depend on Git history.
- `index.html` has approximately 39k LOC, including approximately 38k JavaScript lines in one script.
- There are 132 monkey-patch wrappers across 8 kits. This is architectural debt, not a current bug by itself. Do not add wrappers without strong justification.

## Audit Cleanup Roadmap

- **AUDIT-FIX-A — complete.**
- **AUDIT-FIX-B1 — next:** remove only confirmed dead code and identical duplicates.

Confirmed dead-code candidates: `operatorPortraitFallback`, `nearestTarget`, `nearestHostileEcho`, `eqCatName`, `eqOriginCol`, `rarPower`, `itemStateFlags`.

Confirmed duplicates: `smClearSlotSave`, `smClearSlotEchoes`, `refreshAfterSlotWipe`.

Before removing any symbol, revalidate production usage, `tests/`, audit harnesses, and dynamic/global access.

Exclude from B1: test-only APIs, `ENEMY_VISUAL_PROFILES`, `weaponVisualProfile`, `visualNotify`, `loadMeta`, and `smHas`. Do not touch `echoEq*Mul` without renewed investigation.

- **AUDIT-FIX-B2:** investigate test-only APIs and the visual foundation.
- **AUDIT-FIX-C:** unify meta loading.
- **AUDIT-FIX-D:** reduce lifecycle/monkey-patch risks.
- **AUDIT-FIX-E:** replace fragile source-text tests with behavioral contracts.
- **AUDIT-FIX-F:** incrementally modularize `index.html`.

## Human Gates

The human-playtest requirement above also explicitly covers Character Select, difficulty, bosses, and visual identity. Automated tests do not replace human validation of gameplay, UX, or visual changes.
