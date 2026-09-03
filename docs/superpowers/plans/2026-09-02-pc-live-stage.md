# PC Live Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oferecer perfis econômico e normal, preservar mapa e ranking, adicionar exploração e ampliar/testar entradas e saídas.

**Architecture:** A prévia WebGL continua responsiva e usa FOV adaptativo fora da live. Durante a transmissão, o renderer principal usa o perfil selecionado — econômico em 854 × 480/24 FPS ou normal em 1280 × 720/30 FPS — e o próprio canvas visível é capturado, evitando uma segunda renderização da cena. Lógica determinística e testável fica em módulos JS puros; o FastAPI apenas adiciona/remove participantes demo e transmite snapshots.

**Tech Stack:** Python 3, FastAPI, Three.js r185, JavaScript ES modules, `unittest`/pytest, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-02-pc-live-stage.md`

## Global Constraints

- A transmissão oferece perfis econômico e normal, com resolução, FPS e bitrate alinhados entre navegador e FFmpeg.
- Durante a captura, a prévia deve preservar 16:9 e mostrar exatamente o canvas transmitido.
- Recursos GLB compartilhados nunca podem ser descartados por avatar.
- Campos de chave, URL e nome de teste permanecem preenchidos.
- Nenhum teste pode iniciar uma live real.

---

### Task 1: Saída PC única e lifecycle da captura

**Files:**
- Modify: `app/static/output.js`
- Create: `app/static/capture.js`
- Modify: `app/static/app.js`
- Modify: `app/static/index.html`
- Test: `tests/output.test.mjs`
- Create: `tests/capture.test.mjs`
- Test: `tests/test_ui_contract.py`

**Interfaces:**
- Produces: `outputDimensions(): {width: 1280, height: 720}`, `outputCameraPreset(): CameraPreset`, `stopMediaTracks(stream): number`.
- Consumes: `previewFovForAspect(baseFov, outputAspect, previewAspect)`.

- [x] **Step 1: Write failing tests** asserting no mobile option, fixed output dimensions, safe ranking layout and track cleanup.
- [x] **Step 2: Run** `node --test tests/output.test.mjs tests/capture.test.mjs` and `python -m pytest -q tests/test_ui_contract.py`; expect failures for remaining mobile behavior and missing cleanup helper.
- [x] **Step 3: Implement** fixed PC exports, remove `#output-format`, add `captureMediaStream` and idempotent capture cleanup, and stop every media track on explicit stop or unexpected output-socket close.
- [x] **Step 4: Run the same tests**; expect all pass.

### Task 2: Exploração determinística do mapa

**Files:**
- Modify: `app/static/social.js`
- Modify: `app/static/app.js`
- Test: `tests/social.test.mjs`

**Interfaces:**
- Produces: `explorationTarget(index, cycle): {x, z}`, `socialCycleIndex(elapsedMs, index): number` and the `explore` social phase.
- Consumes: `terrainHeightAt(x, z)` when applying the target to Three.js.

- [x] **Step 1: Write failing tests** for the `explore` phase, bounded targets, variation by avatar/cycle and solo exploration.
- [x] **Step 2: Run** `node --test tests/social.test.mjs`; expect missing exports/phase failures.
- [x] **Step 3: Implement** an 18-second cycle: approach, interact, explore, rest; map each avatar/cycle to a deterministic point inside the meadow.
- [x] **Step 4: Update** `updateSocialTargets()` so active avatars walk to exploration points, keep personal space during interaction, and return to layout at rest.
- [x] **Step 5: Run** `node --test tests/social.test.mjs`; expect pass.

### Task 3: Novos modos de entrada e saída

**Files:**
- Modify: `app/static/animation.js`
- Modify: `app/static/app.js`
- Modify: `app/static/index.html`
- Test: `tests/animation.test.mjs`

**Interfaces:**
- Produces: `entryMotion(mode, progress)` and `exitMotion(mode, progress)` returning `{heightOffset, scaleMultiplier, spin}`; normalizers accept `spotlight`, `drop`, `portal`, `current`, `walk`, `float`, `portal`, `current`.

- [x] **Step 1: Write failing tests** for supported modes, motion endpoints and clamped progress.
- [x] **Step 2: Run** `node --test tests/animation.test.mjs`; expect failures for new modes/functions.
- [x] **Step 3: Implement** pure motion functions and add the new select options with Portuguese labels.
- [x] **Step 4: Apply** motion state per avatar without mutating shared GLB materials; store the chosen entry/exit mode and base scale on each avatar.
- [x] **Step 5: Run** `node --test tests/animation.test.mjs`; expect pass.

### Task 4: Testes individuais de entrada e saída no painel

**Files:**
- Modify: `app/main.py`
- Modify: `app/static/index.html`
- Modify: `app/static/app.js`
- Modify: `app/static/styles.css`
- Test: `tests/test_registry.py`
- Test: `tests/test_ui_contract.py`

**Interfaces:**
- Produces: `ParticipantRegistry.remove_demo(display_name) -> bool`, `POST /api/demo/leave`, `#test-entry`, `#test-exit`.
- Consumes: the existing `DemoJoinRequest` and participant WebSocket snapshot.

- [x] **Step 1: Write failing tests** proving normalized-name removal affects only the requested demo and that both buttons/endpoints exist.
- [x] **Step 2: Run** `python -m pytest -q tests/test_registry.py tests/test_ui_contract.py`; expect failures.
- [x] **Step 3: Implement** `remove_demo`, the endpoint and the two-button form; reject a missing demo with a friendly 404 response.
- [x] **Step 4: Wire** the entry submit and exit click without clearing `#demo-name`.
- [x] **Step 5: Run** the targeted Python tests; expect pass.

### Task 5: Documentation, visual QA and delivery

**Files:**
- Modify: `README.md`
- Verify: all files above

**Interfaces:**
- Consumes: all completed tasks.
- Produces: private repository update and an open, validated local preview.

- [x] **Step 1: Update** README for selectable economic/normal output, exploration, animation modes and demo buttons.
- [x] **Step 2: Run** `python -m pytest -q`, `node --test tests/*.test.mjs`, `python -m compileall -q app`, and `git diff --check`.
- [x] **Step 3: Reload** `http://127.0.0.1:8000/`, test entry/exit manually, inspect both output profiles and confirm an empty console log.
- [x] **Step 4: Review** the diff for secrets and untracked imports, then commit and push `main` to the existing private origin.
