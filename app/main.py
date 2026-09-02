"""Servidor local para uma live do YouTube com painel de participantes em 3D.

O serviço lê a página pública do chat ao vivo. Não identifica espectadores
silenciosos, IPs ou dados privados, e descarta o texto das mensagens.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import queue
import shutil
import subprocess
import threading
import time
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "app" / "static"
CHARACTERS_DIR = ROOT / "kenney_blocky-characters_20" / "Models" / "GLB format"
load_dotenv(ROOT / ".env")

TRUSTED_PROFILE_IMAGE_HOSTS = ("ggpht.com", "googleusercontent.com")


def classify_ffmpeg_delivery_error(message: str) -> str:
    """Turns FFmpeg output into a useful message without exposing the stream URL or key."""
    lowered = message.lower()
    if any(marker in lowered for marker in ("connection refused", "network is unreachable", "timed out", "connection reset")):
        return "Falha de conexão ao entregar o vídeo ao YouTube. Verifique a internet e tente novamente."
    if any(marker in lowered for marker in ("authentication", "unauthorized", "forbidden", "server error", "invalid data")):
        return "O YouTube recusou a transmissão. Confira a chave RTMP e gere outra se necessário."
    if "broken pipe" in lowered:
        return "A conexão de envio ao YouTube foi interrompida."
    return "O FFmpeg encontrou um erro ao entregar o vídeo ao YouTube."


def trusted_profile_image_url(url: str) -> bool:
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and any(
        hostname == trusted_host or hostname.endswith(f".{trusted_host}")
        for trusted_host in TRUSTED_PROFILE_IMAGE_HOSTS
    )


@dataclass(slots=True)
class Participant:
    """A minimal, ephemeral public representation of a chat author."""

    id: str
    display_name: str
    role: str = "participante"
    messages: int = 1
    last_seen: float = 0.0
    profile_image_url: str | None = None


class ParticipantRegistry:
    """Keeps up to ten public authors on stage without retaining message text."""

    def __init__(
        self,
        clock: Callable[[], float] = time.monotonic,
        ttl_seconds: float | None = None,
        max_participants: int = 10,
    ) -> None:
        self._participants: dict[str, Participant] = {}
        self._sequence = 0
        self._clock = clock
        self._ttl_seconds = ttl_seconds
        self._max_participants = max_participants

    @staticmethod
    def _role(author: dict[str, Any]) -> str:
        if author.get("isChatOwner"):
            return "criador"
        if author.get("isChatModerator"):
            return "moderador"
        if author.get("isChatSponsor"):
            return "membro"
        return "participante"

    def add_public_author(self, channel_id: str, display_name: str, author: dict[str, Any]) -> bool:
        """Adds/updates a public chat author and reports if it is a new avatar."""
        if not channel_id or not display_name:
            return False
        now = self._clock()
        existing = self._participants.get(channel_id)
        profile_image_url = str(author.get("profileImageUrl", "")).strip()
        if not trusted_profile_image_url(profile_image_url):
            profile_image_url = ""
        if existing:
            existing.messages += 1
            existing.display_name = display_name[:32]
            existing.role = self._role(author)
            existing.last_seen = now
            if profile_image_url:
                existing.profile_image_url = profile_image_url
            return False
        if len(self._participants) >= self._max_participants:
            oldest_channel_id = min(self._participants, key=lambda item: self._participants[item].last_seen)
            del self._participants[oldest_channel_id]
        self._sequence += 1
        self._participants[channel_id] = Participant(
            id=f"avatar-{self._sequence}",
            display_name=display_name[:32],
            role=self._role(author),
            last_seen=now,
            profile_image_url=profile_image_url or None,
        )
        return True

    def add_demo(self, display_name: str) -> None:
        safe_name = " ".join(display_name.split())[:32]
        if not safe_name:
            raise ValueError("Informe um nome para o avatar de demonstração.")
        token = f"demo:{safe_name.casefold()}"
        self.add_public_author(token, safe_name, {})

    def remove_demo(self, display_name: str) -> bool:
        safe_name = " ".join(display_name.split())[:32]
        if not safe_name:
            return False
        return self._participants.pop(f"demo:{safe_name.casefold()}", None) is not None

    def clear(self) -> None:
        self._participants.clear()
        self._sequence = 0

    def expire_inactive(self) -> bool:
        if self._ttl_seconds is None:
            return False
        now = self._clock()
        expired = [
            channel_id
            for channel_id, participant in self._participants.items()
            if now - participant.last_seen >= self._ttl_seconds
        ]
        for channel_id in expired:
            del self._participants[channel_id]
        return bool(expired)

    def seconds_until_expiry(self) -> float | None:
        if self._ttl_seconds is None or not self._participants:
            return None
        now = self._clock()
        return max(0.0, min(participant.last_seen + self._ttl_seconds - now for participant in self._participants.values()))

    def profile_image_url(self, avatar_id: str) -> str | None:
        return next(
            (participant.profile_image_url for participant in self._participants.values() if participant.id == avatar_id),
            None,
        )

    def snapshot(self) -> list[dict[str, Any]]:
        return [
            {
                "id": item.id,
                "display_name": item.display_name,
                "role": item.role,
                "messages": item.messages,
                "profile_image_available": bool(item.profile_image_url),
            }
            for item in self._participants.values()
        ]


class SocketHub:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, socket: WebSocket) -> None:
        await socket.accept()
        self._connections.add(socket)

    def disconnect(self, socket: WebSocket) -> None:
        self._connections.discard(socket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        disconnected: list[WebSocket] = []
        for socket in self._connections.copy():
            try:
                await socket.send_json(payload)
            except Exception:
                disconnected.append(socket)
        for socket in disconnected:
            self.disconnect(socket)


class PublicChatWorker:
    """Reads public YouTube live-chat authors without a user API key or cookies."""

    chat_page = "https://www.youtube.com/live_chat"
    continuation_endpoint = "https://www.youtube.com/youtubei/v1/live_chat/get_live_chat"
    browser_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    }

    def __init__(self, registry: ParticipantRegistry, hub: SocketHub) -> None:
        self.registry = registry
        self.hub = hub
        self._task: asyncio.Task[None] | None = None
        self._source: str | None = None
        self.last_error: str | None = None

    @property
    def connected(self) -> bool:
        return self._task is not None and not self._task.done()

    async def start(self, source: str) -> None:
        video_id = self.video_id_from_source(source)
        if not video_id:
            raise HTTPException(status_code=422, detail="Informe um link público do YouTube ou um ID de vídeo válido.")
        await self.stop()
        self._source = video_id
        self.last_error = None
        self._task = asyncio.create_task(self._run(), name="youtube-public-live-chat")
        await self.hub.broadcast({"type": "status", "data": self.status()})

    @staticmethod
    def video_id_from_source(source: str) -> str | None:
        """Accept a public YouTube watch/live URL or an 11-character video ID."""
        value = source.strip()
        if len(value) == 11 and value.replace("-", "").replace("_", "").isalnum():
            return value
        parsed = urlparse(value)
        host = parsed.netloc.lower().removeprefix("www.")
        if host == "youtu.be":
            candidate = parsed.path.strip("/").split("/")[0]
        elif host in {"youtube.com", "m.youtube.com"}:
            if parsed.path.startswith("/live/"):
                candidate = parsed.path.split("/", 3)[2]
            elif parsed.path == "/watch":
                candidate = parse_qs(parsed.query).get("v", [""])[0]
            else:
                candidate = ""
        else:
            return None
        return candidate if len(candidate) == 11 and candidate.replace("-", "").replace("_", "").isalnum() else None

    async def stop(self) -> None:
        task, self._task = self._task, None
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        self._source = None

    def status(self) -> dict[str, Any]:
        return {
            "chat_connected": self.connected,
            "chat_source_configured": bool(self._source),
            "chat_error": self.last_error,
            "participants": len(self.registry.snapshot()),
        }

    @staticmethod
    def initial_payload_from_html(html: str) -> dict[str, Any]:
        """Extracts the current public-chat bootstrap object from YouTube HTML."""
        for marker in ('window["ytInitialData"]', "var ytInitialData"):
            marker_index = html.find(marker)
            if marker_index < 0:
                continue
            assignment_index = html.find("=", marker_index)
            if assignment_index < 0:
                continue
            try:
                payload, _ = json.JSONDecoder().raw_decode(html[assignment_index + 1 :].lstrip())
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict):
                return payload
        raise ValueError("O YouTube não entregou os dados públicos do chat desta live.")

    @staticmethod
    def public_author_from_chat_item(item: dict[str, Any]) -> tuple[str, str, dict[str, Any]] | None:
        """Returns only the public author identity and role flags, never message text."""
        renderer = next(
            (
                value
                for name, value in item.items()
                if name.endswith("Renderer") and isinstance(value, dict) and value.get("authorExternalChannelId")
            ),
            None,
        )
        if not renderer:
            return None
        author_name = renderer.get("authorName") or {}
        if isinstance(author_name, dict):
            display_name = author_name.get("simpleText") or "".join(
                run.get("text", "") for run in author_name.get("runs", []) if isinstance(run, dict)
            )
        else:
            display_name = str(author_name)
        flags: dict[str, Any] = {}
        for badge in renderer.get("authorBadges", []):
            if not isinstance(badge, dict):
                continue
            badge_renderer = next((value for value in badge.values() if isinstance(value, dict)), {})
            icon_type = str((badge_renderer.get("icon") or {}).get("iconType", "")).upper()
            if "OWNER" in icon_type:
                flags["isChatOwner"] = True
            elif "MODERATOR" in icon_type:
                flags["isChatModerator"] = True
            elif "SPONSOR" in icon_type or "MEMBER" in icon_type:
                flags["isChatSponsor"] = True
        thumbnails = (renderer.get("authorPhoto") or {}).get("thumbnails", [])
        for thumbnail in reversed(thumbnails):
            if isinstance(thumbnail, dict) and trusted_profile_image_url(str(thumbnail.get("url", ""))):
                flags["profileImageUrl"] = str(thumbnail["url"])
                break
        channel_id = str(renderer.get("authorExternalChannelId", "")).strip()
        return (channel_id, str(display_name).strip(), flags) if channel_id and str(display_name).strip() else None

    @staticmethod
    def _embedded_value(html: str, name: str) -> str | None:
        marker = f'"{name}":"'
        start = html.find(marker)
        if start < 0:
            return None
        start += len(marker)
        end = html.find('"', start)
        return html[start:end] if end > start else None

    @staticmethod
    def _continuation_from(payload: dict[str, Any]) -> tuple[str, float]:
        for continuation in payload.get("continuations", []):
            if not isinstance(continuation, dict):
                continue
            for value in continuation.values():
                if not isinstance(value, dict) or not value.get("continuation"):
                    continue
                wait_ms = int(value.get("timeoutMs", 5_000))
                return str(value["continuation"]), max(1.5, min(wait_ms / 1_000, 15))
        raise ValueError("O YouTube não forneceu a continuação do chat público.")

    def _ingest_actions(self, actions: list[dict[str, Any]]) -> bool:
        changed = False
        for action in actions:
            item = (action.get("addChatItemAction") or {}).get("item") if isinstance(action, dict) else None
            if not isinstance(item, dict):
                continue
            author = self.public_author_from_chat_item(item)
            if author:
                changed |= self.registry.add_public_author(*author)
        return changed

    async def _broadcast_changes(self, changed: bool) -> None:
        if changed:
            await self.hub.broadcast({"type": "participants", "data": self.registry.snapshot()})
        await self.hub.broadcast({"type": "status", "data": self.status()})

    async def _run(self) -> None:
        assert self._source
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=self.browser_headers) as client:
                public_url = f"{self.chat_page}?v={self._source}&embed_domain=www.youtube.com"
                initial_response = await client.get(public_url)
                initial_response.raise_for_status()
                initial = self.initial_payload_from_html(initial_response.text)
                live_chat = (initial.get("contents") or {}).get("liveChatRenderer")
                if not isinstance(live_chat, dict):
                    raise ValueError("O chat desta live não está disponível publicamente no momento.")
                api_key = self._embedded_value(initial_response.text, "INNERTUBE_API_KEY")
                client_version = self._embedded_value(initial_response.text, "INNERTUBE_CLIENT_VERSION")
                if not api_key or not client_version:
                    raise ValueError("O YouTube não forneceu a configuração pública do chat.")
                continuation, wait_seconds = self._continuation_from(live_chat)
                self.last_error = None
                changed = self._ingest_actions(live_chat.get("actions", []))
                changed |= self.registry.expire_inactive()
                await self._broadcast_changes(changed)
                while True:
                    expiry_wait = self.registry.seconds_until_expiry()
                    await asyncio.sleep(min(wait_seconds, expiry_wait) if expiry_wait is not None else wait_seconds)
                    if self.registry.expire_inactive():
                        await self._broadcast_changes(True)
                    response = await client.post(
                        self.continuation_endpoint,
                        params={"key": api_key},
                        headers={
                            "Content-Type": "application/json",
                            "Origin": "https://www.youtube.com",
                            "X-YouTube-Client-Name": "1",
                            "X-YouTube-Client-Version": client_version,
                        },
                        json={
                            "context": {
                                "client": {
                                    "clientName": "WEB",
                                    "clientVersion": client_version,
                                    "originalUrl": public_url,
                                }
                            },
                            "continuation": continuation,
                        },
                    )
                    response.raise_for_status()
                    live_chat = (response.json().get("continuationContents") or {}).get("liveChatContinuation")
                    if not isinstance(live_chat, dict):
                        raise ValueError("O YouTube encerrou ou ocultou o chat desta live.")
                    continuation, wait_seconds = self._continuation_from(live_chat)
                    self.last_error = None
                    changed = self._ingest_actions(live_chat.get("actions", []))
                    changed |= self.registry.expire_inactive()
                    await self._broadcast_changes(changed)
        except asyncio.CancelledError:
            raise
        except httpx.HTTPStatusError as error:
            self.last_error = f"YouTube respondeu HTTP {error.response.status_code} ao ler o chat público."
        except httpx.HTTPError:
            self.last_error = "Não foi possível alcançar o chat público do YouTube. Verifique a conexão."
        except ValueError as error:
            self.last_error = str(error)
        except Exception:
            self.last_error = "Não foi possível ler o chat público agora. Tente conectar novamente."
        finally:
            self._task = None
            await self.hub.broadcast({"type": "status", "data": self.status()})


class StreamController:
    """Relays the browser's Three.js canvas to YouTube without exposing keys."""

    def __init__(self) -> None:
        self.process: subprocess.Popen[str] | None = None
        self.last_error: str | None = None
        self._runtime_endpoint: str | None = None
        self._runtime_stream_key: str | None = None
        self._canvas_chunks: CanvasChunkBuffer | None = None
        self._writer_stop: threading.Event | None = None
        self._writer: threading.Thread | None = None
        self._stderr_reader: threading.Thread | None = None

    def config(self) -> tuple[str, str]:
        return (
            self._runtime_endpoint or os.getenv("YOUTUBE_RTMPS_URL", "rtmps://a.rtmps.youtube.com:443/live2").strip(),
            self._runtime_stream_key or os.getenv("YOUTUBE_STREAM_KEY", "").strip(),
        )

    def configure(self, stream_key: str, endpoint: str | None = None) -> None:
        if not stream_key.strip():
            raise RuntimeError("Informe uma chave de transmissão.")
        self._runtime_stream_key = stream_key.strip()
        self._runtime_endpoint = endpoint.strip() if endpoint and endpoint.strip() else None
        self.last_error = None

    def status(self) -> dict[str, Any]:
        _, stream_key = self.config()
        running = self.process is not None and self.process.poll() is None
        return {
            "ffmpeg_available": shutil.which("ffmpeg") is not None,
            "stream_configured": bool(stream_key),
            "stream_running": running,
            "stream_source": "threejs-canvas",
            "stream_error": self.last_error,
        }

    @staticmethod
    def canvas_command(ffmpeg: str, target: str) -> list[str]:
        return [
            ffmpeg, "-hide_banner", "-loglevel", "warning", "-f", "webm", "-i", "pipe:0",
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-g", "60",
            "-b:v", "2500k", "-maxrate", "3000k", "-bufsize", "5000k",
            "-c:a", "aac", "-ar", "44100", "-b:a", "128k", "-f", "flv", target,
        ]

    def start(self) -> None:
        if self.process is not None and self.process.poll() is None:
            return
        ffmpeg = shutil.which("ffmpeg")
        endpoint, stream_key = self.config()
        if not ffmpeg:
            raise RuntimeError("FFmpeg não foi encontrado no PATH deste computador.")
        if not stream_key:
            raise RuntimeError("Informe a chave de transmissão do YouTube.")
        self.last_error = None
        # The key stays server-side; FFmpeg receives WebM chunks from /ws/output.
        target = f"{endpoint.rstrip('/')}/{stream_key}"
        command = self.canvas_command(ffmpeg, target)
        try:
            self.process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
        except OSError as error:
            self.last_error = "Não foi possível iniciar o FFmpeg."
            raise RuntimeError(self.last_error) from error
        self._canvas_chunks = CanvasChunkBuffer()
        self._writer_stop = threading.Event()
        self._writer = threading.Thread(target=self._forward_canvas_chunks, name="canvas-ffmpeg", daemon=True)
        self._writer.start()
        self._stderr_reader = threading.Thread(target=self._capture_delivery_errors, name="ffmpeg-errors", daemon=True)
        self._stderr_reader.start()

    def _capture_delivery_errors(self) -> None:
        process = self.process
        if process is None or process.stderr is None:
            return
        markers = ("error", "failed", "refused", "unauthorized", "forbidden", "broken pipe", "timed out", "unreachable", "reset")
        for raw_line in iter(process.stderr.readline, b""):
            line = raw_line.decode("utf-8", errors="replace") if isinstance(raw_line, bytes) else raw_line
            if any(marker in line.lower() for marker in markers):
                self.last_error = classify_ffmpeg_delivery_error(line)

    def _forward_canvas_chunks(self) -> None:
        """Keeps slow FFmpeg pipe writes away from the async WebSocket handler."""
        while self._writer_stop and not self._writer_stop.is_set():
            chunk = self._canvas_chunks.next_chunk(timeout=0.25) if self._canvas_chunks else None
            if not chunk:
                continue
            process = self.process
            if process is None or process.poll() is not None or not process.stdin:
                if not self.last_error:
                    self.last_error = "O FFmpeg parou de receber o canvas 3D."
                return
            try:
                process.stdin.write(chunk)
                process.stdin.flush()
            except (BrokenPipeError, OSError):
                if not self.last_error:
                    self.last_error = "O FFmpeg parou de receber o canvas 3D."
                return

    def write_canvas_chunk(self, chunk: bytes) -> None:
        """Queues a WebM chunk without blocking FastAPI's WebSocket event loop."""
        if not chunk or self.process is None or self.process.poll() is not None or self._canvas_chunks is None:
            raise RuntimeError("O receptor de vídeo 3D não está ativo.")
        self._canvas_chunks.push(chunk)

    def stop(self) -> None:
        if self._writer_stop:
            self._writer_stop.set()
        if self.process and self.process.poll() is None:
            if self.process.stdin:
                with suppress(OSError):
                    self.process.stdin.close()
            self.process.terminate()
            try:
                self.process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                self.process.kill()
        if self._writer and self._writer.is_alive():
            self._writer.join(timeout=1)
        if self._stderr_reader and self._stderr_reader.is_alive():
            self._stderr_reader.join(timeout=1)
        self.process = None
        self._canvas_chunks = None
        self._writer_stop = None
        self._writer = None
        self._stderr_reader = None


class CanvasChunkBuffer:
    """Small latest-first buffer that prevents slow network output from growing memory."""

    def __init__(self, max_chunks: int = 12) -> None:
        self._chunks: queue.Queue[bytes] = queue.Queue(maxsize=max_chunks)

    def push(self, chunk: bytes) -> None:
        try:
            self._chunks.put_nowait(chunk)
        except queue.Full:
            with suppress(queue.Empty):
                self._chunks.get_nowait()
            with suppress(queue.Full):
                self._chunks.put_nowait(chunk)

    def next_chunk(self, timeout: float) -> bytes | None:
        try:
            return self._chunks.get(timeout=timeout)
        except queue.Empty:
            return None


class ChatConnectRequest(BaseModel):
    source: str = Field(min_length=11, max_length=500)


class DemoJoinRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=32)


class StreamConfigRequest(BaseModel):
    stream_key: str = Field(min_length=8, max_length=250)
    endpoint: str | None = Field(default=None, max_length=250)


registry = ParticipantRegistry()
hub = SocketHub()
chat_worker = PublicChatWorker(registry, hub)
stream = StreamController()


def dashboard_status() -> dict[str, Any]:
    return {**chat_worker.status(), **stream.status(), "participants": len(registry.snapshot())}


@asynccontextmanager
async def lifespan(_: FastAPI):
    live_url = os.getenv("YOUTUBE_LIVE_URL", "").strip()
    if live_url:
        await chat_worker.start(live_url)
    try:
        yield
    finally:
        await chat_worker.stop()
        stream.stop()


app = FastAPI(title="Live Gamer 3D", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
if CHARACTERS_DIR.is_dir():
    app.mount("/assets/characters", StaticFiles(directory=CHARACTERS_DIR), name="characters")


@app.get("/", include_in_schema=False)
async def home() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/status")
async def get_status() -> dict[str, Any]:
    return dashboard_status()


@app.get("/api/participants")
async def get_participants() -> list[dict[str, Any]]:
    if registry.expire_inactive():
        await hub.broadcast({"type": "participants", "data": registry.snapshot()})
    return registry.snapshot()


@app.get("/api/profile-image/{avatar_id}")
async def get_profile_image(avatar_id: str) -> Response:
    image_url = registry.profile_image_url(avatar_id)
    if not image_url or not trusted_profile_image_url(image_url):
        raise HTTPException(status_code=404, detail="Foto pública não disponível para este participante.")
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            response = await client.get(image_url, headers={"User-Agent": PublicChatWorker.browser_headers["User-Agent"]})
            response.raise_for_status()
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="Não foi possível carregar a foto pública agora.") from error
    if not trusted_profile_image_url(str(response.url)):
        raise HTTPException(status_code=502, detail="A foto pública redirecionou para um endereço não permitido.")
    content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
    if not content_type.startswith("image/") or len(response.content) > 1_000_000:
        raise HTTPException(status_code=502, detail="A resposta da foto pública não é uma imagem válida.")
    return Response(
        content=response.content,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=60"},
    )


@app.post("/api/chat/connect")
async def connect_public_chat(body: ChatConnectRequest) -> dict[str, Any]:
    await chat_worker.start(body.source)
    return dashboard_status()


@app.post("/api/chat/disconnect")
async def disconnect_public_chat() -> dict[str, Any]:
    await chat_worker.stop()
    return dashboard_status()


@app.post("/api/demo/join")
async def add_demo_participant(body: DemoJoinRequest) -> dict[str, Any]:
    try:
        registry.add_demo(body.display_name)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    participants = registry.snapshot()
    await hub.broadcast({"type": "participants", "data": participants})
    return {"participants": participants}


@app.post("/api/demo/leave")
async def remove_demo_participant(body: DemoJoinRequest) -> dict[str, Any]:
    if not registry.remove_demo(body.display_name):
        raise HTTPException(status_code=404, detail="Esse avatar de teste não está no palco.")
    participants = registry.snapshot()
    await hub.broadcast({"type": "participants", "data": participants})
    return {"participants": participants}


@app.post("/api/participants/clear")
async def clear_participants() -> dict[str, Any]:
    registry.clear()
    await hub.broadcast({"type": "participants", "data": []})
    return {"ok": True}


@app.post("/api/stream/start")
async def start_stream() -> dict[str, Any]:
    try:
        stream.start()
    except RuntimeError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return dashboard_status()


@app.post("/api/stream/configure")
async def configure_stream(body: StreamConfigRequest) -> dict[str, Any]:
    try:
        stream.configure(body.stream_key, body.endpoint)
    except RuntimeError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return dashboard_status()


@app.post("/api/stream/stop")
async def stop_stream() -> dict[str, Any]:
    stream.stop()
    return dashboard_status()


@app.websocket("/ws/output")
async def canvas_output(socket: WebSocket) -> None:
    """Receives the live WebM capture of renderer.domElement from this local browser."""
    await socket.accept()
    try:
        while True:
            try:
                stream.write_canvas_chunk(await socket.receive_bytes())
            except RuntimeError:
                await socket.close(code=1011)
                return
    except WebSocketDisconnect:
        # A disconnected local renderer must not leave an empty FFmpeg relay running.
        stream.stop()
        await hub.broadcast({"type": "status", "data": dashboard_status()})


@app.websocket("/ws")
async def live_updates(socket: WebSocket) -> None:
    await hub.connect(socket)
    try:
        await socket.send_json({"type": "participants", "data": registry.snapshot()})
        await socket.send_json({"type": "status", "data": dashboard_status()})
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        hub.disconnect(socket)
