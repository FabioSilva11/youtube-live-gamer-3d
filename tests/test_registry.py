import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.main import (
    CanvasChunkBuffer,
    ParticipantRegistry,
    PublicChatWorker,
    SocketHub,
    StreamController,
    classify_ffmpeg_delivery_error,
    get_profile_image,
    registry,
    trusted_profile_image_url,
)


class ParticipantRegistryTests(unittest.TestCase):
    def test_only_one_avatar_for_repeat_public_author(self):
        registry = ParticipantRegistry()
        self.assertTrue(registry.add_public_author("channel-1", "Ana", {}))
        self.assertFalse(registry.add_public_author("channel-1", "Ana Gamer", {"isChatModerator": True}))

        snapshot = registry.snapshot()
        self.assertEqual(len(snapshot), 1)
        self.assertEqual(snapshot[0]["display_name"], "Ana Gamer")
        self.assertEqual(snapshot[0]["role"], "moderador")
        self.assertEqual(snapshot[0]["messages"], 2)

    def test_demo_name_is_trimmed_and_not_message_content(self):
        registry = ParticipantRegistry()
        registry.add_demo("  Player   Um  ")
        self.assertEqual(registry.snapshot()[0]["display_name"], "Player Um")
        self.assertNotIn("message", registry.snapshot()[0])

    def test_removes_only_the_named_demo_participant(self):
        registry = ParticipantRegistry()
        registry.add_demo("  Player   Um  ")
        registry.add_demo("Player Dois")

        self.assertTrue(registry.remove_demo("player um"))
        self.assertEqual([person["display_name"] for person in registry.snapshot()], ["Player Dois"])
        self.assertFalse(registry.remove_demo("inexistente"))

    def test_keeps_an_inactive_author_on_stage_until_the_stage_is_cleared(self):
        now = [100.0]
        registry = ParticipantRegistry(clock=lambda: now[0])
        registry.add_public_author("channel-1", "Ana", {})

        now[0] = 3_700.0
        self.assertFalse(registry.expire_inactive())
        self.assertEqual([person["display_name"] for person in registry.snapshot()], ["Ana"])

    def test_replaces_only_the_oldest_author_when_the_eleventh_arrives(self):
        now = [100.0]
        registry = ParticipantRegistry(clock=lambda: now[0])
        for number in range(1, 11):
            registry.add_public_author(f"channel-{number}", f"Player {number}", {})
            now[0] += 1

        registry.add_public_author("channel-11", "Player 11", {})

        self.assertEqual(
            [person["display_name"] for person in registry.snapshot()],
            ["Player 2", "Player 3", "Player 4", "Player 5", "Player 6", "Player 7", "Player 8", "Player 9", "Player 10", "Player 11"],
        )

    def test_public_chat_status_reports_the_active_author_count(self):
        registry = ParticipantRegistry()
        registry.add_public_author("channel-1", "Ana", {})
        worker = PublicChatWorker(registry, SocketHub())

        self.assertEqual(worker.status()["participants"], 1)

    def test_extracts_youtube_video_id_from_public_live_urls(self):
        self.assertEqual(PublicChatWorker.video_id_from_source("https://youtube.com/live/mlKXjGTENNw?feature=share"), "mlKXjGTENNw")
        self.assertEqual(PublicChatWorker.video_id_from_source("https://www.youtube.com/watch?v=mlKXjGTENNw"), "mlKXjGTENNw")
        self.assertEqual(PublicChatWorker.video_id_from_source("mlKXjGTENNw"), "mlKXjGTENNw")

    def test_parses_current_public_live_chat_bootstrap_payload(self):
        html = '<script>window["ytInitialData"] = {"contents":{"liveChatRenderer":{"continuations":[]}}};</script>'

        payload = PublicChatWorker.initial_payload_from_html(html)

        self.assertIn("liveChatRenderer", payload["contents"])

    def test_extracts_public_author_and_role_without_retaining_message(self):
        item = {
            "liveChatTextMessageRenderer": {
                "authorExternalChannelId": "channel-123",
                "authorName": {"runs": [{"text": "Ana Gamer"}]},
                "authorBadges": [{"liveChatAuthorBadgeRenderer": {"icon": {"iconType": "MODERATOR"}}}],
                "message": {"runs": [{"text": "mensagem que nao deve ser guardada"}]},
            }
        }

        author = PublicChatWorker.public_author_from_chat_item(item)

        self.assertEqual(author, ("channel-123", "Ana Gamer", {"isChatModerator": True}))

    def test_keeps_a_public_profile_photo_only_for_the_active_avatar(self):
        item = {
            "liveChatTextMessageRenderer": {
                "authorExternalChannelId": "channel-photo",
                "authorName": {"simpleText": "Ana com foto"},
                "authorPhoto": {"thumbnails": [{"url": "https://yt3.ggpht.com/public-avatar=s32"}]},
            }
        }
        channel_id, display_name, details = PublicChatWorker.public_author_from_chat_item(item)
        registry = ParticipantRegistry()
        registry.add_public_author(channel_id, display_name, details)

        participant = registry.snapshot()[0]
        self.assertTrue(participant["profile_image_available"])
        self.assertNotIn("profile_image_url", participant)
        self.assertEqual(registry.profile_image_url(participant["id"]), "https://yt3.ggpht.com/public-avatar=s32")

        registry.clear()
        self.assertIsNone(registry.profile_image_url(participant["id"]))

    def test_accepts_only_google_youtube_https_profile_hosts(self):
        self.assertTrue(trusted_profile_image_url("https://yt3.ggpht.com/avatar"))
        self.assertTrue(trusted_profile_image_url("https://yt4.googleusercontent.com/avatar"))
        self.assertFalse(trusted_profile_image_url("http://yt3.ggpht.com/avatar"))
        self.assertFalse(trusted_profile_image_url("https://example.com/avatar"))
        self.assertFalse(trusted_profile_image_url("https://ggpht.com.example.com/avatar"))

    def test_stream_configuration_needs_only_a_key_for_threejs_canvas(self):
        controller = StreamController()
        controller.configure("abcdefghijk")
        self.assertTrue(controller.status()["stream_configured"])
        self.assertEqual(controller.status()["stream_source"], "threejs-canvas")

    def test_canvas_stream_targets_youtube_recommended_bitrate(self):
        command = StreamController.canvas_command("ffmpeg", "rtmps://example/live/key")
        self.assertEqual(command[command.index("-b:v") + 1], "2500k")
        self.assertEqual(command[command.index("-maxrate") + 1], "3000k")

    def test_canvas_buffer_discards_stale_chunks_when_the_encoder_is_busy(self):
        buffer = CanvasChunkBuffer(max_chunks=2)
        buffer.push(b"old")
        buffer.push(b"current")
        buffer.push(b"latest")

        self.assertEqual(buffer.next_chunk(timeout=0), b"current")
        self.assertEqual(buffer.next_chunk(timeout=0), b"latest")

    def test_ffmpeg_delivery_errors_are_friendly_and_do_not_leak_stream_keys(self):
        secret = "private-stream-key"
        message = f"Connection to rtmps://a.rtmps.youtube.com/live2/{secret} failed: Connection refused"

        result = classify_ffmpeg_delivery_error(message)

        self.assertIn("conexão", result.lower())
        self.assertNotIn(secret, result)


class ProfileImageProxyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        registry.clear()

    async def asyncTearDown(self):
        registry.clear()

    async def test_rejects_a_redirect_from_google_to_an_untrusted_host(self):
        registry.add_public_author(
            "channel-redirect",
            "Foto redirecionada",
            {"profileImageUrl": "https://yt3.ggpht.com/avatar"},
        )
        avatar_id = registry.snapshot()[0]["id"]

        class FakeResponse:
            url = "https://example.com/untrusted-avatar"
            headers = {"content-type": "image/png"}
            content = b"not-relevant"

            def raise_for_status(self):
                return None

        class FakeClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return None

            async def get(self, *_args, **_kwargs):
                return FakeResponse()

        with patch("app.main.httpx.AsyncClient", return_value=FakeClient()):
            with self.assertRaises(HTTPException) as caught:
                await get_profile_image(avatar_id)

        self.assertEqual(caught.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
