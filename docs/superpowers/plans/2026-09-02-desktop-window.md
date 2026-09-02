# Desktop Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Windows EXE that renders the YouTube Live Gamer 3D Three.js UI in a native window without a terminal.

**Architecture:** `app.desktop` selects a free `127.0.0.1` port, runs the existing FastAPI app through Uvicorn in a worker thread, waits for `/api/status`, and displays that local URL through PyWebView's Edge WebView2 backend. When the window closes, `app.desktop` requests server shutdown. PyInstaller packages that entrypoint with frontend assets, GLB models, FFmpeg, and the icon.

**Tech Stack:** Python 3.14, FastAPI, Uvicorn, PyWebView, Pillow, PyInstaller, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-02-desktop-window-design.md`

## Global Constraints

- Bind only to `127.0.0.1` and choose a free local port automatically.
- Create a resizable 1280 x 820 window with a 1024 x 720 minimum size.
- Closing the native window must stop and join the worker thread.
- Build with `--noconsole`, and package FFmpeg, static files, GLB models, and the ICO.
- Preserve chat, music, canvas capture, stream delivery, and the ten-person stage behavior.

---

### Task 1: Native desktop runtime

**Files:**
- Create: `app/desktop.py`
- Create: `tests/test_desktop.py`
- Modify: `requirements.txt`

**Interfaces:**
- Produces `find_free_loopback_port() -> int`.
- Produces `wait_until_ready(check: Callable[[], None], timeout_seconds: float = 8.0, sleep: Callable[[float], None] = time.sleep) -> None`.
- Produces `DesktopServer(port: int, server_factory: Callable[..., Any] = uvicorn.Server)` with `start() -> None` and `stop() -> None`.
- Produces `run_desktop() -> None`.

- [ ] **Step 1: Write the failing test file**

```python
import socket
import unittest

from app.desktop import DesktopServer, find_free_loopback_port, wait_until_ready

class FakeServer:
    def __init__(self, _config):
        self.should_exit = False
    def run(self):
        return None

class DesktopRuntimeTests(unittest.TestCase):
    def test_free_port_is_bindable(self):
        port = find_free_loopback_port()
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind(("127.0.0.1", port))

    def test_readiness_retries_transient_error(self):
        calls = []
        def check():
            calls.append(None)
            if len(calls) < 3:
                raise OSError("not ready")
        wait_until_ready(check, timeout_seconds=1, sleep=lambda _: None)
        self.assertEqual(len(calls), 3)

    def test_stop_requests_server_shutdown(self):
        desktop = DesktopServer(8011, server_factory=FakeServer)
        desktop.start()
        desktop.stop()
        self.assertTrue(desktop.server.should_exit)
```

- [ ] **Step 2: Run the test before implementation**

Run: `python -m unittest tests.test_desktop -v`

Expected: FAIL because `app.desktop` does not exist.

- [ ] **Step 3: Implement `app.desktop`**

```python
def find_free_loopback_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])

class DesktopServer:
    def start(self) -> None:
        self.thread = threading.Thread(target=self.server.run, name="live-gamer-server", daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.server.should_exit = True
        if self.thread:
            self.thread.join(timeout=5)
```

`run_desktop()` must start `DesktopServer`, poll `http://127.0.0.1:{port}/api/status` with `urllib.request.urlopen`, then call:

```python
webview.create_window("YouTube Live Gamer 3D", url, width=1280, height=820, min_size=(1024, 720), resizable=True)
webview.start(gui="edgechromium")
```

Use `finally: desktop.stop()` around `webview.start`.

- [ ] **Step 4: Add dependencies and pass the tests**

Append `pywebview>=5,<7` and `Pillow>=10,<12` to `requirements.txt`.

Run: `python -m unittest discover -s tests -p "test_*.py" -v`

Expected: all Python tests PASS.

- [ ] **Step 5: Commit this task**

```bash
git add app/desktop.py tests/test_desktop.py requirements.txt
git commit -m "Add the native desktop window runtime"
```

### Task 2: Original desktop icon

**Files:**
- Create: `assets/live-gamer-3d-icon.png`
- Create: `assets/live-gamer-3d-icon.ico`
- Create: `app/static/live-gamer-3d-icon.png`
- Modify: `app/static/index.html`
- Modify: `tests/test_ui_contract.py`

**Interfaces:**
- Produces a square, multi-resolution Windows ICO with 16, 32, 48, 64, 128, and 256 pixel representations.
- `index.html` consumes `/static/live-gamer-3d-icon.png` as its favicon.

- [ ] **Step 1: Add a failing favicon contract**

```python
def test_page_uses_the_live_gamer_favicon(self):
    self.assertIn('href="/static/live-gamer-3d-icon.png"', self.index_html)
```

- [ ] **Step 2: Verify it fails**

Run: `python -m unittest tests.test_ui_contract.PublicChatUiContractTests.test_page_uses_the_live_gamer_favicon -v`

Expected: FAIL because the link is absent.

- [ ] **Step 3: Generate and convert the icon**

Use ImageGen for a non-text 1:1 icon: dark forest-green rounded field, low-poly meadow and avatars, centered vivid cyan broadcast/play glyph, strong contrast, generous safe padding. Save the generated PNG to `assets/live-gamer-3d-icon.png`. Use Pillow to create `assets/live-gamer-3d-icon.ico` with `[16, 32, 48, 64, 128, 256]` and copy the PNG to `app/static/live-gamer-3d-icon.png`.

- [ ] **Step 4: Add the page asset and verify it**

```html
<link rel="icon" type="image/png" href="/static/live-gamer-3d-icon.png">
```

Run: `python -m unittest tests.test_ui_contract.PublicChatUiContractTests.test_page_uses_the_live_gamer_favicon -v`

Run: `python -c "from PIL import Image; assert Image.open('assets/live-gamer-3d-icon.ico').size == (256, 256)"`

Expected: both commands PASS.

- [ ] **Step 5: Commit this task**

```bash
git add assets app/static/live-gamer-3d-icon.png app/static/index.html tests/test_ui_contract.py
git commit -m "Add the Live Gamer desktop icon"
```

### Task 3: Build the console-free EXE

**Files:**
- Create: `scripts/build_windows.ps1`
- Modify: `README.md`
- Modify: `tests/test_desktop.py`

**Interfaces:**
- `scripts/build_windows.ps1` produces `output/LiveGamer3D.exe` from `app/desktop.py`.
- The script includes `app\\static`, `kenney_blocky-characters_20\\Models\\GLB format`, `ffmpeg.exe`, and `assets\\live-gamer-3d-icon.ico`.

- [ ] **Step 1: Add the packaging source assertion**

```python
def test_desktop_entrypoint_creates_the_native_window(self):
    source = Path("app/desktop.py").read_text(encoding="utf-8")
    self.assertIn("webview.create_window", source)
    self.assertIn('webview.start(gui="edgechromium")', source)
```

- [ ] **Step 2: Run the assertion**

Run: `python -m unittest tests.test_desktop.DesktopRuntimeTests.test_desktop_entrypoint_creates_the_native_window -v`

Expected: PASS after Task 1.

- [ ] **Step 3: Create the PowerShell build script**

Use `.venv\\Scripts\\python.exe -m PyInstaller --noconfirm --onefile --noconsole --name LiveGamer3D --icon assets\\live-gamer-3d-icon.ico --collect-all webview`, pass `--add-data` for static and GLB directories, pass `--add-binary` for `Get-Command ffmpeg`, and target `app\\desktop.py`.

- [ ] **Step 4: Document desktop usage**

Add to `README.md`: double-click `output/LiveGamer3D.exe`; it opens the native Three.js window and closing it stops its local service. Edge WebView2 Runtime is the only Windows prerequisite when its backend is unavailable.

- [ ] **Step 5: Build and manually validate**

Run: `powershell -ExecutionPolicy Bypass -File scripts/build_windows.ps1`

Expected: an EXE exists, starts without a terminal, creates the `YouTube Live Gamer 3D` window, loads the Three.js UI, finds bundled FFmpeg, and leaves no process or listening port after the native window is closed.

- [ ] **Step 6: Commit this task**

```bash
git add scripts/build_windows.ps1 README.md tests/test_desktop.py
git commit -m "Package the desktop Live Gamer application"
```

### Task 4: Regression and delivery

**Files:**
- Verify: `app/`, `tests/`, `assets/`, `scripts/build_windows.ps1`, `output/LiveGamer3D.exe`

**Interfaces:**
- Consumes the desktop runtime, icon, and package script.
- Produces a validated unsigned Windows executable and synchronized source history.

- [ ] **Step 1: Run regression checks**

Run: `python -m unittest discover -s tests -p "test_*.py"`

Run: `node --test tests/*.test.mjs`

Run: `python -m compileall -q app`

Run: `git diff --check`

Expected: every command exits successfully.

- [ ] **Step 2: Record the executable identity**

Run: `Get-Item output\\LiveGamer3D.exe | Select-Object FullName,Length,LastWriteTime`

Run: `Get-FileHash output\\LiveGamer3D.exe -Algorithm SHA256`

Expected: a non-empty executable and SHA-256 hash.

- [ ] **Step 3: Commit and push delivery**

```bash
git add app assets scripts README.md requirements.txt tests docs/superpowers/plans/2026-09-02-desktop-window.md
git commit -m "Deliver the Live Gamer desktop application"
git push origin main
```
