import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class PublicChatUiContractTests(unittest.TestCase):
    def test_chat_form_needs_only_a_public_live_url(self):
        html = (ROOT / "app" / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="chat-source"', html)
        self.assertNotIn('id="api-key"', html)
        self.assertNotIn("Chave da API", html)
        self.assertIn("/api/chat/connect", script)
        self.assertNotIn("api_key", script)

    def test_stage_declares_spring_world_landmarks(self):
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertIn("springMeadow", script)
        self.assertIn("yellowFlower", script)
        self.assertIn("goldenTree", script)
        self.assertIn("springSun", script)
        self.assertIn("terrainHeightAt", script)
        self.assertIn("springLake", script)
        self.assertIn("meadowRock", script)
        self.assertIn("springShrub", script)
        self.assertIn("terrainHeightAt(layout.x, layout.z)", script)
        self.assertIn("terrainHeightAt(avatar.position.x, avatar.position.z)", script)

    def test_stage_has_a_live_chat_ranking_overlay(self):
        html = (ROOT / "app" / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="ranking-total"', html)
        self.assertIn('id="ranking-list"', html)
        self.assertIn("topChatRanking", script)
        self.assertIn("rankingCanvas", script)
        self.assertIn("hudScene", script)
        self.assertIn("renderer.clearDepth()", script)
        self.assertIn("/api/profile-image/", script)

    def test_animation_choices_and_filled_fields_are_preserved(self):
        html = (ROOT / "app" / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="entry-animation"', html)
        self.assertIn('id="exit-animation"', html)
        self.assertNotIn("field.value = ''", script)
        self.assertNotIn("document.querySelector('#stream-key').value = ''", script)

    def test_stream_output_can_switch_between_pc_and_mobile(self):
        html = (ROOT / "app" / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="output-format"', html)
        self.assertIn('value="desktop"', html)
        self.assertIn('value="mobile"', html)
        self.assertIn("outputDimensions", script)
        self.assertIn("outputCameraPreset", script)
        self.assertIn("applyOutputCameraPreset", script)
        self.assertIn("live-gamer-output-format", script)
        self.assertIn("pollStreamStatus", script)

    def test_stream_retry_releases_the_previous_browser_capture(self):
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")
        capture_start = script.index("async function startCanvasCapture()")
        socket_start = script.index("outputSocket = new WebSocket", capture_start)

        self.assertIn("await stopCanvasCapture();", script[capture_start:socket_start])

    def test_characters_walk_interact_and_advertise_one_minute_presence(self):
        html = (ROOT / "app" / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertIn("1 minuto", html)
        self.assertIn("new THREE.AnimationMixer", script)
        self.assertIn("socialInteractionPhase", script)
        self.assertIn("avatarActivityAnimation", script)
        self.assertIn("THREE.ACESFilmicToneMapping", script)
        self.assertIn("new THREE.Timer", script)
        self.assertNotIn("new THREE.Clock", script)
        self.assertIn("THREE.PCFShadowMap", script)
        self.assertNotIn("THREE.PCFSoftShadowMap", script)


if __name__ == "__main__":
    unittest.main()
