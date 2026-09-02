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
        self.assertIn("targetRenderer.clearDepth()", script)
        self.assertIn("/api/profile-image/", script)

    def test_animation_choices_and_filled_fields_are_preserved(self):
        html = (ROOT / "app" / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="entry-animation"', html)
        self.assertIn('id="exit-animation"', html)
        self.assertIn('value="drop"', html)
        self.assertIn('value="float"', html)
        self.assertIn('value="portal"', html)
        self.assertIn('id="test-entry"', html)
        self.assertIn('id="test-exit"', html)
        self.assertIn("/api/demo/leave", script)
        self.assertNotIn("field.value = ''", script)
        self.assertNotIn("document.querySelector('#stream-key').value = ''", script)

    def test_stream_output_is_fixed_to_pc_1280_by_720(self):
        html = (ROOT / "app" / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertNotIn('id="output-format"', html)
        self.assertNotIn('value="mobile"', html)
        self.assertIn("1280 × 720", html)
        self.assertIn("outputDimensions", script)
        self.assertIn("outputCameraPreset", script)
        self.assertIn("applyOutputCameraPreset", script)
        self.assertNotIn("live-gamer-output-format", script)
        self.assertNotIn("outputFormat", script)
        self.assertIn("pollStreamStatus", script)

    def test_stream_retry_releases_the_previous_browser_capture(self):
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")
        capture_start = script.index("async function startCanvasCapture()")
        socket_start = script.index("const socket = new WebSocket", capture_start)

        self.assertIn("await stopCanvasCapture();", script[capture_start:socket_start])
        self.assertIn("stopMediaTracks(captureMediaStream)", script)
        self.assertIn("stopCanvasCapture({ closeSocket: false })", script)
        self.assertIn("captureSessionIsActive", script)
        self.assertIn("captureAudio = { context, source, started: false }", script)
        self.assertNotIn("captureCamera.copy(camera)", script)

    def test_characters_walk_interact_and_advertise_the_ten_person_stage_limit(self):
        html = (ROOT / "app" / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertIn("10 participantes", html)
        self.assertNotIn("por 1 minuto", html)
        self.assertIn("new THREE.AnimationMixer", script)
        self.assertIn("socialInteractionPhase", script)
        self.assertIn("avatarActivityAnimation", script)
        self.assertIn("THREE.ACESFilmicToneMapping", script)
        self.assertIn("new THREE.Timer", script)
        self.assertNotIn("new THREE.Clock", script)
        self.assertIn("THREE.PCFShadowMap", script)
        self.assertNotIn("THREE.PCFSoftShadowMap", script)

    def test_music_controls_select_a_local_track_for_live_audio(self):
        html = (ROOT / "app" / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="music-file"', html)
        self.assertIn('id="music-play"', html)
        self.assertIn('id="music-pause"', html)
        self.assertIn('id="music-volume"', html)
        self.assertIn('accept="audio/mpeg,audio/wav,audio/ogg"', html)
        self.assertIn("startMusicForLive", script)
        self.assertIn("createMusicCaptureRoute", script)

    def test_preview_renders_the_world_across_the_whole_stage(self):
        styles = (ROOT / "app" / "static" / "styles.css").read_text(encoding="utf-8")
        script = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")

        self.assertIn(".scene canvas { display: block; width: 100%; height: 100%", styles)
        self.assertNotIn('.scene[data-output-format="desktop"] canvas', styles)
        self.assertNotIn('.scene[data-output-format="mobile"] canvas', styles)
        self.assertIn("elements.scene.clientWidth", script)
        self.assertIn("elements.scene.clientHeight", script)
        self.assertIn("captureRenderer.domElement.captureStream(30)", script)
        self.assertNotIn("renderer.domElement.captureStream(30)", script)


if __name__ == "__main__":
    unittest.main()
