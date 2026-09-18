\# ECHO — COPILOT PROJECT INSTRUCTIONS



\## Repository

\- Repository: DanielJarude/echojogo

\- Permanent development branch: dev/pr15-5-f3-assets

\- Never work directly on main.

\- Use a dedicated working branch for implementation tasks unless explicitly instructed otherwise.



\## Validation baseline

Current known baseline after AUDIT-FIX-A:

\- 78 suites

\- 4939 checks

\- 0 failures



After code changes:

\- run `npm test`;

\- run `git diff --check`;

\- report actual suite/check/failure counts.



Automated tests do NOT replace human playtest for:

\- gameplay;

\- UX;

\- visual changes;

\- operator appearance;

\- Character Select;

\- difficulty;

\- boss behavior;

\- faction visual identity.



\## Engineering workflow

Before modifying code:

1\. Inspect the current implementation.

2\. Identify all consumers.

3\. Check tests and harnesses.

4\. Explain the intended change.

5\. Prefer the smallest safe diff.



Do not:

\- refactor unrelated systems;

\- rebalance gameplay outside explicit scope;

\- change save format without explicit approval;

\- alter art without explicit approval;

\- add new wrapper layers casually;

\- remove compatibility code without proving it is unused;

\- push directly to main.



\## Critical design invariants



\### Anchored Replay / Repetição Ancorada

Repetição Ancorada must remain independent from:

\- Echo;

\- Memory Director;

\- confidence;

\- Resonance;

\- allied Echo;

\- hostile/dark Echo.



Never add:

\- extra Echo attacks;

\- duplication;

\- confidence bonuses;

\- shared consumption;

\- offensive coupling;

\- DPS linkage between Echo and Repetição.



\### ECHO-0

ECHO-0 is the playable operator `echo0`.



It must remain conceptually and mechanically separate from:

\- allied Echo;

\- hostile/dark Echo;

\- Temporal Presence;

\- Memory Director;

\- Repetição Ancorada.



\## Canonical operator IDs

\- VECTOR = vector

\- WRAITH = wraith

\- BULWARK = bulwark

\- PYRE = pyre

\- HARDEN = warden

\- NÔMADE = nomad

\- ECHO-0 = echo0

\- REVENANT = revenant



\## Operator portraits

Official portrait assets:

\- assets/operators/vector.png

\- assets/operators/wraith.png

\- assets/operators/bulwark.png

\- assets/operators/pyre.png

\- assets/operators/harden.png

\- assets/operators/nomade.png

\- assets/operators/echo-0.png

\- assets/operators/revenant.png



Do not replace the official portraits with procedural portraits.



Procedural portrait code may exist only as an explicit fallback when already intended by the current implementation.



\## Current engineering audit status

A general code audit has already been completed.



Important findings:

\- `index.html` is approximately 39k LOC.

\- Approximately 38k lines are JavaScript in one script.

\- 132 monkey-patch wrappers exist across 8 integration kits.

\- Several core functions have wrapper chains up to 8 levels.

\- No current P0 issue was found.

\- Electron layer is generally sound.

\- Save/Continue is generally sound.

\- Sandbox/DEV isolation is generally sound.



Do not assume architectural debt is a current bug.



\## AUDIT cleanup roadmap



\### AUDIT-FIX-A — DONE

Test suite no longer depends on Git history.



The current permanent branch contains:

\- local semantic/golden fixtures;

\- shallow clone safety test;

\- no automated test dependency on historical `git show <SHA>` baselines.



Do not reintroduce historical Git dependencies into automated tests.



\### AUDIT-FIX-B1 — NEXT

Scope:

\- confirmed dead code;

\- identical duplicate declarations only.



Confirmed dead-code candidates from the audit:

\- operatorPortraitFallback

\- nearestTarget

\- nearestHostileEcho

\- eqCatName

\- eqOriginCol

\- rarPower

\- itemStateFlags



Confirmed duplicate declarations:

\- smClearSlotSave

\- smClearSlotEchoes

\- refreshAfterSlotWipe



Before removing ANY symbol:

\- re-prove it is unused on current HEAD;

\- inspect production;

\- inspect tests;

\- inspect audit harnesses;

\- inspect dynamic/global access.



\### AUDIT-FIX-B2 — LATER

Investigate test-only APIs and visual-foundation leftovers separately.



Do not remove them as part of B1.



\### AUDIT-FIX-C — LATER

Unify duplicated meta loading.



\### AUDIT-FIX-D — LATER

Reduce lifecycle/monkey-patch risk.



\### AUDIT-FIX-E — LATER

Replace fragile source-text tests with behavioral contracts.



\### AUDIT-FIX-F — LATER

Incremental modularization of `index.html`.



\## Current roadmap

\- PR15.5 Visual Overhaul is in progress.

\- F3 operator gameplay visuals: human approved.

\- F3-ASSETS operator portraits: human approved.

\- Next visual work must not be mixed into audit cleanup.

\- PR16 Adaptive Bosses comes later.

\- PR17 Progression/Lore/Achievements.

\- PR18 Contracts \& Challenges.

\- PR18.5 Operator Identity.

\- PR19 Balance/Polish.

\- PR20 Vertical Slice.



\## Scope discipline

When given a task:

\- modify only what the task requires;

\- preserve unrelated gameplay;

\- preserve save compatibility;

\- preserve deterministic systems;

\- preserve tests unless changing them is explicitly necessary;

\- state uncertainties instead of guessing.



If a requested change appears to violate one of these rules, stop and explain before editing.

