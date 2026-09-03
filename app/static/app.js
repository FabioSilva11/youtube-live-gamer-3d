import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/utils/SkeletonUtils.js';
import {
  ArrivalQueue,
  entryMotion,
  exitMotion,
  normaliseEntryMode,
  normaliseExitMode,
} from '/static/animation.js';
import {
  captureSessionIsActive,
  createMusicCaptureRoute,
  pauseMusicPlayback,
  playMusicPlayback,
  startMusicForLive,
  stopMediaTracks,
  stopMusicForLive,
} from '/static/capture.js';
import { avatarLayoutFor, latestVisualParticipants } from '/static/layout.js';
import { inactiveProfileImageIds, topChatRanking } from '/static/ranking.js';
import { disposeOwnedRenderObject } from '/static/resources.js';
import { mergeDashboardStatus } from '/static/status.js';
import { terrainHeightAt } from '/static/terrain.js';
import {
  outputCameraPreset,
  outputDimensions,
  pixOverlayLayout,
  previewFovForAspect,
  rankingOverlayLayout,
} from '/static/output.js?v=mercado-pago-pix-4';
import {
  avatarActivityAnimation,
  explorationTarget,
  socialCycleIndex,
  socialInteractionPhase,
  socialMeetingTarget,
  socialPartnerIndex,
} from '/static/social.js';

const api = async (path, options = {}) => {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Não foi possível concluir a ação.');
  return data;
};

const elements = {
  scene: document.querySelector('#scene'), count: document.querySelector('#participant-count'),
  onlineCopy: document.querySelector('#online-copy'), streamStatus: document.querySelector('#stream-status'),
  streamNote: document.querySelector('#stream-note'), liveSource: document.querySelector('#live-source'),
  rankingList: document.querySelector('#ranking-list'), rankingTotal: document.querySelector('#ranking-total'),
  mercadoPagoState: document.querySelector('#mercado-pago-state'),
  mercadoPagoNote: document.querySelector('#mercado-pago-note'),
  mercadoPagoToken: document.querySelector('#mercado-pago-token'),
  mercadoPagoAmount: document.querySelector('#mercado-pago-amount'),
  mercadoPagoEmail: document.querySelector('#mercado-pago-email'),
  disableMercadoPago: document.querySelector('#disable-mercado-pago'),
  entryAnimation: document.querySelector('#entry-animation'), exitAnimation: document.querySelector('#exit-animation'),
  start: document.querySelector('#start-stream'), stop: document.querySelector('#stop-stream'),
  toast: document.querySelector('#toast'),
  musicFile: document.querySelector('#music-file'), musicName: document.querySelector('#music-name'),
  musicVolume: document.querySelector('#music-volume'), musicPlay: document.querySelector('#music-play'),
  musicPause: document.querySelector('#music-pause'), musicVolumeValue: document.querySelector('#music-volume-value'),
  sceneTip: document.querySelector('.scene-tip'),
  panelTabs: [...document.querySelectorAll('[data-panel-tab]')],
  panelCards: [...document.querySelectorAll('[data-panel]')],
};

let toastTimer;
let canvasRecorder = null;
let outputSocket = null;
let captureAudio = null;
let captureMediaStream = null;
let captureStopPromise = null;
let captureSessionGeneration = 0;
let captureWidth = 0;
let captureHeight = 0;
let previewCameraState = null;
let musicPlayer = null;
let musicObjectUrl = null;
let musicRoute = null;
let musicVolume = Number(elements.musicVolume.value) / 100;
let dashboardStatus = {};
let lastPresentedStreamError = null;
const arrivalQueue = new ArrivalQueue();
let entryAnimationMode = normaliseEntryMode(localStorage.getItem('live-gamer-entry-animation') || 'spotlight');
let exitAnimationMode = normaliseExitMode(localStorage.getItem('live-gamer-exit-animation') || 'walk');
elements.entryAnimation.value = entryAnimationMode;
elements.exitAnimation.value = exitAnimationMode;
updateMusicVolumePresentation();
function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 3600);
}

function updateMusicVolumePresentation() {
  const percentage = Number(elements.musicVolume.value);
  elements.musicVolume.style.setProperty('--volume-progress', `${percentage}%`);
  elements.musicVolumeValue.textContent = `${percentage}%`;
}

function activatePanelTab(name) {
  elements.panelTabs.forEach((tab) => {
    const selected = tab.dataset.panelTab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  elements.panelCards.forEach((card) => { card.hidden = card.dataset.panel !== name; });
}

function updateStatus(incomingStatus) {
  const status = mergeDashboardStatus(dashboardStatus, incomingStatus);
  dashboardStatus = status;
  const count = status.participants ?? avatars.size;
  elements.count.textContent = `${count} participante${count === 1 ? '' : 's'}`;
  const chatConnected = Boolean(status.chat_connected);
  elements.onlineCopy.textContent = chatConnected ? 'Chat ao vivo conectado' : 'Aguardando chat';
  const streaming = Boolean(status.stream_running);
  elements.streamStatus.textContent = status.stream_error ? 'ERRO DE ENVIO' : streaming ? 'AO VIVO' : status.stream_configured ? 'CONFIGURADA' : 'PRONTA';
  elements.streamStatus.style.color = status.stream_error ? '#ff6f7d' : streaming ? '#63eed2' : '';
  const hasLiveSource = Boolean(elements.liveSource.value.trim());
  elements.start.disabled = streaming || !status.ffmpeg_available || !status.stream_configured || !hasLiveSource;
  elements.stop.disabled = !streaming;
  elements.musicFile.disabled = streaming;
  if (status.stream_error) elements.streamNote.textContent = status.stream_error;
  else if (streaming) elements.streamNote.textContent = 'O canvas Three.js está sendo enviado ao YouTube em tempo real.';
  else if (!status.ffmpeg_available) elements.streamNote.textContent = 'Instale o FFmpeg e deixe-o disponível no PATH para transmitir.';
  else if (!hasLiveSource) elements.streamNote.textContent = 'Informe o link da live para liberar o envio e conectar o chat.';
  else if (!status.stream_configured) elements.streamNote.textContent = 'Cole a chave do YouTube Studio para liberar o envio do canvas 3D.';
  else elements.streamNote.textContent = 'Tudo pronto: a área 3D acima será a imagem da live.';
  updateMercadoPagoStatus(status);
  if (status.stream_error && status.stream_error !== lastPresentedStreamError) toast(status.stream_error);
  lastPresentedStreamError = status.stream_error || null;
  if (status.chat_error) toast(status.chat_error);
}

function updateMusicControls() {
  const hasMusic = Boolean(musicPlayer);
  elements.musicPlay.disabled = !hasMusic;
  elements.musicPause.disabled = !hasMusic;
}

async function ensureMusicRoute() {
  if (!musicPlayer) return null;
  if (!musicRoute) {
    const context = new AudioContext();
    musicPlayer.volume = 1;
    musicRoute = createMusicCaptureRoute(context, musicPlayer, musicVolume);
  }
  musicRoute.gain.gain.value = musicVolume;
  await musicRoute.context.resume();
  return musicRoute;
}

async function releaseSelectedMusic() {
  if (musicPlayer) stopMusicForLive(musicPlayer);
  if (musicRoute) {
    musicRoute.detachCaptureTrack();
    if (musicRoute.context.state !== 'closed') await musicRoute.context.close();
    musicRoute = null;
  }
  if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl);
  musicObjectUrl = null;
  musicPlayer = null;
}

// Three.js stage
function createRenderer() {
  const target = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  target.setPixelRatio(1);
  target.shadowMap.enabled = true;
  target.shadowMap.type = THREE.PCFShadowMap;
  target.outputColorSpace = THREE.SRGBColorSpace;
  target.toneMapping = THREE.ACESFilmicToneMapping;
  target.toneMappingExposure = 1.08;
  target.autoClear = false;
  return target;
}

const renderer = createRenderer();
elements.scene.append(renderer.domElement);
const scene = new THREE.Scene();
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 2;
skyCanvas.height = 512;
const skyContext = skyCanvas.getContext('2d');
const skyGradient = skyContext.createLinearGradient(0, 0, 0, skyCanvas.height);
skyGradient.addColorStop(0, '#245f9f');
skyGradient.addColorStop(.48, '#72b7dc');
skyGradient.addColorStop(.78, '#f4cda9');
skyGradient.addColorStop(1, '#f7e7d4');
skyContext.fillStyle = skyGradient;
skyContext.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
const skyTexture = new THREE.CanvasTexture(skyCanvas);
skyTexture.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTexture;
scene.fog = new THREE.Fog(0xa9cfe2, 25, 58);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const hudScene = new THREE.Scene();
const hudCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
const rankingCanvas = document.createElement('canvas');
rankingCanvas.width = 768; rankingCanvas.height = 430;
const rankingContext = rankingCanvas.getContext('2d');
const rankingTexture = new THREE.CanvasTexture(rankingCanvas);
rankingTexture.colorSpace = THREE.SRGBColorSpace;
const rankingSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rankingTexture, transparent: true, depthTest: false, depthWrite: false }));
hudScene.add(rankingSprite);
const rankingImages = new Map();
let currentRankingPeople = [];
const pixDonationCanvas = document.createElement('canvas');
pixDonationCanvas.width = 640; pixDonationCanvas.height = 700;
const pixDonationContext = pixDonationCanvas.getContext('2d');
const pixDonationTexture = new THREE.CanvasTexture(pixDonationCanvas);
pixDonationTexture.colorSpace = THREE.SRGBColorSpace;
const pixDonationSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: pixDonationTexture,
  transparent: true,
  depthTest: false,
  depthWrite: false,
}));
pixDonationSprite.visible = false;
hudScene.add(pixDonationSprite);
let loadedPixChargeId = null;
let loadingPixChargeId = null;

function hideMercadoPagoQr() {
  loadedPixChargeId = null;
  loadingPixChargeId = null;
  pixDonationSprite.visible = false;
}

function drawMercadoPagoQr(image, state) {
  const context = pixDonationContext;
  context.clearRect(0, 0, pixDonationCanvas.width, pixDonationCanvas.height);
  const gradient = context.createLinearGradient(0, 0, 640, 700);
  gradient.addColorStop(0, 'rgba(9, 66, 51, .97)');
  gradient.addColorStop(1, 'rgba(18, 45, 37, .97)');
  context.fillStyle = gradient;
  context.beginPath(); context.roundRect(10, 10, 620, 680, 38); context.fill();
  context.strokeStyle = '#79efd0'; context.lineWidth = 7; context.stroke();
  context.fillStyle = '#82f2d2'; context.font = '700 31px DM Mono, monospace';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText('APOIE A LIVE VIA PIX', 320, 50);
  context.fillStyle = '#ffffff';
  context.beginPath(); context.roundRect(55, 82, 530, 530, 28); context.fill();
  const qrSize = 470;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 85, 112, qrSize, qrSize);
  context.imageSmoothingEnabled = true;
  const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: state.currency || 'BRL' }).format(Number(state.amount));
  context.fillStyle = '#fff6ae'; context.font = '700 43px Outfit, Arial';
  context.fillText(formattedAmount, 320, 635);
  context.fillStyle = '#d8fff3'; context.font = '500 22px Outfit, Arial';
  context.fillText('Escaneie com o aplicativo do seu banco', 320, 672);
  pixDonationTexture.needsUpdate = true;
  pixDonationSprite.visible = true;
}

async function refreshMercadoPagoQr(expectedChargeId) {
  if (!expectedChargeId || loadingPixChargeId === expectedChargeId) return;
  loadingPixChargeId = expectedChargeId;
  try {
    const state = await api('/api/donations/mercado-pago/qr');
    if (!state.enabled || state.charge_id !== expectedChargeId || !state.qr_code_base64) return;
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', reject, { once: true });
      image.src = `data:image/png;base64,${state.qr_code_base64}`;
    });
    if (dashboardStatus.mercado_pago_charge_id !== expectedChargeId) return;
    drawMercadoPagoQr(image, state);
    loadedPixChargeId = expectedChargeId;
  } catch {
    if (dashboardStatus.mercado_pago_charge_id === expectedChargeId) {
      elements.mercadoPagoNote.textContent = 'Não foi possível desenhar o QR agora; o painel tentará novamente.';
    }
  } finally {
    if (loadingPixChargeId === expectedChargeId) loadingPixChargeId = null;
  }
}

function updateMercadoPagoStatus(status) {
  const configured = Boolean(status.mercado_pago_configured);
  const hasQr = configured && Boolean(status.mercado_pago_has_qr);
  elements.scene.classList.toggle('pix-active', hasQr);
  elements.disableMercadoPago.disabled = !configured;
  if (status.mercado_pago_error) {
    elements.mercadoPagoState.textContent = 'ERRO';
    elements.mercadoPagoNote.textContent = status.mercado_pago_error;
  } else if (hasQr) {
    elements.mercadoPagoState.textContent = 'ATIVO';
    const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(status.mercado_pago_amount));
    elements.mercadoPagoNote.textContent = `${amount} • consulta a cada ${status.mercado_pago_poll_interval || 5}s • renovação automática.`;
  } else if (configured) {
    elements.mercadoPagoState.textContent = 'CRIANDO QR';
    elements.mercadoPagoNote.textContent = 'Criando uma nova cobrança Pix no Mercado Pago.';
  } else {
    elements.mercadoPagoState.textContent = 'OPCIONAL';
    elements.mercadoPagoNote.textContent = 'Opcional. O QR vale por 30 minutos e é renovado automaticamente.';
  }
  const chargeId = hasQr ? status.mercado_pago_charge_id : null;
  if (!chargeId) hideMercadoPagoQr();
  else if (loadedPixChargeId !== chargeId) void refreshMercadoPagoQr(chargeId);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 7;
controls.maxPolarAngle = Math.PI * .47;
function applyOutputCameraPreset() {
  const preset = outputCameraPreset();
  camera.fov = preset.fov;
  camera.position.set(preset.position.x, preset.position.y, preset.position.z);
  controls.target.set(preset.target.x, preset.target.y, preset.target.z);
  controls.maxDistance = preset.maxDistance;
  scene.fog.near = preset.fog.near;
  scene.fog.far = preset.fog.far;
  camera.updateProjectionMatrix();
  controls.update();
}
applyOutputCameraPreset();
scene.add(new THREE.HemisphereLight(0xd8efff, 0x273b32, 1.7));
scene.add(new THREE.AmbientLight(0x9bb4bb, .42));
const sunlight = new THREE.DirectionalLight(0xffd7a0, 3.35);
sunlight.position.set(11, 15, 9); sunlight.castShadow = true; sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -11; sunlight.shadow.camera.right = 11; sunlight.shadow.camera.top = 11; sunlight.shadow.camera.bottom = -11;
sunlight.shadow.bias = -.0005; sunlight.shadow.normalBias = .025; scene.add(sunlight);
const warmFill = new THREE.PointLight(0xffc27a, 5.2, 26); warmFill.position.set(9, 8, -8); scene.add(warmFill);
const underIslandFill = new THREE.PointLight(0xffb45f, 7.5, 18, 1.7);
underIslandFill.position.set(0, -3.2, 9);
scene.add(underIslandFill);

function addTaperedSegment(parent, start, end, startRadius, endRadius, material, radialSegments = 6) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const segment = new THREE.Mesh(
    new THREE.CylinderGeometry(endRadius, startRadius, direction.length(), radialSegments),
    material,
  );
  segment.position.copy(start).add(end).multiplyScalar(.5);
  segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  segment.castShadow = true;
  segment.receiveShadow = true;
  parent.add(segment);
  return segment;
}

function addCurvedTube(parent, points, radius, material, tubularSegments = 28, radialSegments = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false),
    material,
  );
  tube.castShadow = true;
  tube.receiveShadow = true;
  parent.add(tube);
  return tube;
}

function createProceduralBumpTexture(seed = 0, bark = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const image = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const hash = Math.sin((x + seed * 19.1) * 12.9898 + (y + seed * 7.7) * 78.233) * 43758.5453;
      const noise = hash - Math.floor(hash);
      const grain = bark
        ? .5 + Math.sin(x * .31 + Math.sin(y * .07 + seed) * 2.4) * .28 + (noise - .5) * .22
        : .38 + Math.sin(x * .17 + y * .13 + seed) * .12 + noise * .42;
      const value = Math.max(0, Math.min(255, Math.round(grain * 255)));
      const offset = (y * canvas.width + x) * 4;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(bark ? 3 : 2.5, bark ? 1.4 : 2.5);
  return texture;
}

const rockBumpTexture = createProceduralBumpTexture(2.7);
const barkBumpTexture = createProceduralBumpTexture(8.3, true);

const floatingIsland = new THREE.Group();
scene.add(floatingIsland);
const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x754525, roughness: 1, flatShading: true, bumpMap: rockBumpTexture, bumpScale: .12 });
const islandRimGeometry = new THREE.CylinderGeometry(8.18, 7.98, .58, 64, 2);
const islandRimPositions = islandRimGeometry.getAttribute('position');
for (let index = 0; index < islandRimPositions.count; index += 1) {
  const x = islandRimPositions.getX(index);
  const z = islandRimPositions.getZ(index);
  const angle = Math.atan2(z, x);
  const breakup = 1 + Math.sin(angle * 5 + .3) * .034 + Math.sin(angle * 11 - .6) * .022;
  islandRimPositions.setX(index, x * breakup);
  islandRimPositions.setZ(index, z * breakup * .94);
}
islandRimGeometry.computeVertexNormals();
const islandRim = new THREE.Mesh(
  islandRimGeometry,
  [soilMaterial, new THREE.MeshStandardMaterial({ color: 0x4d9f3d, roughness: 1 }), soilMaterial],
);
islandRim.position.y = -.43;
islandRim.castShadow = true;
islandRim.receiveShadow = true;
floatingIsland.add(islandRim);

const islandRings = [
  { y: -.66, radius: 7.98 },
  { y: -1.12, radius: 7.35 },
  { y: -1.72, radius: 6.25 },
  { y: -2.38, radius: 4.95 },
  { y: -3.02, radius: 3.55 },
  { y: -4.05, radius: 2.05 },
  { y: -5.65, radius: .24 },
];
const islandLayerColors = [0x9b6137, 0x865030, 0x7d8981, 0x626e69, 0x765b43, 0x515d59];
const islandUndersidePositions = [];
const islandUndersideColors = [];
const islandSegments = 40;
function islandRingPoint(ringIndex, segmentIndex) {
  const ring = islandRings[ringIndex];
  const angle = segmentIndex / islandSegments * Math.PI * 2;
  const breakup = 1 + Math.sin(angle * 5 + ringIndex * .8) * .035 + Math.sin(angle * 11 - ringIndex) * .022;
  return new THREE.Vector3(
    Math.cos(angle) * ring.radius * breakup,
    ring.y + Math.sin(angle * 7 + ringIndex) * .05,
    Math.sin(angle) * ring.radius * breakup * .94,
  );
}
function pushIslandTriangle(first, second, third, color) {
  [first, second, third].forEach((point) => {
    islandUndersidePositions.push(point.x, point.y, point.z);
    islandUndersideColors.push(color.r, color.g, color.b);
  });
}
for (let ringIndex = 0; ringIndex < islandRings.length - 1; ringIndex += 1) {
  for (let segmentIndex = 0; segmentIndex < islandSegments; segmentIndex += 1) {
    const nextSegment = (segmentIndex + 1) % islandSegments;
    const topLeft = islandRingPoint(ringIndex, segmentIndex);
    const topRight = islandRingPoint(ringIndex, nextSegment);
    const bottomLeft = islandRingPoint(ringIndex + 1, segmentIndex);
    const bottomRight = islandRingPoint(ringIndex + 1, nextSegment);
    const shade = Math.sin(segmentIndex * 1.73 + ringIndex) * .035;
    const layerColor = new THREE.Color(islandLayerColors[ringIndex]).offsetHSL(0, 0, shade);
    pushIslandTriangle(topLeft, topRight, bottomLeft, layerColor);
    pushIslandTriangle(topRight, bottomRight, bottomLeft, layerColor.clone().offsetHSL(0, 0, -.025));
  }
}
const islandUndersideGeometry = new THREE.BufferGeometry();
islandUndersideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(islandUndersidePositions, 3));
islandUndersideGeometry.setAttribute('color', new THREE.Float32BufferAttribute(islandUndersideColors, 3));
islandUndersideGeometry.computeVertexNormals();
const islandUnderside = new THREE.Mesh(
  islandUndersideGeometry,
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
    fog: false,
    emissive: 0x1c100b,
    emissiveIntensity: .25,
  }),
);
islandUnderside.castShadow = true;
islandUnderside.receiveShadow = true;
floatingIsland.add(islandUnderside);

const rootMaterial = new THREE.MeshStandardMaterial({ color: 0x5b351f, roughness: 1, flatShading: true, bumpMap: barkBumpTexture, bumpScale: .1 });
function hangingRoot(points, thickness = .075) {
  const root = new THREE.Group();
  points.slice(0, -1).forEach((point, index) => {
    const taper = 1 - index / (points.length + 1);
    addTaperedSegment(
      root,
      new THREE.Vector3(...point),
      new THREE.Vector3(...points[index + 1]),
      thickness * taper,
      Math.max(.018, thickness * (taper - .17)),
      rootMaterial,
      5,
    );
  });
  floatingIsland.add(root);
}
hangingRoot([[-6.2, -.55, 4.65], [-6.08, -1.2, 4.72], [-6.28, -1.92, 4.65], [-6.18, -2.52, 4.72]], .095);
hangingRoot([[-3.6, -.58, 7.05], [-3.48, -1.15, 7.0], [-3.62, -1.65, 6.96]], .075);
hangingRoot([[.4, -.6, 7.62], [.28, -1.34, 7.55], [.42, -2.04, 7.48], [.35, -2.72, 7.43]], .09);
hangingRoot([[5.15, -.55, 5.55], [5.05, -1.18, 5.45], [5.2, -1.7, 5.38]], .07);
hangingRoot([[7.15, -.52, 2.15], [7.06, -1.1, 2.08], [7.18, -1.58, 2.02]], .065);

const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0x59635d, roughness: 1, flatShading: true });
[
  [-5.4, -2.35, 4.15, .18], [-2.8, -3.05, 5.2, .13], [.85, -3.42, 4.25, .16],
  [3.65, -2.72, 4.75, .12], [5.42, -2.1, 2.72, .14], [-.9, -3.75, 2.15, .1],
].forEach(([x, y, z, scale], index) => {
  const debris = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), debrisMaterial);
  debris.position.set(x, y, z);
  debris.rotation.set(index * .23, index * .41, index * .18);
  debris.castShadow = true;
  floatingIsland.add(debris);
});

const undersideDetailGroup = new THREE.Group();
floatingIsland.add(undersideDetailGroup);
const undersideRockGeometry = new THREE.DodecahedronGeometry(1, 1);
const undersideRockMaterial = new THREE.MeshStandardMaterial({
  color: 0x5d625e,
  roughness: .98,
  metalness: .02,
  flatShading: true,
  bumpMap: rockBumpTexture,
  bumpScale: .16,
});
const undersideLayers = [
  { count: 15, radius: 6.7, y: -1.05, scale: 1.28 },
  { count: 12, radius: 5.25, y: -1.82, scale: 1.18 },
  { count: 9, radius: 3.75, y: -2.72, scale: 1.05 },
  { count: 6, radius: 2.35, y: -3.62, scale: .88 },
  { count: 3, radius: .9, y: -4.55, scale: .72 },
];
const undersideRockCount = undersideLayers.reduce((total, layer) => total + layer.count, 0);
const undersideRocks = new THREE.InstancedMesh(undersideRockGeometry, undersideRockMaterial, undersideRockCount);
const undersideRockTransform = new THREE.Object3D();
const undersideRockColor = new THREE.Color();
let undersideRockIndex = 0;
undersideLayers.forEach((layer, layerIndex) => {
  for (let index = 0; index < layer.count; index += 1) {
    const angle = index / layer.count * Math.PI * 2 + layerIndex * .47;
    const stagger = 1 + Math.sin(index * 2.13 + layerIndex) * .13;
    undersideRockTransform.position.set(
      Math.cos(angle) * layer.radius * stagger,
      layer.y + Math.sin(index * 1.71) * .24,
      Math.sin(angle) * layer.radius * .9 * stagger,
    );
    undersideRockTransform.rotation.set(index * .41, angle + index * .19, layerIndex * .27 - .2);
    undersideRockTransform.scale.set(
      layer.scale * (.72 + (index % 4) * .11),
      layer.scale * (1.05 + (index % 3) * .18),
      layer.scale * (.68 + (index % 5) * .08),
    );
    undersideRockTransform.updateMatrix();
    undersideRocks.setMatrixAt(undersideRockIndex, undersideRockTransform.matrix);
    undersideRockColor.setHSL(.1 + (index % 3) * .012, .09, .29 + (index % 5) * .026);
    undersideRocks.setColorAt(undersideRockIndex, undersideRockColor);
    undersideRockIndex += 1;
  }
});
undersideRocks.castShadow = true;
undersideRocks.receiveShadow = true;
undersideDetailGroup.add(undersideRocks);

const deepSpireMaterial = new THREE.MeshStandardMaterial({
  color: 0x3f4947,
  roughness: 1,
  flatShading: true,
  emissive: 0x111b1b,
  emissiveIntensity: .12,
});
[
  [0, -3.45, .15, 1.5, 5.4, 0, 0],
  [-1.65, -3.1, .25, .82, 3.85, -.13, .18],
  [1.55, -3.05, .35, .9, 4.05, .11, -.16],
  [-2.65, -2.65, -.15, .62, 3.1, -.2, .12],
  [2.75, -2.55, -.05, .58, 2.9, .18, -.11],
].forEach(([x, y, z, radius, height, tiltX, tiltZ], index) => {
  const spire = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7 + index % 2, 4), deepSpireMaterial);
  spire.position.set(x, y, z);
  spire.rotation.set(tiltX, index * .73, Math.PI + tiltZ);
  spire.scale.z = .72 + index * .045;
  spire.castShadow = true;
  spire.receiveShadow = true;
  undersideDetailGroup.add(spire);
});

const mossPatchMaterial = new THREE.MeshStandardMaterial({ color: 0x365c31, roughness: 1, flatShading: true });
[
  [-5.7, -.92, 3.9, 1.15], [-3.3, -1.45, 5.45, .82], [.4, -1.58, 6.15, .95],
  [4.65, -1.12, 4.35, 1.05], [6.15, -.88, 1.25, .72], [-1.75, -2.4, 3.55, .58],
].forEach(([x, y, z, scale], index) => {
  const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(.58, 1), mossPatchMaterial);
  moss.position.set(x, y, z);
  moss.scale.set(scale, .18 * scale, .58 * scale);
  moss.rotation.set(index * .18, index * .73, index * .11);
  undersideDetailGroup.add(moss);
});

const magicCrystals = [];
const crystalMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x35d9ff,
  emissive: 0x00aeea,
  emissiveIntensity: 2.35,
  roughness: .16,
  metalness: .08,
  transmission: .12,
  transparent: true,
  opacity: .94,
  clearcoat: 1,
});
[
  [-4.65, -1.72, 4.72, .95, -.42], [-1.45, -2.74, 4.88, 1.34, .18],
  [2.15, -3.15, 3.92, 1.02, -.16], [4.85, -1.78, 4.42, .88, .38],
  [.35, -4.08, 1.18, .72, -.28],
].forEach(([x, y, z, scale, tilt], index) => {
  const cluster = new THREE.Group();
  const mainShard = new THREE.Mesh(new THREE.ConeGeometry(.34, 1.35, 6), crystalMaterial);
  mainShard.rotation.z = Math.PI + tilt;
  mainShard.castShadow = true;
  cluster.add(mainShard);
  [-1, 1].forEach((side, shardIndex) => {
    const shard = new THREE.Mesh(new THREE.ConeGeometry(.18, .78, 5), crystalMaterial);
    shard.position.set(side * .28, -.18, .08 + shardIndex * .06);
    shard.rotation.z = Math.PI + tilt + side * .34;
    shard.castShadow = true;
    cluster.add(shard);
  });
  cluster.position.set(x, y, z);
  cluster.scale.setScalar(scale);
  cluster.userData = { phase: index * 1.37, baseScale: scale };
  undersideDetailGroup.add(cluster);
  magicCrystals.push(cluster);
  if (index < 3) {
    const glow = new THREE.PointLight(0x20cfff, 2.3, 4.8, 2);
    glow.position.set(x, y, z + .35);
    glow.userData.phase = index * 1.7;
    undersideDetailGroup.add(glow);
    cluster.userData.glow = glow;
  }
});

const vineMaterial = new THREE.MeshStandardMaterial({ color: 0x385238, roughness: 1 });
const hangingVines = [];
[
  [[-7.15, -.15, 2.85], [-7.28, -1.2, 2.96], [-7.05, -2.45, 2.82], [-7.22, -3.65, 2.92]],
  [[-4.9, -.35, 6.1], [-5.05, -1.25, 6.18], [-4.82, -2.3, 6.02]],
  [[2.3, -.2, 7.35], [2.48, -1.45, 7.42], [2.24, -2.72, 7.28], [2.42, -3.82, 7.35]],
  [[6.8, -.12, 3.2], [6.92, -1.12, 3.08], [6.74, -2.25, 3.18]],
  [[-.9, -1.1, 5.85], [-.72, -2.18, 5.96], [-.94, -3.4, 5.82]],
].forEach((points, index) => {
  const vine = new THREE.Group();
  const [anchorX, anchorY, anchorZ] = points[0];
  const localPoints = points.map(([x, y, z]) => [x - anchorX, y - anchorY, z - anchorZ]);
  addCurvedTube(vine, localPoints, .035 + (index % 2) * .012, vineMaterial, 34, 5);
  points.slice(1).forEach((point, pointIndex) => {
    if (pointIndex % 2) return;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(.11, 7, 5),
      new THREE.MeshStandardMaterial({ color: pointIndex % 3 ? 0x508c46 : 0x72a951, roughness: .9 }),
    );
    leaf.scale.set(1.4, .35, .7);
    leaf.position.set(point[0] - anchorX + .08, point[1] - anchorY, point[2] - anchorZ + .04);
    vine.add(leaf);
  });
  vine.position.set(anchorX, anchorY, anchorZ);
  vine.userData = { phase: index * 1.2 };
  undersideDetailGroup.add(vine);
  hangingVines.push(vine);
});

function createIrregularDiscGeometry(radius, radialSegments = 16, angularSegments = 96) {
  const positions = [0, 0, 0];
  const indices = [];
  for (let ring = 1; ring <= radialSegments; ring += 1) {
    const ringProgress = ring / radialSegments;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angle = segment / angularSegments * Math.PI * 2;
      const boundary = 1 + Math.sin(angle * 5.0) * .034 + Math.sin(angle * 11.0 + .8) * .021;
      const localRadius = radius * ringProgress * (1 + (boundary - 1) * ringProgress ** 2);
      positions.push(Math.cos(angle) * localRadius, Math.sin(angle) * localRadius * .94, 0);
    }
  }
  for (let segment = 0; segment < angularSegments; segment += 1) {
    indices.push(0, 1 + segment, 1 + (segment + 1) % angularSegments);
  }
  for (let ring = 1; ring < radialSegments; ring += 1) {
    const innerStart = 1 + (ring - 1) * angularSegments;
    const outerStart = 1 + ring * angularSegments;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const next = (segment + 1) % angularSegments;
      const innerLeft = innerStart + segment;
      const innerRight = innerStart + next;
      const outerLeft = outerStart + segment;
      const outerRight = outerStart + next;
      indices.push(innerLeft, outerLeft, innerRight, innerRight, outerLeft, outerRight);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

const meadowGeometry = createIrregularDiscGeometry(8.25);
const meadowPositions = meadowGeometry.getAttribute('position');
const meadowColors = [];
const meadowColor = new THREE.Color();
for (let index = 0; index < meadowPositions.count; index += 1) {
  const x = meadowPositions.getX(index);
  const z = -meadowPositions.getY(index);
  const height = terrainHeightAt(x, z);
  meadowPositions.setZ(index, height);
  meadowColor.setHSL(.285 + Math.sin(x * .8 + z) * .014, .62, .35 + height * .12);
  meadowColors.push(meadowColor.r, meadowColor.g, meadowColor.b);
}
meadowGeometry.setAttribute('color', new THREE.Float32BufferAttribute(meadowColors, 3));
meadowGeometry.computeVertexNormals();
const springMeadow = new THREE.Mesh(
  meadowGeometry,
  new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .9, metalness: 0, side: THREE.DoubleSide })
);
springMeadow.rotation.x = -Math.PI / 2; springMeadow.receiveShadow = true; scene.add(springMeadow);

const springLake = new THREE.Mesh(
  new THREE.CircleGeometry(1.3, 48),
  new THREE.MeshPhysicalMaterial({ color: 0x32bfe8, roughness: .12, metalness: .05, transmission: .22, clearcoat: 1, clearcoatRoughness: .08, transparent: true, opacity: .9 })
);
springLake.rotation.x = -Math.PI / 2; springLake.scale.set(1.35, .72, 1); springLake.position.set(-3.8, -.2, -1.4); springLake.receiveShadow = true; scene.add(springLake);
const lakeRipples = Array.from({ length: 3 }, (_, index) => {
  const ripple = new THREE.Mesh(
    new THREE.TorusGeometry(.34 + index * .25, .012, 6, 48),
    new THREE.MeshBasicMaterial({ color: 0xc9f8ff, transparent: true, opacity: .5 - index * .1, depthWrite: false }),
  );
  ripple.rotation.x = Math.PI / 2; ripple.position.set(-3.8, -.175 + index * .002, -1.4); ripple.scale.y = .58; scene.add(ripple);
  return ripple;
});
const lilyPadMaterial = new THREE.MeshStandardMaterial({ color: 0x4d8a45, roughness: .92, side: THREE.DoubleSide });
[
  [-4.45, -1.52, .18], [-3.25, -1.66, .15], [-3.9, -1.02, .13], [-4.15, -1.86, .11],
].forEach(([x, z, scale], index) => {
  const pad = new THREE.Mesh(new THREE.CircleGeometry(scale, 18, .22, Math.PI * 1.72), lilyPadMaterial);
  pad.rotation.x = -Math.PI / 2;
  pad.rotation.z = index * 1.17;
  pad.position.set(x, -.155 + index * .002, z);
  scene.add(pad);
});

const rocksGroup = new THREE.Group();
const waterGroup = new THREE.Group();
const waterfallGroup = new THREE.Group();
scene.add(rocksGroup, waterGroup, waterfallGroup);
const mountainRockMaterials = [0x4f5755, 0x626b65, 0x747b70, 0x3e4745].map(
  (color) => new THREE.MeshStandardMaterial({
    color,
    roughness: .96,
    flatShading: true,
    emissive: color,
    emissiveIntensity: .035,
    bumpMap: rockBumpTexture,
    bumpScale: .15,
  }),
);
[
  [-4.05, .35, -4.55, 1.45, 1.4, 1.2], [-3.15, .28, -4.35, 1.2, 1.15, 1.15],
  [-4.72, .2, -3.9, 1.15, 1.05, 1.05], [-3.72, 1.25, -4.72, 1.08, 1.25, .95],
  [-4.5, 1.2, -4.35, .9, 1.15, .82], [-3.35, 1.35, -4.55, .82, 1.08, .8],
  [-3.95, 2.15, -4.72, .74, 1.05, .7], [-4.55, 2.0, -4.55, .58, .82, .62],
  [-2.82, .62, -3.72, .72, .68, .78], [-5.18, .52, -3.45, .78, .7, .82],
].forEach(([x, y, z, sx, sy, sz], index) => {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), mountainRockMaterials[index % mountainRockMaterials.length]);
  rock.position.set(x, y, z);
  rock.scale.set(sx, sy, sz);
  rock.rotation.set(index * .16, index * .63, index * .11 - .2);
  rock.castShadow = true;
  rock.receiveShadow = true;
  rocksGroup.add(rock);
});
[
  [-4.65, 1.58, -4.15, .72], [-3.45, .96, -4.02, .65], [-4.12, 2.65, -4.5, .5],
].forEach(([x, y, z, scale], index) => {
  const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(.55, 1), mossPatchMaterial);
  moss.position.set(x, y, z);
  moss.scale.set(scale, .22 * scale, .72 * scale);
  moss.rotation.y = index * 1.2;
  rocksGroup.add(moss);
});

const waterfallMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    deepColor: { value: new THREE.Color(0x2ab6dc) },
    foamColor: { value: new THREE.Color(0xe8fbff) },
  },
  vertexShader: `
    varying vec2 vUv;
    uniform float time;
    void main() {
      vUv = uv;
      vec3 p = position;
      p.x += sin((uv.y * 18.0) + time * 2.0) * 0.025;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float time;
    uniform vec3 deepColor;
    uniform vec3 foamColor;
    void main() {
      float stream = sin(vUv.x * 42.0 + vUv.y * 7.0 - time * 5.0) * 0.5 + 0.5;
      float ripples = sin(vUv.y * 55.0 - time * 7.5) * 0.5 + 0.5;
      float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
      vec3 color = mix(deepColor, foamColor, stream * 0.5 + ripples * 0.22);
      float alpha = edge * (0.48 + stream * 0.27);
      gl_FragColor = vec4(color, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.NormalBlending,
});
const waterfallSheets = [];
function createWaterfallSheet(x, y, z, width, height, rotationY = 0) {
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 10, 20), waterfallMaterial);
  sheet.position.set(x, y, z);
  sheet.rotation.y = rotationY;
  sheet.renderOrder = 3;
  waterfallGroup.add(sheet);
  waterfallSheets.push(sheet);
  return sheet;
}
createWaterfallSheet(-3.92, 1.83, -3.56, .72, 1.18, -.04);
createWaterfallSheet(-3.7, .82, -2.96, .9, .92, .05);
createWaterfallSheet(-3.78, .12, -2.24, 1.02, .62, -.03);

const foamMaterial = new THREE.MeshBasicMaterial({
  color: 0xe9fbff,
  transparent: true,
  opacity: .68,
  depthWrite: false,
});
[
  [-3.92, 1.2, -3.5, .46], [-3.7, .34, -2.88, .58], [-3.8, -.12, -1.92, .74],
].forEach(([x, y, z, scale]) => {
  const foam = new THREE.Mesh(new THREE.TorusGeometry(scale, .045, 6, 36), foamMaterial);
  foam.rotation.x = Math.PI / 2;
  foam.position.set(x, y, z);
  waterfallGroup.add(foam);
});

const streamCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-2.9, -.12, -1.1),
  new THREE.Vector3(-1.35, .02, .15),
  new THREE.Vector3(.25, .04, 1.85),
  new THREE.Vector3(2.25, .01, 4.2),
  new THREE.Vector3(3.72, -.03, 6.75),
]);
const streamMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x43c6dc,
  emissive: 0x0a566f,
  emissiveIntensity: .18,
  roughness: .14,
  transmission: .18,
  transparent: true,
  opacity: .82,
  clearcoat: 1,
});
const surfaceStream = new THREE.Mesh(new THREE.TubeGeometry(streamCurve, 72, .38, 10, false), streamMaterial);
surfaceStream.scale.y = .12;
surfaceStream.position.y = .015;
surfaceStream.receiveShadow = true;
waterGroup.add(surfaceStream);

const edgeWaterfall = createWaterfallSheet(3.72, -2.55, 6.92, 1.24, 5.25, -.035);
edgeWaterfall.geometry.translate(0, -.06, 0);
const edgeWaterfallSide = createWaterfallSheet(3.97, -2.36, 6.78, .66, 4.8, -.48);
edgeWaterfallSide.material = waterfallMaterial;
const edgeFoam = new THREE.Mesh(new THREE.TorusGeometry(.72, .075, 8, 48), foamMaterial);
edgeFoam.rotation.x = Math.PI / 2;
edgeFoam.scale.y = .62;
edgeFoam.position.set(3.72, -.08, 6.82);
waterfallGroup.add(edgeFoam);

const waterfallMistGeometry = new THREE.BufferGeometry();
const waterfallMistPositions = [];
for (let index = 0; index < 80; index += 1) {
  const angle = index * 2.3999632297;
  const radius = .12 + (index % 13) * .055;
  waterfallMistPositions.push(
    3.72 + Math.cos(angle) * radius,
    -4.95 + (index % 11) * .12,
    6.95 + Math.sin(angle) * radius * .42,
  );
}
waterfallMistGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterfallMistPositions, 3));
const waterfallMist = new THREE.Points(
  waterfallMistGeometry,
  new THREE.PointsMaterial({ color: 0xe7fbff, size: .09, transparent: true, opacity: .52, depthWrite: false }),
);
waterfallGroup.add(waterfallMist);

const pathMaterial = new THREE.MeshStandardMaterial({ color: 0xd6c58b, roughness: 1 });
for (let index = 0; index < 15; index += 1) {
  const z = -5.6 + index * .74;
  const x = 1.9 + Math.sin(index * .7) * .46;
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(.28, .34, .08, 7), pathMaterial);
  stone.position.set(x, terrainHeightAt(x, z) + .035, z); stone.rotation.y = index * .61; stone.receiveShadow = true; scene.add(stone);
}

const smallStoneCount = 38;
const smallStones = new THREE.InstancedMesh(
  new THREE.DodecahedronGeometry(.22, 1),
  new THREE.MeshStandardMaterial({ color: 0x7c8780, roughness: .98, flatShading: true }),
  smallStoneCount,
);
const smallStoneTransform = new THREE.Object3D();
const smallStoneColor = new THREE.Color();
for (let index = 0; index < smallStoneCount; index += 1) {
  const angle = index * 2.3999632297 + .4;
  const radius = 2.1 + (index % 11) * .48;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius * .88;
  smallStoneTransform.position.set(x, terrainHeightAt(x, z) + .08, z);
  smallStoneTransform.rotation.set(index * .27, angle, index * .19);
  const scale = .52 + (index % 5) * .12;
  smallStoneTransform.scale.set(scale, scale * .55, scale * .82);
  smallStoneTransform.updateMatrix();
  smallStones.setMatrixAt(index, smallStoneTransform.matrix);
  smallStoneColor.setHSL(.12, .07, .44 + (index % 4) * .035);
  smallStones.setColorAt(index, smallStoneColor);
}
smallStones.castShadow = true;
smallStones.receiveShadow = true;
scene.add(smallStones);

const grassBladeCount = 640;
const grassBlades = new THREE.InstancedMesh(
  new THREE.ConeGeometry(.032, .38, 3),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .94, flatShading: true }),
  grassBladeCount,
);
grassBlades.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const grassTransform = new THREE.Object3D();
const grassColor = new THREE.Color();
const grassState = [];
for (let candidate = 0; grassState.length < grassBladeCount; candidate += 1) {
  const angle = candidate * 2.3999632297;
  const radius = .72 + Math.sqrt((candidate + .5) / 760) * 7.15;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const lakeDistance = ((x + 3.8) ** 2) / 2.6 + ((z + 1.4) ** 2) / 1.25;
  if (lakeDistance < 1.05) continue;
  const heightScale = .68 + (candidate % 9) * .055;
  grassState.push({
    x,
    z,
    y: terrainHeightAt(x, z) + .16 * heightScale,
    yaw: angle + (candidate % 5) * .21,
    lean: (candidate % 7 - 3) * .018,
    scale: heightScale,
    phase: candidate * .73,
  });
}
function animateGrassInWind(time) {
  grassState.forEach((blade, index) => {
    const gust = Math.sin(time * 1.35 + blade.phase) * .085 + Math.sin(time * .48 + blade.phase * .17) * .055;
    grassTransform.position.set(blade.x, blade.y, blade.z);
    grassTransform.rotation.set(gust * .34, blade.yaw, blade.lean + gust);
    grassTransform.scale.set(blade.scale * .82, blade.scale, blade.scale * .82);
    grassTransform.updateMatrix();
    grassBlades.setMatrixAt(index, grassTransform.matrix);
  });
  grassBlades.instanceMatrix.needsUpdate = true;
}
grassState.forEach((blade, index) => {
  grassTransform.updateMatrix();
  grassColor.setHSL(.28 + (index % 11) * .003, .7, .31 + (index % 5) * .018);
  grassBlades.setColorAt(index, grassColor);
});
animateGrassInWind(0);
grassBlades.instanceColor.needsUpdate = true;
grassBlades.receiveShadow = true;
scene.add(grassBlades);

function yellowFlower(x, z, scale = 1, color = 0xffd65a) {
  const flower = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.018, .026, .45 * scale, 5), new THREE.MeshStandardMaterial({ color: 0x3a8b3b, roughness: 1 }));
  stem.position.y = .2 * scale; flower.add(stem);
  const petalGeometry = new THREE.SphereGeometry(.12 * scale, 10, 8);
  const petalMaterial = new THREE.MeshStandardMaterial({ color, roughness: .62 });
  for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
    const petal = new THREE.Mesh(petalGeometry, petalMaterial);
    const angle = petalIndex * Math.PI * 2 / 5;
    petal.position.set(Math.cos(angle) * .13 * scale, .45 * scale, Math.sin(angle) * .13 * scale);
    flower.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(.085 * scale, 10, 8), new THREE.MeshStandardMaterial({ color: 0xb7781f, roughness: .8 }));
  center.position.y = .45 * scale; flower.add(center);
  flower.position.set(x, terrainHeightAt(x, z), z); scene.add(flower);
}
for (let index = 0; index < 28; index += 1) {
  const angle = index * 1.71;
  const radius = 1.9 + (index % 7) * .68;
  const flowerPalette = [0xffdf45, 0xff8f52, 0xff6fae, 0xa987ff];
  yellowFlower(Math.cos(angle) * radius, Math.sin(angle) * radius, .65 + (index % 4) * .08, flowerPalette[index % flowerPalette.length]);
}

const flowerClusterCenters = [
  [-6.1, -1.05], [-4.9, 1.65], [-4.65, 4.35], [-2.75, -2.3],
  [-1.2, 4.95], [1.15, -4.85], [2.8, 2.4], [4.85, -.45], [5.55, 4.35],
];
const clusteredFlowerCount = flowerClusterCenters.length * 12;
const clusteredFlowerTransform = new THREE.Object3D();
const clusteredFlowerColor = new THREE.Color();
const clusteredStems = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(.014, .022, .34, 5),
  new THREE.MeshStandardMaterial({ color: 0x326f35, roughness: 1 }),
  clusteredFlowerCount,
);
const clusteredBlooms = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(.095, 1),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .55 }),
  clusteredFlowerCount,
);
const clusteredFlowerPalette = [0xbc79ff, 0xf58fc5, 0xf9e4ff, 0xffd45e, 0x74cfff, 0xff735e];
let clusteredFlowerIndex = 0;
flowerClusterCenters.forEach(([centerX, centerZ], clusterIndex) => {
  for (let index = 0; index < 12; index += 1) {
    const angle = index * 2.3999632297 + clusterIndex * .51;
    const radius = .12 + (index % 6) * .105;
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius * .72;
    const height = .28 + (index % 4) * .045;
    const groundY = terrainHeightAt(x, z);
    clusteredFlowerTransform.position.set(x, groundY + height / 2, z);
    clusteredFlowerTransform.rotation.set((index % 3 - 1) * .08, angle, (index % 5 - 2) * .045);
    clusteredFlowerTransform.scale.set(1, height / .34, 1);
    clusteredFlowerTransform.updateMatrix();
    clusteredStems.setMatrixAt(clusteredFlowerIndex, clusteredFlowerTransform.matrix);
    clusteredFlowerTransform.position.set(x, groundY + height + .035, z);
    clusteredFlowerTransform.rotation.set(index * .23, angle, clusterIndex * .17);
    clusteredFlowerTransform.scale.setScalar(.72 + (index % 4) * .08);
    clusteredFlowerTransform.updateMatrix();
    clusteredBlooms.setMatrixAt(clusteredFlowerIndex, clusteredFlowerTransform.matrix);
    clusteredFlowerColor.setHex(clusteredFlowerPalette[(clusterIndex + index) % clusteredFlowerPalette.length]);
    clusteredBlooms.setColorAt(clusteredFlowerIndex, clusteredFlowerColor);
    clusteredFlowerIndex += 1;
  }
});
clusteredStems.castShadow = true;
clusteredBlooms.castShadow = true;
scene.add(clusteredStems, clusteredBlooms);

const fernLeafCount = 84;
const fernLeaves = new THREE.InstancedMesh(
  new THREE.ConeGeometry(.085, .62, 5),
  new THREE.MeshStandardMaterial({ color: 0x2f7841, roughness: .95, side: THREE.DoubleSide }),
  fernLeafCount,
);
const fernTransform = new THREE.Object3D();
const fernCenters = [[-5.1, -3.2], [-2.7, -3.75], [-2.1, .1], [4.7, 1.2], [5.3, 3.15], [2.65, 5.2], [-5.75, 2.8]];
let fernIndex = 0;
fernCenters.forEach(([centerX, centerZ], clusterIndex) => {
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2;
    const radius = .09 + (index % 4) * .06;
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    fernTransform.position.set(x, terrainHeightAt(x, z) + .24, z);
    fernTransform.rotation.set(Math.PI / 2 + .34, angle + clusterIndex * .2, 0);
    fernTransform.scale.set(.7 + (index % 3) * .12, .7 + (index % 4) * .1, .72);
    fernTransform.updateMatrix();
    fernLeaves.setMatrixAt(fernIndex, fernTransform.matrix);
    fernIndex += 1;
  }
});
fernLeaves.castShadow = true;
scene.add(fernLeaves);

const windTrees = [];
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x724326, roughness: 1, flatShading: true, bumpMap: barkBumpTexture, bumpScale: .13 });
const branchMaterial = new THREE.MeshStandardMaterial({ color: 0x825033, roughness: 1, flatShading: true, bumpMap: barkBumpTexture, bumpScale: .1 });
const leafGeometry = new THREE.DodecahedronGeometry(.5, 0);
const leafMaterials = [0x9dcd4b, 0x73b443, 0x4c9139, 0xb6d95e].map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: .82, flatShading: true }),
);
const leafClusterLayout = [
  [-.92, 1.22, .02, .62], [-.64, 1.55, .12, .58], [-.34, 1.82, -.06, .62],
  [.02, 1.98, .03, .72], [.38, 1.8, -.12, .62], [.74, 1.55, .04, .59], [.98, 1.2, .08, .55],
  [-.55, 1.18, -.38, .56], [-.15, 1.45, -.44, .64], [.34, 1.42, -.4, .6], [.7, 1.16, -.34, .52],
  [-.58, 1.14, .42, .54], [-.18, 1.48, .46, .61], [.3, 1.5, .4, .59], [.66, 1.13, .36, .51],
  [0, 1.05, .02, .69],
];
function goldenTree(x, z, scale = 1, phase = 0) {
  const tree = new THREE.Group();
  addTaperedSegment(tree, new THREE.Vector3(0, 0, 0), new THREE.Vector3(.04, 1.18, 0), .29, .22, trunkMaterial, 7);
  [[-.42, 0, .15], [.4, 0, .12], [.08, 0, -.4]].forEach(([rootX, rootY, rootZ]) => {
    addTaperedSegment(tree, new THREE.Vector3(0, .18, 0), new THREE.Vector3(rootX, rootY, rootZ), .1, .035, trunkMaterial, 5);
  });

  const crownPivot = new THREE.Group();
  crownPivot.position.set(.04, 1.05, 0);
  tree.add(crownPivot);
  addTaperedSegment(crownPivot, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.18, 0), .21, .12, branchMaterial, 7);
  [
    [[0, .18, 0], [-.83, .92, .06], .15, .065],
    [[0, .28, 0], [.86, .88, .04], .15, .065],
    [[0, .52, 0], [-.48, 1.28, -.24], .13, .052],
    [[0, .58, 0], [.55, 1.27, .25], .13, .052],
    [[0, .7, 0], [.06, 1.55, -.16], .11, .04],
  ].forEach(([start, end, startRadius, endRadius]) => {
    addTaperedSegment(crownPivot, new THREE.Vector3(...start), new THREE.Vector3(...end), startRadius, endRadius, branchMaterial, 6);
  });

  const leaves = leafClusterLayout.map(([leafX, leafY, leafZ, leafScale], index) => {
    const leaf = new THREE.Mesh(leafGeometry, leafMaterials[(index + Math.round(phase)) % leafMaterials.length]);
    leaf.position.set(leafX, leafY, leafZ);
    leaf.scale.setScalar(leafScale);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    leaf.userData.basePosition = leaf.position.clone();
    leaf.userData.windPhase = phase + index * .57;
    crownPivot.add(leaf);
    return leaf;
  });
  tree.position.set(x, terrainHeightAt(x, z), z);
  tree.scale.setScalar(scale);
  tree.userData = { crownPivot, leaves, phase };
  windTrees.push(tree);
  scene.add(tree);
}

function ancientTree(x, z, scale = 1, phase = 0) {
  const tree = new THREE.Group();
  const trunkCore = new THREE.Group();
  tree.add(trunkCore);
  addTaperedSegment(trunkCore, new THREE.Vector3(0, 0, 0), new THREE.Vector3(-.12, 1.65, .03), .62, .48, trunkMaterial, 11);
  addTaperedSegment(trunkCore, new THREE.Vector3(-.12, 1.55, .03), new THREE.Vector3(.08, 3.15, -.08), .5, .32, trunkMaterial, 10);
  [
    [[-.04, 1.7, 0], [-1.55, 3.15, .18], .38, .15],
    [[.02, 1.95, -.02], [1.7, 3.35, -.18], .36, .14],
    [[-.02, 2.5, -.04], [-.8, 4.05, -.35], .31, .12],
    [[.05, 2.6, -.04], [.82, 4.15, .32], .28, .11],
    [[.02, 3.02, -.08], [.08, 4.55, -.14], .25, .09],
    [[-1.5, 3.12, .18], [-2.35, 3.65, .32], .17, .06],
    [[1.62, 3.3, -.17], [2.48, 3.75, -.25], .16, .055],
  ].forEach(([start, end, startRadius, endRadius]) => {
    addTaperedSegment(trunkCore, new THREE.Vector3(...start), new THREE.Vector3(...end), startRadius, endRadius, branchMaterial, 8);
  });
  [
    [[0, .22, 0], [-1.8, .08, .62], [-2.5, .02, .95]],
    [[.05, .25, 0], [1.45, .12, .78], [2.18, .03, 1.08]],
    [[-.12, .28, -.05], [-1.22, .12, -1.12], [-1.85, .03, -1.75]],
    [[.08, .3, -.08], [1.08, .1, -1.2], [1.55, .02, -1.75]],
  ].forEach((points, index) => addCurvedTube(tree, points, .16 - index * .012, rootMaterial, 28, 7));

  const crownPivot = new THREE.Group();
  crownPivot.position.y = 2.45;
  const leafCount = 58;
  const crownLeaves = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(.62, 2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .86, flatShading: false }),
    leafCount,
  );
  const leafTransform = new THREE.Object3D();
  const leafColor = new THREE.Color();
  for (let index = 0; index < leafCount; index += 1) {
    const angle = index * 2.3999632297;
    const ring = Math.sqrt((index + .5) / leafCount);
    const xOffset = Math.cos(angle) * ring * 3.05;
    const zOffset = Math.sin(angle) * ring * 1.75;
    const yOffset = 1.15 + Math.sin(index * 1.71) * .48 + (1 - ring) * .75;
    leafTransform.position.set(xOffset, yOffset, zOffset);
    leafTransform.rotation.set(index * .21, angle, index * .13);
    const leafScale = .72 + (index % 7) * .055;
    leafTransform.scale.set(leafScale * 1.18, leafScale, leafScale);
    leafTransform.updateMatrix();
    crownLeaves.setMatrixAt(index, leafTransform.matrix);
    leafColor.setHSL(.25 + (index % 8) * .008, .62, .31 + (index % 6) * .035);
    crownLeaves.setColorAt(index, leafColor);
  }
  crownLeaves.castShadow = true;
  crownLeaves.receiveShadow = true;
  crownPivot.add(crownLeaves);
  tree.add(crownPivot);
  tree.position.set(x, terrainHeightAt(x, z), z);
  tree.scale.setScalar(scale);
  tree.userData = { crownPivot, leaves: [], phase };
  windTrees.push(tree);
  scene.add(tree);
}

function blossomTree(x, z, scale = 1, phase = 0) {
  const tree = new THREE.Group();
  const crownPivot = new THREE.Group();
  addTaperedSegment(tree, new THREE.Vector3(0, 0, 0), new THREE.Vector3(.08, 1.75, 0), .32, .2, trunkMaterial, 8);
  [
    [[.05, 1.05, 0], [-1.15, 2.3, .12], .19, .055],
    [[.08, 1.25, 0], [1.25, 2.55, -.1], .18, .05],
    [[.06, 1.55, 0], [-.48, 3.15, -.2], .16, .045],
    [[.08, 1.6, 0], [.58, 3.2, .18], .15, .04],
  ].forEach(([start, end, startRadius, endRadius]) => {
    addTaperedSegment(tree, new THREE.Vector3(...start), new THREE.Vector3(...end), startRadius, endRadius, branchMaterial, 7);
  });
  crownPivot.position.y = 1.45;
  const blossomCount = 36;
  const blossoms = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(.34, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .72 }),
    blossomCount,
  );
  const blossomTransform = new THREE.Object3D();
  const blossomColor = new THREE.Color();
  for (let index = 0; index < blossomCount; index += 1) {
    const angle = index * 2.3999632297;
    const radius = Math.sqrt((index + .5) / blossomCount);
    blossomTransform.position.set(
      Math.cos(angle) * radius * 1.85 + Math.sin(index * .6) * .18,
      1.2 + Math.sin(index * 1.37) * .52 + (1 - radius) * .42,
      Math.sin(angle) * radius * 1.05,
    );
    blossomTransform.rotation.set(index * .33, angle, index * .19);
    blossomTransform.scale.setScalar(.78 + (index % 5) * .08);
    blossomTransform.updateMatrix();
    blossoms.setMatrixAt(index, blossomTransform.matrix);
    blossomColor.setHSL(.92 + (index % 4) * .012, .62, .72 + (index % 5) * .035);
    blossoms.setColorAt(index, blossomColor);
  }
  blossoms.castShadow = true;
  crownPivot.add(blossoms);
  tree.add(crownPivot);
  tree.position.set(x, terrainHeightAt(x, z), z);
  tree.scale.setScalar(scale);
  tree.userData = { crownPivot, leaves: [], phase };
  windTrees.push(tree);
  scene.add(tree);
}

ancientTree(-5.75, -1.75, 1.08, .4);
blossomTree(4.85, -2.15, 1.12, 1.7);
goldenTree(-5.8, 3.85, .7, 2.8);
goldenTree(5.75, 4.05, .66, 4.1);
goldenTree(.4, -5.75, .56, 3.4);

function animateTreesInWind(time) {
  windTrees.forEach((tree) => {
    const gust = Math.sin(time * .82 + tree.userData.phase) * .045 + Math.sin(time * .31 + tree.userData.phase) * .018;
    tree.userData.crownPivot.rotation.z = -.025 + gust;
    tree.userData.crownPivot.rotation.x = gust * .32;
    tree.userData.leaves.forEach((leaf) => {
      const flutter = Math.sin(time * 1.5 + leaf.userData.windPhase);
      leaf.rotation.z = flutter * .055;
      leaf.rotation.x = flutter * .025;
      leaf.position.x = leaf.userData.basePosition.x + flutter * .018;
      leaf.position.y = leaf.userData.basePosition.y + Math.sin(time * 1.1 + leaf.userData.windPhase) * .012;
    });
  });
}

const windLeaves = [];
const driftingLeafGeometry = new THREE.OctahedronGeometry(.07, 0);
for (let index = 0; index < 18; index += 1) {
  const leaf = new THREE.Mesh(driftingLeafGeometry, leafMaterials[index % leafMaterials.length]);
  leaf.scale.set(1.45, .42, .8);
  leaf.position.set(-8 + (index * 1.37) % 15.5, 1.25 + (index % 6) * .42, -4.6 + (index % 7) * 1.22);
  leaf.userData = {
    baseY: leaf.position.y,
    phase: index * .91,
    speed: .18 + (index % 5) * .035,
  };
  windLeaves.push(leaf);
  scene.add(leaf);
}
function animateWindLeaves(time, deltaSeconds) {
  windLeaves.forEach((leaf) => {
    leaf.position.x += leaf.userData.speed * deltaSeconds;
    if (leaf.position.x > 8.4) leaf.position.x = -8.4;
    leaf.position.y = leaf.userData.baseY + Math.sin(time * 1.25 + leaf.userData.phase) * .22;
    leaf.rotation.x += deltaSeconds * .75;
    leaf.rotation.y += deltaSeconds * 1.15;
    leaf.rotation.z = Math.sin(time * 1.6 + leaf.userData.phase) * .8;
  });
}

function meadowRock(x, z, scale = 1) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(.42 * scale, 0),
    new THREE.MeshStandardMaterial({ color: 0x899882, roughness: 1, flatShading: true })
  );
  rock.scale.y = .62; rock.position.set(x, terrainHeightAt(x, z) + .19 * scale, z);
  rock.rotation.set(.12, x * .4, -.08); rock.castShadow = true; rock.receiveShadow = true; scene.add(rock);
}
meadowRock(-2.35, -2.1, 1.05); meadowRock(-5.1, .2, .82); meadowRock(4.7, 1.7, .9); meadowRock(3.8, -4.4, .7);

function springShrub(x, z, scale = 1) {
  const shrub = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x4b9f43, roughness: .9, flatShading: true });
  [[0, .36, 0, .48], [.38, .28, .06, .35], [-.34, .27, .08, .34]].forEach(([leafX, leafY, leafZ, leafScale]) => {
    const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(leafScale * scale, 0), material);
    leaf.position.set(leafX * scale, leafY * scale, leafZ * scale); leaf.castShadow = true; shrub.add(leaf);
  });
  shrub.position.set(x, terrainHeightAt(x, z), z); scene.add(shrub);
}
springShrub(-2.3, 4.7, 1.1); springShrub(4.8, 4.6, .92); springShrub(5.6, -.9, .82); springShrub(-6.3, 1.7, .9);

const springSun = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe2a3 }));
springSun.position.set(9.5, 8.4, -13.5); springSun.scale.setScalar(.72); scene.add(springSun);
const sunGlow = new THREE.PointLight(0xffd269, 5, 18); sunGlow.position.copy(springSun.position); scene.add(sunGlow);
const clouds = [];
function springCloud(x, y, z, scale = 1) {
  const cloud = new THREE.Group();
  const cloudMaterials = [0xffffff, 0xe6f4ff, 0xf7fbff].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, transparent: true, opacity: .9, depthWrite: false }),
  );
  const puffGeometry = new THREE.DodecahedronGeometry(1, 1);
  [
    [0, 0, 0, .68, 1.05], [.62, .02, .04, .5, 1], [-.62, -.02, .08, .48, 1],
    [.2, .34, -.03, .51, .92], [-.2, .29, .03, .47, .96], [1.02, -.06, .1, .35, 1],
    [-1, -.08, .12, .34, 1], [.47, .27, .02, .38, .94],
  ].forEach(([px, py, pz, size, width], puffIndex) => {
    const puff = new THREE.Mesh(puffGeometry, cloudMaterials[puffIndex % cloudMaterials.length]);
    puff.position.set(px * scale, py * scale, pz * scale);
    puff.scale.set(size * scale * width, size * scale * .78, size * scale);
    cloud.add(puff);
  });
  cloud.position.set(x, y, z);
  cloud.userData.baseY = y;
  cloud.userData.driftSpeed = .065 + clouds.length * .018;
  cloud.userData.phase = clouds.length * 1.4;
  scene.add(cloud);
  clouds.push(cloud);
}
springCloud(-10.5, 7.5, -12, 1.85);
springCloud(2.6, 9.2, -15, 1.55);
springCloud(10.8, 6.8, -10, 1.35);
springCloud(-3.2, 5.9, -18, .88);
springCloud(7.6, 10.7, -20, .76);
springCloud(-9.8, -8.2, -4.5, 3.1);
springCloud(-2.4, -8.8, -7.5, 3.7);
springCloud(7.2, -8.1, -4.2, 3.05);
springCloud(13.5, -6.4, -13, 2.25);
springCloud(-15.2, -6.2, -15, 2.45);

function createCloudRing({ count, minimumRadius, radiusSpread, baseY, heightSpread, scaleBase, scaleSpread, opacity }) {
  const geometry = new THREE.DodecahedronGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xc9e3f2,
    emissiveIntensity: .12,
    roughness: 1,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: true,
  });
  const ring = new THREE.InstancedMesh(geometry, material, count);
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const clusterCount = Math.ceil(count / 3);
  for (let index = 0; index < count; index += 1) {
    const cluster = Math.floor(index / 3);
    const puff = index % 3;
    const angle = cluster / clusterCount * Math.PI * 2 + Math.sin(cluster * 2.17) * .06 + (puff - 1) * .035;
    const radius = minimumRadius + ((cluster * 7) % 13) / 12 * radiusSpread + (puff - 1) * .42;
    const scale = (scaleBase + (cluster % 9) / 8 * scaleSpread) * (puff === 0 ? 1.08 : .78);
    transform.position.set(
      Math.cos(angle) * radius,
      baseY + Math.sin(cluster * 1.71) * heightSpread + (puff === 1 ? scale * .25 : puff === 2 ? -scale * .12 : 0),
      Math.sin(angle) * radius,
    );
    transform.rotation.set(index * .17, angle, index * .11);
    transform.scale.set(
      scale * (1.15 + (index % 4) * .08),
      scale * (.48 + (index % 3) * .06),
      scale * (.8 + (index % 5) * .07),
    );
    transform.updateMatrix();
    ring.setMatrixAt(index, transform.matrix);
    color.setHSL(.56 + (index % 4) * .006, .22, .86 + (index % 5) * .018);
    ring.setColorAt(index, color);
  }
  ring.instanceMatrix.needsUpdate = true;
  if (ring.instanceColor) ring.instanceColor.needsUpdate = true;
  scene.add(ring);
  return ring;
}

const lowerCloudSea = createCloudRing({
  count: 76,
  minimumRadius: 14,
  radiusSpread: 11,
  baseY: -7.1,
  heightSpread: 1.45,
  scaleBase: .95,
  scaleSpread: 1.15,
  opacity: .84,
});
const horizonCloudRing = createCloudRing({
  count: 52,
  minimumRadius: 21,
  radiusSpread: 10,
  baseY: 3.4,
  heightSpread: 3.5,
  scaleBase: .64,
  scaleSpread: .9,
  opacity: .68,
});
const immersiveCloudRings = [lowerCloudSea, horizonCloudRing];

const backgroundIslandsGroup = new THREE.Group();
scene.add(backgroundIslandsGroup);
const distantRockMaterial = new THREE.MeshStandardMaterial({ color: 0x657876, roughness: 1, flatShading: true });
const distantGrassMaterial = new THREE.MeshStandardMaterial({ color: 0x618b57, roughness: 1 });
function distantIsland(x, y, z, scale, phase = 0) {
  const island = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.8, 8), distantRockMaterial);
  rock.rotation.z = Math.PI;
  rock.position.y = -1.28;
  island.add(rock);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.05, .18, 14), distantGrassMaterial);
  top.position.y = .04;
  island.add(top);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, .72, 6), trunkMaterial);
  trunk.position.set(.15, .48, 0);
  island.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 1), leafMaterials[Math.round(phase) % leafMaterials.length]);
  crown.position.set(.15, .92, 0);
  island.add(crown);
  island.position.set(x, y, z);
  island.scale.setScalar(scale);
  island.userData = { baseY: y, phase };
  backgroundIslandsGroup.add(island);
  return island;
}
const backgroundIslands = [
  distantIsland(-15.5, 2.2, -29, 1.65, .4),
  distantIsland(15.8, 3.8, -33, 2.05, 1.6),
  distantIsland(7.4, 7.2, -40, .9, 2.7),
  distantIsland(-8.5, 6.1, -37, .72, 3.4),
];

const birds = [];
const birdMaterial = new THREE.LineBasicMaterial({ color: 0x263f52, transparent: true, opacity: .72 });
for (let index = 0; index < 7; index += 1) {
  const birdGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-.18, 0, 0), new THREE.Vector3(0, .08, 0),
    new THREE.Vector3(0, .08, 0), new THREE.Vector3(.18, 0, 0),
  ]);
  const bird = new THREE.LineSegments(birdGeometry, birdMaterial);
  bird.position.set(-7 + index * 2.1, 6.8 + (index % 3) * .62, -18 - (index % 4) * 2.4);
  bird.scale.setScalar(.8 + (index % 3) * .18);
  bird.userData = { phase: index * .83, baseY: bird.position.y, speed: .12 + (index % 4) * .025 };
  scene.add(bird);
  birds.push(bird);
}

const airParticlePositions = [];
for (let index = 0; index < 120; index += 1) {
  const angle = index * 2.3999632297;
  const radius = 2 + (index % 19) * .42;
  airParticlePositions.push(
    Math.cos(angle) * radius,
    .5 + (index % 17) * .31,
    Math.sin(angle) * radius * .78,
  );
}
const airParticleGeometry = new THREE.BufferGeometry();
airParticleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(airParticlePositions, 3));
const airParticles = new THREE.Points(
  airParticleGeometry,
  new THREE.PointsMaterial({ color: 0xfff1a7, size: .035, transparent: true, opacity: .62, depthWrite: false, blending: THREE.AdditiveBlending }),
);
scene.add(airParticles);

const donationRoot = new THREE.Group();
donationRoot.visible = false;
scene.add(donationRoot);
const donationCrystal = new THREE.Mesh(
  new THREE.OctahedronGeometry(.52, 1),
  new THREE.MeshStandardMaterial({ color: 0xffc84f, emissive: 0xff8a1f, emissiveIntensity: 1.25, roughness: .28, metalness: .18, flatShading: true }),
);
donationCrystal.position.y = 1.35;
donationCrystal.castShadow = true;
donationRoot.add(donationCrystal);
const donationBeamMaterial = new THREE.MeshBasicMaterial({
  color: 0xffe88a,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const donationBeam = new THREE.Mesh(new THREE.CylinderGeometry(.72, 1.2, 4.2, 20, 1, true), donationBeamMaterial);
donationBeam.position.y = 2.1;
donationRoot.add(donationBeam);
const donationWaveMaterial = new THREE.MeshBasicMaterial({
  color: 0xffd75f,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const donationWave = new THREE.Mesh(new THREE.RingGeometry(.62, .78, 48), donationWaveMaterial);
donationWave.rotation.x = -Math.PI / 2;
donationWave.position.y = .055;
donationRoot.add(donationWave);
const donationHalo = new THREE.Mesh(
  new THREE.TorusGeometry(.82, .055, 8, 36),
  new THREE.MeshBasicMaterial({ color: 0xfff0a1, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
);
donationHalo.rotation.x = Math.PI / 2;
donationHalo.position.y = 1.35;
donationRoot.add(donationHalo);
const donationLight = new THREE.PointLight(0xffb52d, 0, 10, 2);
donationLight.position.y = 1.5;
donationRoot.add(donationLight);

const donationParticleGeometry = new THREE.TetrahedronGeometry(.075, 0);
const donationParticleMaterials = [0xffdc63, 0xff9f37, 0xfff2a8].map(
  (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .42, roughness: .45, flatShading: true }),
);
const donationParticles = Array.from({ length: 28 }, (_, index) => {
  const particle = new THREE.Mesh(donationParticleGeometry, donationParticleMaterials[index % donationParticleMaterials.length]);
  particle.userData = {
    angle: index * 2.3999632297,
    phase: (index % 7) / 7,
    speed: .62 + (index % 5) * .08,
  };
  donationRoot.add(particle);
  return particle;
});

const donationBannerCanvas = document.createElement('canvas');
donationBannerCanvas.width = 1024;
donationBannerCanvas.height = 300;
const donationBannerContext = donationBannerCanvas.getContext('2d');
const donationBannerTexture = new THREE.CanvasTexture(donationBannerCanvas);
donationBannerTexture.colorSpace = THREE.SRGBColorSpace;
const donationBannerMaterial = new THREE.SpriteMaterial({ map: donationBannerTexture, transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
const donationBanner = new THREE.Sprite(donationBannerMaterial);
donationBanner.position.set(0, 4.15, 0);
donationBanner.scale.set(5.8, 1.7, 1);
donationRoot.add(donationBanner);

function drawDonationBanner(donation) {
  const context = donationBannerContext;
  context.clearRect(0, 0, donationBannerCanvas.width, donationBannerCanvas.height);
  const gradient = context.createLinearGradient(0, 0, donationBannerCanvas.width, donationBannerCanvas.height);
  gradient.addColorStop(0, 'rgba(69, 45, 7, .96)');
  gradient.addColorStop(1, 'rgba(25, 83, 45, .96)');
  context.fillStyle = gradient;
  context.roundRect(18, 18, 988, 264, 72);
  context.fill();
  context.strokeStyle = '#ffe48a';
  context.lineWidth = 8;
  context.stroke();
  context.fillStyle = '#ffe790';
  context.font = '700 34px DM Mono, monospace';
  context.textAlign = 'center';
  context.fillText('NOVA DOAÇÃO', 512, 72);
  const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: donation.currency || 'BRL' }).format(Number(donation.amount));
  context.fillStyle = '#ffffff';
  context.font = '700 58px Outfit, Arial';
  context.fillText(`${donation.donor_name}  •  ${formattedAmount}`, 512, 150, 900);
  if (donation.message) {
    context.fillStyle = '#dff6c4';
    context.font = '500 31px Outfit, Arial';
    context.fillText(donation.message, 512, 217, 860);
  }
  donationBannerTexture.needsUpdate = true;
}

const donationQueue = [];
let activeDonation = null;
const donationAlertDuration = 7000;
function triggerDonationAlert(donation) {
  donationQueue.push(donation);
}
function animateDonationAlert(now, time, deltaSeconds) {
  if (!activeDonation && donationQueue.length) {
    activeDonation = { data: donationQueue.shift(), startedAt: now };
    drawDonationBanner(activeDonation.data);
    donationRoot.visible = true;
  }
  if (!activeDonation) return;
  const elapsed = now - activeDonation.startedAt;
  const progress = Math.min(1, elapsed / donationAlertDuration);
  const entrance = Math.min(1, elapsed / 520);
  const exit = elapsed > 6100 ? Math.max(0, (donationAlertDuration - elapsed) / 900) : 1;
  const visibility = entrance * exit;
  const pulse = .88 + Math.sin(time * 5.2) * .12;
  donationCrystal.rotation.y += deltaSeconds * 2.25;
  donationCrystal.rotation.z = Math.sin(time * 1.7) * .18;
  donationCrystal.position.y = 1.35 + Math.sin(time * 2.7) * .11;
  donationCrystal.scale.setScalar((.18 + entrance * .82) * pulse);
  donationBeamMaterial.opacity = visibility * (.09 + Math.sin(time * 3.8) * .025);
  donationHalo.material.opacity = visibility * .76;
  donationHalo.rotation.z += deltaSeconds * 1.7;
  donationHalo.scale.setScalar(.85 + Math.sin(time * 3.1) * .08);
  donationWave.scale.setScalar(.75 + progress * 4.2);
  donationWaveMaterial.opacity = visibility * (1 - progress) * .78;
  donationLight.intensity = visibility * (7.5 + Math.sin(time * 4.5) * 1.5);
  donationBannerMaterial.opacity = visibility;
  donationBanner.position.y = 3.95 + entrance * .2 + Math.sin(time * 1.8) * .025;
  donationParticles.forEach((particle, index) => {
    const rise = (progress * particle.userData.speed + particle.userData.phase) % 1;
    const radius = .32 + rise * (1.25 + (index % 4) * .18);
    const angle = particle.userData.angle + time * .38;
    particle.position.set(Math.cos(angle) * radius, .35 + rise * 2.65, Math.sin(angle) * radius);
    particle.scale.setScalar(visibility * Math.sin(Math.PI * rise) * (1 + (index % 3) * .16));
    particle.rotation.x += deltaSeconds * (1.1 + index % 3);
    particle.rotation.y += deltaSeconds * (1.4 + index % 4);
  });
  if (elapsed >= donationAlertDuration) {
    donationRoot.visible = false;
    activeDonation = null;
  }
}

const avatarRoot = new THREE.Group(); scene.add(avatarRoot);
const avatars = new Map();
let socialAvatarIds = [];
const characterFiles = Array.from({ length: 18 }, (_, index) => `character-${String.fromCharCode(97 + index)}.glb`);
const characterTemplates = new Map();
const characterLoads = new Map();
const characterLoader = new GLTFLoader();

function makeLabel(name, role) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 112;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(19, 67, 35, .88)';
  context.roundRect(5, 5, 502, 102, 50); context.fill();
  context.strokeStyle = role === 'criador' ? '#ffe080' : '#b9e987'; context.lineWidth = 3; context.stroke();
  context.fillStyle = '#f3f9ff'; context.font = '600 42px Outfit, Arial'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(name, 256, 57, 455);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material); sprite.scale.set(2.4, .53, 1); sprite.position.y = 2.75;
  return sprite;
}

function fallbackBody() {
  const group = new THREE.Group();
  group.userData.ownsAvatarResources = true;
  const color = new THREE.Color().setHSL(Math.random() * .18 + .44, .65, .56);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.39, .8, 5, 12), new THREE.MeshStandardMaterial({ color, roughness: .58 }));
  body.position.y = .8; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 20, 16), new THREE.MeshStandardMaterial({ color: 0xf1bd92, roughness: .8 }));
  head.position.y = 1.62; head.castShadow = true; group.add(head);
  return group;
}

function fitAvatarBody(body) {
  const box = new THREE.Box3().setFromObject(body); const size = new THREE.Vector3(); box.getSize(size);
  const scale = 1.95 / Math.max(size.y, .1); body.scale.setScalar(scale);
  const adjustedBox = new THREE.Box3().setFromObject(body); body.position.y = -adjustedBox.min.y;
  return body;
}

function setAvatarAnimation(group, name) {
  if (!group.userData.mixer || group.userData.activeAnimation === name) return;
  const clip = group.userData.animationClips.get(name) || group.userData.animationClips.get('idle');
  if (!clip) return;
  const nextAction = group.userData.mixer.clipAction(clip);
  nextAction.enabled = true;
  nextAction.reset();
  nextAction.setEffectiveTimeScale(name === 'walk' ? 1.12 : .92);
  nextAction.setEffectiveWeight(1);
  nextAction.fadeIn(.2).play();
  if (group.userData.activeAction && group.userData.activeAction !== nextAction) group.userData.activeAction.fadeOut(.2);
  group.userData.activeAction = nextAction;
  group.userData.activeAnimation = name;
}

function replaceAvatarBody(group, body, animations = []) {
  if (group.userData.mixer) {
    group.userData.mixer.stopAllAction();
    if (group.userData.body) group.userData.mixer.uncacheRoot(group.userData.body);
  }
  if (group.userData.body) {
    group.remove(group.userData.body);
    disposeOwnedRenderObject(group.userData.body);
  }
  group.userData.body = fitAvatarBody(body); group.add(group.userData.body);
  group.userData.animationClips = new Map(animations.map((clip) => [clip.name, clip]));
  group.userData.mixer = animations.length ? new THREE.AnimationMixer(group.userData.body) : null;
  group.userData.activeAction = null;
  group.userData.activeAnimation = null;
  setAvatarAnimation(group, 'idle');
}

function loadCharacterTemplate(file) {
  if (characterTemplates.has(file)) return Promise.resolve(characterTemplates.get(file));
  if (!characterLoads.has(file)) {
    characterLoads.set(file, characterLoader.loadAsync(`/assets/characters/${file}`).then((gltf) => {
      gltf.scene.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
      const template = { scene: gltf.scene, animations: gltf.animations };
      characterTemplates.set(file, template);
      return template;
    }).catch(() => null));
  }
  return characterLoads.get(file);
}

function createAvatar(person) {
  const group = new THREE.Group();
  const characterFile = characterFiles[avatars.size % characterFiles.length];
  group.userData = {
    id: person.id,
    bob: Math.random() * Math.PI * 2,
    target: new THREE.Vector3(),
    layoutTarget: new THREE.Vector3(),
    body: null,
    mixer: null,
    animationClips: new Map(),
    activeAction: null,
    activeAnimation: null,
    socialPhase: 'rest',
    socialIndex: 0,
    socialPartner: null,
    layoutScale: 1,
    entryMode: entryAnimationMode,
    exitMode: null,
    motionBaseRotation: 0,
    phase: entryAnimationMode === 'current' ? 'active' : 'queued',
    phaseStartedAt: 0,
  };
  replaceAvatarBody(group, fallbackBody()); group.add(makeLabel(person.display_name, person.role));
  const interactionSpark = new THREE.Mesh(
    new THREE.IcosahedronGeometry(.12, 0),
    new THREE.MeshBasicMaterial({ color: 0xff69b4, transparent: true, opacity: .95 }),
  );
  interactionSpark.userData.ownsAvatarResources = true;
  interactionSpark.position.set(.48, 2.15, 0); interactionSpark.visible = false; group.add(interactionSpark);
  group.userData.interactionSpark = interactionSpark;
  avatarRoot.add(group); avatars.set(person.id, group);
  if (entryAnimationMode !== 'current') {
    group.visible = false;
    arrivalQueue.enqueue(person.id);
  }
  loadCharacterTemplate(characterFile).then((template) => {
    if (template && avatars.get(person.id) === group) replaceAvatarBody(group, cloneSkinned(template.scene), template.animations);
  });
}

function removeAvatar(id, avatar) {
  arrivalQueue.remove(id);
  if (avatar.userData.mixer) {
    avatar.userData.mixer.stopAllAction();
    if (avatar.userData.body) avatar.userData.mixer.uncacheRoot(avatar.userData.body);
  }
  avatarRoot.remove(avatar);
  avatars.delete(id);
  const label = avatar.children.find((child) => child.isSprite);
  if (label) { label.material.map?.dispose(); label.material.dispose(); }
  disposeOwnedRenderObject(avatar.userData.body);
  disposeOwnedRenderObject(avatar.userData.interactionSpark);
}

function beginExit(id, avatar, now) {
  arrivalQueue.remove(id);
  if (exitAnimationMode === 'current' || !avatar.visible) {
    removeAvatar(id, avatar);
    return;
  }
  if (avatar.userData.phase !== 'exiting') {
    avatar.userData.phase = 'exiting';
    avatar.userData.exitMode = exitAnimationMode;
    avatar.userData.phaseStartedAt = now;
    avatar.userData.motionBaseRotation = avatar.rotation.y;
    if (exitAnimationMode === 'walk') {
      const direction = avatar.position.x >= 0 ? 1 : -1;
      const exitX = direction * 9.4; const exitZ = 5.8;
      avatar.userData.target.set(exitX, terrainHeightAt(exitX, exitZ), exitZ);
    } else {
      avatar.userData.target.copy(avatar.position);
    }
  }
}

function updateRanking(people) {
  inactiveProfileImageIds(rankingImages.keys(), people).forEach((id) => rankingImages.delete(id));
  elements.rankingList.replaceChildren();
  elements.rankingTotal.textContent = `${people.length} autor${people.length === 1 ? '' : 'es'}`;
  currentRankingPeople = topChatRanking(people);
  currentRankingPeople.forEach((person, index) => {
    const item = document.createElement('li'); item.className = 'ranking-item';
    const place = document.createElement('span'); place.className = 'ranking-place'; place.textContent = `${index + 1}`;
    const name = document.createElement('span'); name.className = 'ranking-name'; name.textContent = person.display_name;
    const score = document.createElement('span'); score.className = 'ranking-score'; score.textContent = `${person.messages} msg`;
    item.append(place, name, score); elements.rankingList.append(item);
    loadRankingImage(person);
  });
  drawRankingCanvas();
}

function loadRankingImage(person) {
  if (!person.profile_image_available || rankingImages.has(person.id)) return;
  rankingImages.set(person.id, null);
  const image = new Image();
  image.decoding = 'async';
  image.addEventListener('load', () => {
    if (!rankingImages.has(person.id)) return;
    rankingImages.set(person.id, image); drawRankingCanvas();
  }, { once: true });
  image.addEventListener('error', () => {
    if (rankingImages.has(person.id)) rankingImages.set(person.id, false);
  }, { once: true });
  image.src = `/api/profile-image/${encodeURIComponent(person.id)}`;
}

function drawRankingAvatar(person, x, y, radius) {
  rankingContext.save();
  rankingContext.beginPath(); rankingContext.arc(x, y, radius, 0, Math.PI * 2); rankingContext.clip();
  const image = rankingImages.get(person.id);
  if (image) rankingContext.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  else {
    rankingContext.fillStyle = '#f4ce5c'; rankingContext.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    rankingContext.fillStyle = '#294f30'; rankingContext.font = '700 28px Outfit, Arial'; rankingContext.textAlign = 'center'; rankingContext.textBaseline = 'middle';
    rankingContext.fillText(person.display_name.trim().charAt(0).toUpperCase() || '?', x, y + 1);
  }
  rankingContext.restore();
  rankingContext.strokeStyle = '#e8f6b7'; rankingContext.lineWidth = 3; rankingContext.beginPath(); rankingContext.arc(x, y, radius, 0, Math.PI * 2); rankingContext.stroke();
}

function drawRankingCanvas() {
  rankingContext.clearRect(0, 0, rankingCanvas.width, rankingCanvas.height);
  rankingContext.fillStyle = 'rgba(17, 62, 39, .91)';
  rankingContext.beginPath(); rankingContext.roundRect(8, 8, 752, 414, 34); rankingContext.fill();
  rankingContext.strokeStyle = '#d7eca4'; rankingContext.lineWidth = 4; rankingContext.stroke();
  rankingContext.fillStyle = '#e8f6b7'; rankingContext.font = '700 28px DM Mono, monospace'; rankingContext.textAlign = 'left'; rankingContext.textBaseline = 'middle';
  rankingContext.fillText('RANKING DO CHAT', 42, 51);
  rankingContext.font = '500 22px DM Mono, monospace'; rankingContext.fillStyle = '#fff3a0'; rankingContext.textAlign = 'right';
  rankingContext.fillText(`${currentRankingPeople.length ? elements.rankingTotal.textContent : '0 autores'}`, 722, 51);
  currentRankingPeople.forEach((person, index) => {
    const y = 105 + index * 61;
    rankingContext.fillStyle = index === 0 ? 'rgba(255, 232, 121, .16)' : 'rgba(255,255,255,.055)';
    rankingContext.beginPath(); rankingContext.roundRect(28, y - 26, 712, 53, 20); rankingContext.fill();
    rankingContext.fillStyle = '#f4ce5c'; rankingContext.font = '700 22px DM Mono, monospace'; rankingContext.textAlign = 'center'; rankingContext.fillText(`${index + 1}`, 57, y);
    drawRankingAvatar(person, 107, y, 22);
    rankingContext.fillStyle = '#f7fff0'; rankingContext.font = '600 25px Outfit, Arial'; rankingContext.textAlign = 'left';
    rankingContext.fillText(person.display_name, 145, y, 455);
    rankingContext.fillStyle = '#c9e9b7'; rankingContext.font = '500 20px DM Mono, monospace'; rankingContext.textAlign = 'right';
    rankingContext.fillText(`${person.messages} msg`, 710, y);
  });
  rankingTexture.needsUpdate = true;
}

function updateParticipants(people) {
  updateRanking(people);
  const visiblePeople = latestVisualParticipants(people);
  const wanted = new Set(visiblePeople.map((person) => person.id));
  const now = performance.now();
  for (const [id, avatar] of avatars) if (!wanted.has(id)) beginExit(id, avatar, now);
  visiblePeople.forEach((person, index) => {
    if (!avatars.has(person.id)) createAvatar(person);
    const avatar = avatars.get(person.id); const layout = avatarLayoutFor(index, visiblePeople.length);
    avatar.userData.socialIndex = index;
    avatar.userData.layoutTarget.set(layout.x, terrainHeightAt(layout.x, layout.z), layout.z);
    avatar.userData.layoutScale = layout.scale;
    if (avatar.userData.phase !== 'entering' && avatar.userData.phase !== 'exiting') avatar.scale.setScalar(layout.scale);
    if (avatar.userData.phase === 'exiting') {
      avatar.userData.phase = 'active';
      avatar.userData.exitMode = null;
      avatar.rotation.y = avatar.userData.motionBaseRotation;
      avatar.scale.setScalar(layout.scale);
    }
    if (avatar.userData.phase === 'active') avatar.userData.target.copy(avatar.userData.layoutTarget);
    const label = avatar.children.find((child) => child.isSprite);
    if (label && label.userData.name !== `${person.display_name}:${person.role}`) {
      avatar.remove(label); label.material.map.dispose(); label.material.dispose();
      const next = makeLabel(person.display_name, person.role); next.userData.name = `${person.display_name}:${person.role}`; avatar.add(next);
    }
  });
  socialAvatarIds = visiblePeople.map((person) => person.id);
  elements.count.textContent = `${people.length} participante${people.length === 1 ? '' : 's'}`;
}

function updateSocialTargets(now) {
  const elapsed = now - sceneStartedAt;
  socialAvatarIds.forEach((id, index) => {
    const avatar = avatars.get(id);
    if (!avatar || avatar.userData.phase !== 'active') return;
    const partnerIndex = socialPartnerIndex(index, socialAvatarIds.length);
    const partner = partnerIndex === null ? null : avatars.get(socialAvatarIds[partnerIndex]);
    const partnerReady = Boolean(partner?.visible && partner.userData.phase === 'active');
    const socialPhase = socialInteractionPhase(elapsed, partnerReady, Math.floor(index / 2));
    avatar.userData.socialPhase = socialPhase;
    avatar.userData.socialPartner = partnerReady ? partner : null;
    if (partnerReady && (socialPhase === 'approach' || socialPhase === 'interact')) {
      const meeting = socialMeetingTarget(avatar.userData.layoutTarget, partner.userData.layoutTarget);
      avatar.userData.target.set(meeting.x, terrainHeightAt(meeting.x, meeting.z), meeting.z);
    } else if (socialPhase === 'explore') {
      const exploration = explorationTarget(index, socialCycleIndex(elapsed, index));
      avatar.userData.target.set(exploration.x, terrainHeightAt(exploration.x, exploration.z), exploration.z);
    } else {
      avatar.userData.target.copy(avatar.userData.layoutTarget);
    }
  });
}

function updateArrivalAnimation(now) {
  const nextId = arrivalQueue.startNext();
  if (nextId) {
    const avatar = avatars.get(nextId);
    if (!avatar) { arrivalQueue.complete(nextId); return; }
    avatar.visible = true;
    avatar.userData.phase = 'entering';
    avatar.userData.phaseStartedAt = now;
    avatar.userData.motionBaseRotation = avatar.rotation.y;
    if (avatar.userData.entryMode === 'spotlight') {
      avatar.position.set(0, terrainHeightAt(0, 7.2), 7.2);
      avatar.userData.target.set(0, terrainHeightAt(0, 3.8), 3.8);
    } else {
      avatar.position.set(0, terrainHeightAt(0, 3.8), 3.8);
      avatar.userData.target.copy(avatar.position);
    }
  }
  const activeId = arrivalQueue.active;
  const activeAvatar = activeId ? avatars.get(activeId) : null;
  const entryDuration = activeAvatar?.userData.entryMode === 'drop' ? 1_600
    : activeAvatar?.userData.entryMode === 'portal' ? 1_500 : 1_250;
  if (activeAvatar && now - activeAvatar.userData.phaseStartedAt >= entryDuration) {
    activeAvatar.userData.phase = 'active';
    activeAvatar.userData.target.copy(activeAvatar.userData.layoutTarget);
    activeAvatar.scale.setScalar(activeAvatar.userData.layoutScale);
    activeAvatar.rotation.y = activeAvatar.userData.motionBaseRotation;
    arrivalQueue.complete(activeId);
  }
}

let previewWidth = 1;
let previewHeight = 1;

function configureHud(targetCamera, width, height) {
  targetCamera.left = 0;
  targetCamera.right = width;
  targetCamera.top = height;
  targetCamera.bottom = 0;
  targetCamera.updateProjectionMatrix();
}

function positionRanking(width, height) {
  const layout = rankingOverlayLayout(width, height);
  rankingSprite.scale.set(layout.width, layout.height, 1);
  rankingSprite.position.set(layout.x, layout.y, 0);
}

function positionMercadoPagoQr(width, height) {
  const layout = pixOverlayLayout(width, height);
  pixDonationSprite.scale.set(layout.width, layout.height, 1);
  pixDonationSprite.position.set(layout.x, layout.y, 0);
}

function renderWorld(targetRenderer, targetCamera, targetHudCamera, width, height) {
  positionRanking(width, height);
  positionMercadoPagoQr(width, height);
  targetRenderer.clear();
  targetRenderer.render(scene, targetCamera);
  targetRenderer.clearDepth();
  targetRenderer.render(hudScene, targetHudCamera);
}

function resize() {
  previewWidth = Math.max(1, Math.round(elements.scene.clientWidth));
  previewHeight = Math.max(1, Math.round(elements.scene.clientHeight));
  if (captureWidth && captureHeight) return;
  const output = outputDimensions();
  const preset = outputCameraPreset();
  camera.aspect = previewWidth / previewHeight;
  camera.fov = previewFovForAspect(preset.fov, output.width / output.height, camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(previewWidth, previewHeight, false);
  configureHud(hudCamera, previewWidth, previewHeight);
}
new ResizeObserver(resize).observe(elements.scene); resize();

function enterCaptureView() {
  if (!previewCameraState) {
    previewCameraState = {
      position: camera.position.clone(),
      target: controls.target.clone(),
      maxDistance: controls.maxDistance,
      fogNear: scene.fog.near,
      fogFar: scene.fog.far,
    };
  }
  ({ width: captureWidth, height: captureHeight } = outputDimensions());
  applyOutputCameraPreset();
  camera.aspect = captureWidth / captureHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(captureWidth, captureHeight, false);
  configureHud(hudCamera, captureWidth, captureHeight);
  controls.enabled = false;
  elements.scene.classList.add('streaming');
  elements.sceneTip.textContent = 'Prévia exata da transmissão';
}

function leaveCaptureView() {
  const saved = previewCameraState;
  previewCameraState = null;
  captureWidth = 0;
  captureHeight = 0;
  elements.scene.classList.remove('streaming');
  elements.sceneTip.textContent = 'Arraste para girar • role para aproximar';
  if (saved) {
    camera.position.copy(saved.position);
    controls.target.copy(saved.target);
    controls.maxDistance = saved.maxDistance;
    scene.fog.near = saved.fogNear;
    scene.fog.far = saved.fogFar;
  }
  controls.enabled = true;
  resize();
  controls.update();
}

const sceneStartedAt = performance.now();
const animationTimer = new THREE.Timer();
animationTimer.connect(document);
function render(timestamp) {
  const now = performance.now(); const t = (now - sceneStartedAt) / 1000;
  animationTimer.update(timestamp);
  const deltaSeconds = Math.min(animationTimer.getDelta(), .05);
  updateArrivalAnimation(now);
  updateSocialTargets(now);
  animateGrassInWind(t);
  animateTreesInWind(t);
  animateWindLeaves(t, deltaSeconds);
  animateDonationAlert(now, t, deltaSeconds);
  waterfallMaterial.uniforms.time.value = t;
  surfaceStream.material.emissiveIntensity = .16 + Math.sin(t * 1.4) * .035;
  waterfallMist.rotation.y = Math.sin(t * .22) * .08;
  waterfallMist.position.y = Math.sin(t * .8) * .06;
  magicCrystals.forEach((crystal) => {
    const pulse = 1 + Math.sin(t * 1.35 + crystal.userData.phase) * .035;
    crystal.scale.setScalar(crystal.userData.baseScale * pulse);
    if (crystal.userData.glow) crystal.userData.glow.intensity = 2.1 + Math.sin(t * 1.7 + crystal.userData.phase) * .45;
  });
  hangingVines.forEach((vine) => {
    vine.rotation.z = Math.sin(t * .42 + vine.userData.phase) * .018;
    vine.rotation.x = Math.sin(t * .31 + vine.userData.phase) * .009;
  });
  backgroundIslands.forEach((island) => {
    island.position.y = island.userData.baseY + Math.sin(t * .16 + island.userData.phase) * .14;
  });
  birds.forEach((bird, index) => {
    bird.position.x += deltaSeconds * bird.userData.speed;
    if (bird.position.x > 10) bird.position.x = -10;
    bird.position.y = bird.userData.baseY + Math.sin(t * .7 + bird.userData.phase) * .16;
    bird.rotation.z = Math.sin(t * 2.2 + index) * .08;
  });
  airParticles.rotation.y = t * .018;
  airParticles.position.y = Math.sin(t * .28) * .08;
  immersiveCloudRings.forEach((ring, index) => {
    ring.rotation.y = t * (index === 0 ? .0035 : -.0022);
    ring.position.y = Math.sin(t * .11 + index * 1.8) * (index === 0 ? .12 : .2);
  });
  clouds.forEach((cloud) => {
    cloud.position.x += deltaSeconds * cloud.userData.driftSpeed;
    cloud.position.y = cloud.userData.baseY + Math.sin(t * .22 + cloud.userData.phase) * .08;
    if (cloud.position.x > 14) cloud.position.x = -14;
  });
  lakeRipples.forEach((ripple, index) => {
    const pulse = 1 + Math.sin(t * .75 + index * 1.9) * .1;
    ripple.scale.set(pulse, .58 * pulse, 1);
    ripple.material.opacity = .28 + (Math.sin(t * .75 + index * 1.9) + 1) * .09;
  });
  for (const [id, avatar] of avatars) {
    const deltaX = avatar.userData.target.x - avatar.position.x;
    const deltaZ = avatar.userData.target.z - avatar.position.z;
    const distance = Math.hypot(deltaX, deltaZ);
    const moving = distance > .035;
    if (moving) {
      const speed = avatar.userData.phase === 'exiting' ? 3.25 : avatar.userData.phase === 'entering' ? 2.75 : 1.6;
      const step = Math.min(distance, speed * deltaSeconds);
      avatar.position.x += deltaX / distance * step;
      avatar.position.z += deltaZ / distance * step;
      avatar.lookAt(avatar.userData.target.x, avatar.position.y, avatar.userData.target.z);
    } else if (avatar.userData.socialPhase === 'interact' && avatar.userData.socialPartner) {
      const partnerPosition = avatar.userData.socialPartner.position;
      avatar.lookAt(partnerPosition.x, avatar.position.y, partnerPosition.z);
    }
    const fallbackBob = avatar.userData.mixer ? 0 : Math.sin(t * 2 + avatar.userData.bob) * .035;
    let visualMotion = { heightOffset: 0, scaleMultiplier: 1, spin: 0 };
    if (avatar.userData.phase === 'entering') {
      const duration = avatar.userData.entryMode === 'drop' ? 1_600 : avatar.userData.entryMode === 'portal' ? 1_500 : 1_250;
      visualMotion = entryMotion(avatar.userData.entryMode, (now - avatar.userData.phaseStartedAt) / duration);
    } else if (avatar.userData.phase === 'exiting') {
      const duration = avatar.userData.exitMode === 'walk' ? 4_000 : 1_600;
      visualMotion = exitMotion(avatar.userData.exitMode, (now - avatar.userData.phaseStartedAt) / duration);
    }
    avatar.position.y = terrainHeightAt(avatar.position.x, avatar.position.z) + fallbackBob + visualMotion.heightOffset;
    avatar.scale.setScalar(avatar.userData.layoutScale * visualMotion.scaleMultiplier);
    if (visualMotion.spin) avatar.rotation.y = avatar.userData.motionBaseRotation + visualMotion.spin;
    const desiredAnimation = avatarActivityAnimation({
      moving,
      socialPhase: avatar.userData.socialPhase,
      index: avatar.userData.socialIndex,
    });
    setAvatarAnimation(avatar, desiredAnimation);
    avatar.userData.mixer?.update(deltaSeconds);
    if (avatar.userData.interactionSpark) {
      const interacting = !moving && avatar.userData.socialPhase === 'interact';
      avatar.userData.interactionSpark.visible = interacting;
      avatar.userData.interactionSpark.rotation.y += deltaSeconds * 2.6;
      avatar.userData.interactionSpark.position.y = 2.15 + Math.sin(t * 3 + avatar.userData.socialIndex) * .08;
    }
    if (avatar.userData.phase === 'exiting') {
      const elapsed = now - avatar.userData.phaseStartedAt;
      const exitComplete = avatar.userData.exitMode === 'walk' ? distance < .08 || elapsed >= 4_000 : elapsed >= 1_600;
      if (exitComplete) removeAvatar(id, avatar);
    }
  }
  if (controls.enabled) controls.update();
  renderWorld(
    renderer,
    camera,
    hudCamera,
    captureWidth || previewWidth,
    captureHeight || previewHeight,
  );
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

function closeOutputSocket() {
  const socket = outputSocket;
  outputSocket = null;
  if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
}

function stopCanvasCapture({ closeSocket = true } = {}) {
  captureSessionGeneration += 1;
  if (captureStopPromise) return captureStopPromise;
  captureStopPromise = (async () => {
    if (canvasRecorder && canvasRecorder.state !== 'inactive') {
      await new Promise((resolve) => {
        canvasRecorder.addEventListener('stop', resolve, { once: true });
        canvasRecorder.stop();
      });
    }
    canvasRecorder = null;
    if (closeSocket) closeOutputSocket();
    if (captureAudio?.kind === 'music' && captureMediaStream) {
      captureMediaStream.getVideoTracks().forEach((track) => track.stop());
    } else {
      stopMediaTracks(captureMediaStream);
    }
    captureMediaStream = null;
    if (captureAudio) {
      if (captureAudio.kind === 'music') stopMusicForLive(musicPlayer);
      else {
        if (captureAudio.started) captureAudio.source.stop();
        if (captureAudio.context.state !== 'closed') await captureAudio.context.close();
      }
      captureAudio = null;
    }
    leaveCaptureView();
  })().finally(() => { captureStopPromise = null; });
  return captureStopPromise;
}

function assertCaptureSession(generation, socket) {
  if (!captureSessionIsActive(generation, captureSessionGeneration, socket, outputSocket)) {
    throw new Error('A conexão de envio foi encerrada durante a inicialização.');
  }
}

async function startCanvasCapture() {
  // A retry can happen after FFmpeg/YouTube closes the previous socket.
  // Release the old recorder first so only one capture pipeline stays active.
  await stopCanvasCapture();
  const generation = ++captureSessionGeneration;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${protocol}://${location.host}/ws/output`);
  outputSocket = socket;
  socket.addEventListener('close', () => {
    if (outputSocket !== socket) return;
    outputSocket = null;
    void stopCanvasCapture({ closeSocket: false });
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('Não foi possível abrir o envio do canvas 3D.')), { once: true });
    socket.addEventListener('close', () => reject(new Error('A conexão de envio foi encerrada durante a inicialização.')), { once: true });
  });
  assertCaptureSession(generation, socket);
  let audioTrack;
  const route = await ensureMusicRoute();
  if (route) {
    captureAudio = { kind: 'music' };
    await startMusicForLive(musicPlayer);
    audioTrack = route.track;
  } else {
    const context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    const source = context.createConstantSource();
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(destination);
    captureAudio = { context, source, started: false };
    source.start();
    captureAudio.started = true;
    await context.resume();
    audioTrack = destination.stream.getAudioTracks()[0];
  }
  assertCaptureSession(generation, socket);
  enterCaptureView();
  renderWorld(renderer, camera, hudCamera, captureWidth, captureHeight);
  const canvasStream = renderer.domElement.captureStream(30);
  captureMediaStream = new MediaStream([...canvasStream.getVideoTracks(), audioTrack]);
  const preferredType = 'video/webm;codecs=vp8,opus';
  const options = MediaRecorder.isTypeSupported(preferredType)
    ? { mimeType: preferredType, videoBitsPerSecond: 3_000_000 }
    : { videoBitsPerSecond: 3_000_000 };
  canvasRecorder = new MediaRecorder(captureMediaStream, options);
  canvasRecorder.addEventListener('dataavailable', async ({ data }) => {
    if (!data.size) return;
    const buffer = await data.arrayBuffer();
    const socket = outputSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(buffer);
  });
  assertCaptureSession(generation, socket);
  canvasRecorder.start(500);
}

const demoNameField = document.querySelector('#demo-name');
const donationNameField = document.querySelector('#donation-name');
const donationAmountField = document.querySelector('#donation-amount');
const donationMessageField = document.querySelector('#donation-message');
document.querySelector('#demo-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!demoNameField.value.trim()) return toast('Informe o nome do participante de teste.');
  try {
    const data = await api('/api/demo/join', { method: 'POST', body: JSON.stringify({ display_name: demoNameField.value }) });
    updateParticipants(data.participants);
    toast('Entrada de teste iniciada.');
  } catch (error) { toast(error.message); }
});
document.querySelector('#test-exit').addEventListener('click', async () => {
  if (!demoNameField.value.trim()) return toast('Informe o nome do participante de teste.');
  try {
    const data = await api('/api/demo/leave', { method: 'POST', body: JSON.stringify({ display_name: demoNameField.value }) });
    updateParticipants(data.participants);
    toast('Saída de teste iniciada.');
  } catch (error) { toast(error.message); }
});
document.querySelector('#donation-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const donorName = donationNameField.value.trim();
  const amount = Number(donationAmountField.value);
  if (!donorName) return toast('Informe o nome de quem fez a doação.');
  if (!Number.isFinite(amount) || amount <= 0) return toast('Informe um valor de doação válido.');
  try {
    await api('/api/donations/alert', {
      method: 'POST',
      body: JSON.stringify({ donor_name: donorName, amount, message: donationMessageField.value.trim() }),
    });
    toast('Alerta de doação enviado para o palco.');
  } catch (error) { toast(error.message); }
});
document.querySelector('#mercado-pago-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const accessToken = elements.mercadoPagoToken.value.trim();
  const amount = Number(elements.mercadoPagoAmount.value);
  const payerEmail = elements.mercadoPagoEmail.value.trim();
  if (!accessToken) return toast('Informe o Access Token do Mercado Pago.');
  if (!Number.isFinite(amount) || amount <= 0) return toast('Informe um valor de doação válido.');
  if (!elements.mercadoPagoEmail.checkValidity() || !payerEmail) return toast('Informe um e-mail válido para a cobrança Pix.');
  try {
    updateStatus(await api('/api/donations/mercado-pago/configure', {
      method: 'POST',
      body: JSON.stringify({ access_token: accessToken, amount, payer_email: payerEmail, expiration_minutes: 30 }),
    }));
    toast('QR Pix ativado. As aprovações serão consultadas automaticamente.');
  } catch (error) { toast(error.message); }
});
elements.disableMercadoPago.addEventListener('click', async () => {
  try {
    updateStatus(await api('/api/donations/mercado-pago/disable', { method: 'POST' }));
    toast('Doações via Pix desativadas.');
  } catch (error) { toast(error.message); }
});
document.querySelector('#clear-stage').addEventListener('click', async () => { await api('/api/participants/clear', { method: 'POST' }); updateParticipants([]); });
elements.panelTabs.forEach((tab) => {
  tab.addEventListener('click', () => activatePanelTab(tab.dataset.panelTab));
});
elements.musicFile.addEventListener('change', async () => {
  const [file] = elements.musicFile.files;
  if (!file) return;
  if (!['audio/mpeg', 'audio/wav', 'audio/ogg'].includes(file.type)) {
    elements.musicFile.value = '';
    return toast('Escolha uma faixa MP3, WAV ou OGG.');
  }
  await releaseSelectedMusic();
  musicObjectUrl = URL.createObjectURL(file);
  musicPlayer = new Audio(musicObjectUrl);
  musicPlayer.loop = true;
  musicPlayer.preload = 'auto';
  musicPlayer.volume = musicVolume;
  elements.musicName.textContent = file.name;
  updateMusicControls();
  toast('Faixa selecionada. Ela começará automaticamente ao iniciar a live.');
});
elements.musicVolume.addEventListener('input', () => {
  musicVolume = Number(elements.musicVolume.value) / 100;
  updateMusicVolumePresentation();
  if (musicRoute) musicRoute.gain.gain.value = musicVolume;
  else if (musicPlayer) musicPlayer.volume = musicVolume;
});
elements.musicPlay.addEventListener('click', async () => {
  try {
    await ensureMusicRoute();
    await playMusicPlayback(musicPlayer);
  } catch { toast('Não foi possível tocar esta faixa agora.'); }
});
elements.musicPause.addEventListener('click', () => { if (musicPlayer) pauseMusicPlayback(musicPlayer); });
elements.liveSource.addEventListener('input', () => updateStatus(dashboardStatus));
elements.start.addEventListener('click', async () => {
  const source = elements.liveSource.value.trim();
  if (!source) return toast('Informe o link da live para iniciar a transmissão.');
  try {
    updateStatus(await api('/api/chat/connect', { method: 'POST', body: JSON.stringify({ source }) }));
    updateStatus(await api('/api/stream/start', { method: 'POST' }));
    await startCanvasCapture();
    toast('Chat conectado e canvas 3D enviado. Confira a prévia no YouTube Studio antes de publicar.');
  } catch (error) { await stopCanvasCapture(); try { updateStatus(await api('/api/stream/stop', { method: 'POST' })); } catch {} toast(error.message); }
});
elements.stop.addEventListener('click', async () => { await stopCanvasCapture(); updateStatus(await api('/api/stream/stop', { method: 'POST' })); toast('Envio interrompido.'); });
document.querySelector('#stream-form').addEventListener('submit', async (event) => { event.preventDefault(); const key = document.querySelector('#stream-key').value.trim(); if (!key) return toast('Informe a chave de transmissão.'); try { updateStatus(await api('/api/stream/configure', { method: 'POST', body: JSON.stringify({ stream_key: key }) })); toast('Chave salva somente nesta sessão local.'); } catch (error) { toast(error.message); } });
elements.entryAnimation.addEventListener('change', () => {
  entryAnimationMode = normaliseEntryMode(elements.entryAnimation.value);
  localStorage.setItem('live-gamer-entry-animation', entryAnimationMode);
});
elements.exitAnimation.addEventListener('change', () => {
  exitAnimationMode = normaliseExitMode(elements.exitAnimation.value);
  localStorage.setItem('live-gamer-exit-animation', exitAnimationMode);
});
async function pollStreamStatus() { try { updateStatus(await api('/api/status')); } catch {} }
async function initialise() { try { updateMusicControls(); updateParticipants(await api('/api/participants')); updateStatus(await api('/api/status')); } catch { toast('Servidor indisponível. Recarregue a página após iniciá-lo.'); } }
function connectSocket() { const protocol = location.protocol === 'https:' ? 'wss' : 'ws'; const socket = new WebSocket(`${protocol}://${location.host}/ws`); socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (message.type === 'participants') updateParticipants(message.data); if (message.type === 'status' || message.type === 'mercado_pago') updateStatus(message.data); if (message.type === 'donation') triggerDonationAlert(message.data); }); socket.addEventListener('close', () => setTimeout(connectSocket, 2500)); }
initialise(); connectSocket(); setInterval(pollStreamStatus, 3000);
