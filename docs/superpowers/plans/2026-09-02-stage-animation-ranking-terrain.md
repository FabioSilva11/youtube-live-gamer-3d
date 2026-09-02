# Stage Animation, Profile Ranking and Terrain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add selectable individual entry/exit animations, a canvas-captured ranking with public profile images, and a richer spring terrain.

**Architecture:** FastAPI keeps each public profile thumbnail URL only in the active in-memory participant and exposes a validated same-origin image endpoint. Pure JavaScript modules provide animation state and terrain height; `app.js` owns Three.js presentation, draws the ranking into a canvas texture, and renders a HUD scene after the world.

**Tech Stack:** Python 3.14, FastAPI, httpx, Three.js ES modules, Node built-in test runner, Python unittest.

**Spec:** `docs/superpowers/specs/2026-09-02-stage-animation-ranking-terrain-design.md`

## Global Constraints

- Keep at most 18 visible avatars and expire inactive authors after 60 seconds.
- Do not retain message text, cookies, IPs or profile images on disk.
- Only proxy HTTPS images from `ggpht.com` and `googleusercontent.com` subdomains.
- The ranking must be rendered inside the captured Three.js canvas.
- This folder has no Git repository, so worktree creation and commit steps are unavailable.

---

### Task 1: Ephemeral public profile photos

**Files:**
- Modify: `app/main.py`
- Modify: `tests/test_registry.py`

**Interfaces:**
- Consumes: YouTube `authorPhoto.thumbnails` in a public chat renderer.
- Produces: `Participant.profile_image_url`, snapshot field `profile_image_available`, `ParticipantRegistry.profile_image_url(avatar_id)`, and `GET /api/profile-image/{avatar_id}`.

- [ ] **Step 1: Write failing registry and parser tests**

```python
def test_extracts_public_profile_photo_without_exposing_url_in_snapshot(self):
    item = {"liveChatTextMessageRenderer": {
        "authorExternalChannelId": "channel-1",
        "authorName": {"simpleText": "Ana"},
        "authorPhoto": {"thumbnails": [{"url": "https://yt3.ggpht.com/avatar=s32"}]},
    }}
    channel_id, name, details = PublicChatWorker.public_author_from_chat_item(item)
    registry = ParticipantRegistry()
    registry.add_public_author(channel_id, name, details)
    assert registry.snapshot()[0]["profile_image_available"] is True
    assert "profile_image_url" not in registry.snapshot()[0]
```

- [ ] **Step 2: Run `python -m unittest discover -s tests -p "test_registry.py" -v` and confirm the photo assertions fail**

- [ ] **Step 3: Add the in-memory field, trusted-host validator and same-origin image response**

```python
def trusted_profile_image_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "https" and any(
        parsed.hostname == host or parsed.hostname.endswith(f".{host}")
        for host in ("ggpht.com", "googleusercontent.com")
    )
```

- [ ] **Step 4: Re-run the targeted Python tests and confirm they pass**

### Task 2: Selectable entry and exit state machine

**Files:**
- Create: `app/static/animation.js`
- Modify: `app/static/app.js`
- Modify: `app/static/index.html`
- Modify: `app/static/styles.css`
- Create: `tests/animation.test.mjs`

**Interfaces:**
- Produces: `normaliseAnimationMode(value, fallback)`, `ArrivalQueue`, form controls `#entry-animation` and `#exit-animation`.
- Consumes: avatar IDs and the existing Three.js avatar map.

- [ ] **Step 1: Write failing Node tests for valid modes, FIFO arrival ordering and queue flushing**

```javascript
test('arrival queue presents one participant at a time', () => {
  const queue = new ArrivalQueue();
  queue.enqueue('a'); queue.enqueue('b');
  assert.equal(queue.startNext(), 'a');
  assert.equal(queue.startNext(), null);
  queue.complete('a');
  assert.equal(queue.startNext(), 'b');
});
```

- [ ] **Step 2: Run `node --test tests/animation.test.mjs` and confirm the missing module failure**

- [ ] **Step 3: Implement the pure queue and mode validator**

```javascript
export const ENTRY_MODES = new Set(['current', 'spotlight']);
export const EXIT_MODES = new Set(['current', 'walk']);
```

- [ ] **Step 4: Wire selectors, localStorage, the spotlight phase and walk-out phase into `app.js`**

- [ ] **Step 5: Run the Node animation tests and UI contract tests until both pass**

### Task 3: Ranking rendered inside the captured canvas

**Files:**
- Modify: `app/static/app.js`
- Modify: `app/static/ranking.js`
- Modify: `tests/layout.test.mjs`
- Modify: `tests/test_ui_contract.py`

**Interfaces:**
- Consumes: participant fields `id`, `display_name`, `messages`, `profile_image_available`.
- Produces: `rankingCanvas`, `rankingTexture`, `rankingSprite`, and `/api/profile-image/{id}` image loads.

- [ ] **Step 1: Add a failing ranking test that retains `profile_image_available` while sorting**

```javascript
assert.equal(topChatRanking([{ id: 'a', messages: 2, profile_image_available: true }])[0].profile_image_available, true);
```

- [ ] **Step 2: Add a failing UI contract assertion for `rankingCanvas`, `hudScene` and `renderer.clearDepth()`**

- [ ] **Step 3: Draw the five rows into a 768x430 canvas and refresh its texture after photos load**

- [ ] **Step 4: Render the world, clear depth, then render the orthographic HUD scene**

- [ ] **Step 5: Run the ranking and UI contract tests and confirm they pass**

### Task 4: Organic spring terrain

**Files:**
- Create: `app/static/terrain.js`
- Modify: `app/static/app.js`
- Create: `tests/terrain.test.mjs`

**Interfaces:**
- Produces: `terrainHeightAt(x, z)` with a bounded deterministic height.
- Consumes: world coordinates for surface vertices, grass, flowers, trees, props and avatar destinations.

- [ ] **Step 1: Write a failing deterministic-height test**

```javascript
assert.equal(terrainHeightAt(2, 3), terrainHeightAt(2, 3));
assert.ok(Math.abs(terrainHeightAt(6, -4)) <= .35);
```

- [ ] **Step 2: Run `node --test tests/terrain.test.mjs` and confirm the missing module failure**

- [ ] **Step 3: Implement the height function and use it to deform a circle geometry**

- [ ] **Step 4: Add the lake, stepping path, rocks and shrubs using the same height function**

- [ ] **Step 5: Run terrain tests and visually inspect the desktop and mobile stage**

### Task 5: Full verification and local live handoff

**Files:**
- Modify: `README.md`
- Verify: all changed source and tests.

**Interfaces:**
- Consumes: all preceding deliverables.
- Produces: verified local application ready for the operator's stream key.

- [ ] **Step 1: Update README privacy, animation choices and canvas ranking behavior**

- [ ] **Step 2: Run `python -m unittest discover -s tests -v`**

- [ ] **Step 3: Run `node --test tests/*.test.mjs`**

- [ ] **Step 4: Run `python -m compileall -q app`**

- [ ] **Step 5: Restart the local server, connect the supplied live URL and verify status, ranking, animations and terrain in the browser**
