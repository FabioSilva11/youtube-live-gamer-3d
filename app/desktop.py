"""Native Windows window for the local YouTube Live Gamer 3D interface."""

from __future__ import annotations

import socket
import threading
import time
from typing import Any, Callable
from urllib.request import urlopen

import uvicorn

from app.main import app


def find_free_loopback_port() -> int:
    """Returns an available TCP port bound only to the local machine."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def wait_until_ready(
    check: Callable[[], None],
    timeout_seconds: float = 8.0,
    sleep: Callable[[float], None] = time.sleep,
) -> None:
    """Waits for a transient local backend startup to become available."""
    deadline = time.monotonic() + timeout_seconds
    while True:
        try:
            check()
            return
        except OSError as error:
            if time.monotonic() >= deadline:
                raise RuntimeError("A interface local não iniciou a tempo.") from error
            sleep(0.1)


class DesktopServer:
    """Owns the Uvicorn process used only by the native desktop window."""

    def __init__(self, port: int, server_factory: Callable[[uvicorn.Config], Any] = uvicorn.Server):
        self.port = port
        config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", access_log=False)
        self.server = server_factory(config)
        self.thread: threading.Thread | None = None

    def start(self) -> None:
        self.thread = threading.Thread(target=self.server.run, name="live-gamer-server", daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.server.should_exit = True
        if self.thread:
            self.thread.join(timeout=5)


def _check_backend(url: str) -> None:
    with urlopen(f"{url}api/status", timeout=1) as response:
        if response.status != 200:
            raise OSError(f"Backend local respondeu com status {response.status}.")


def run_desktop(webview_module: Any | None = None) -> None:
    """Starts the local app and displays it through the native Edge WebView2 window."""
    if webview_module is None:
        import webview as webview_module

    port = find_free_loopback_port()
    url = f"http://127.0.0.1:{port}/"
    desktop = DesktopServer(port)
    desktop.start()
    try:
        wait_until_ready(lambda: _check_backend(url))
        webview_module.create_window(
            "YouTube Live Gamer 3D",
            url,
            width=1280,
            height=820,
            min_size=(1024, 720),
            resizable=True,
        )
        webview_module.start(gui="edgechromium")
    finally:
        desktop.stop()


if __name__ == "__main__":
    run_desktop()
