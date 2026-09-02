import socket
import unittest

from app.desktop import DesktopServer, find_free_loopback_port, run_desktop, wait_until_ready


class FakeServer:
    def __init__(self, _config):
        self.should_exit = False
        self.ran = False

    def run(self):
        self.ran = True


class FakeWebView:
    def __init__(self):
        self.window = None
        self.gui = None

    def create_window(self, title, url, **options):
        self.window = {"title": title, "url": url, "options": options}

    def start(self, *, gui):
        self.gui = gui


class DesktopRuntimeTests(unittest.TestCase):
    def test_free_port_is_immediately_bindable_on_loopback(self):
        port = find_free_loopback_port()

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind(("127.0.0.1", port))

    def test_readiness_wait_retries_a_transient_connection_error(self):
        calls = []

        def check():
            calls.append(None)
            if len(calls) < 3:
                raise OSError("backend not ready")

        wait_until_ready(check, timeout_seconds=1, sleep=lambda _: None)

        self.assertEqual(len(calls), 3)

    def test_closing_the_desktop_runtime_requests_server_shutdown(self):
        desktop = DesktopServer(8011, server_factory=FakeServer)
        desktop.start()
        desktop.stop()

        self.assertTrue(desktop.server.should_exit)

    def test_desktop_runtime_opens_the_local_threejs_interface_in_a_native_window(self):
        native_window = FakeWebView()

        run_desktop(webview_module=native_window)

        self.assertEqual(native_window.window["title"], "YouTube Live Gamer 3D")
        self.assertTrue(native_window.window["url"].startswith("http://127.0.0.1:"))
        self.assertEqual(native_window.window["options"]["width"], 1280)
        self.assertEqual(native_window.window["options"]["height"], 820)
        self.assertEqual(native_window.window["options"]["min_size"], (1024, 720))
        self.assertEqual(native_window.gui, "edgechromium")


if __name__ == "__main__":
    unittest.main()
