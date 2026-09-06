import { createPixAnimation } from '/static/shared/PixAnimation.js';
import { CharacterManager } from '/static/shared/CharacterManager.js';
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
} from '/static/shared/UserJoinLeave.js';
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
import { createBiomeRuntime, normaliseBiome } from '/static/shared/biomes.js';
const terrainHeightAt = (x, z) => activeBiome.heightAt(x, z);
import {
  normaliseOutputProfile,
  normaliseOrientation,
  compositionKey,
  normaliseSceneView,
  orientedCameraPreset,
  outputCameraPreset,
  outputDimensions,
  outputProfile,
} from '/static/output.js?v=stream-profiles-1';
import {
  avatarActivityAnimation,
  explorationTarget,
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
  streamKey: document.querySelector('#stream-key'), streamProfile: document.querySelector('#stream-profile'),
  outputHelp: document.querySelector('#output-help'),
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
  loader: document.querySelector('#stage-loader'),
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
let orientation = 'landscape';
let sceneComposition = { version: 1, views: {} };
let editorMode = false;
let initialStageApplied = false;
let streamProfileId = normaliseOutputProfile(localStorage.getItem('live-gamer-stream-profile') || 'economy');
const arrivalQueue = new ArrivalQueue();
let entryAnimationMode = normaliseEntryMode(localStorage.getItem('live-gamer-entry-animation') || 'spotlight');
let exitAnimationMode = normaliseExitMode(localStorage.getItem('live-gamer-exit-animation') || 'walk');
elements.entryAnimation.value = entryAnimationMode;
elements.exitAnimation.value = exitAnimationMode;
elements.streamProfile.value = streamProfileId;
updateStreamProfilePresentation();
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

function updateStreamProfilePresentation() {
  const profile = outputProfile(streamProfileId);
  elements.outputHelp.textContent = profile.id === 'normal'
    ? 'Modo normal: 1280 × 720, 30 FPS e aproximadamente 3 Mb/s.'
    : 'Modo econômico: 854 × 480, 24 FPS e aproximadamente 1,4 Mb/s.';
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
  if (streaming && status.stream_profile) {
    streamProfileId = normaliseOutputProfile(status.stream_profile);
    elements.streamProfile.value = streamProfileId;
    updateStreamProfilePresentation();
  }
  elements.streamStatus.textContent = status.stream_error ? 'ERRO DE ENVIO' : streaming ? 'AO VIVO' : status.stream_configured ? 'CONFIGURADA' : 'PRONTA';
  elements.streamStatus.style.color = status.stream_error ? '#ff6f7d' : streaming ? '#63eed2' : '';
  const hasLiveSource = Boolean(elements.liveSource.value.trim());
  elements.start.disabled = streaming || !status.ffmpeg_available || !status.stream_configured || !hasLiveSource;
  elements.stop.disabled = !streaming;
  elements.musicFile.disabled = streaming;
  elements.streamProfile.disabled = streaming;
  if (status.stream_error) elements.streamNote.textContent = status.stream_error;
  else if (streaming) elements.streamNote.textContent = streamProfileId === 'normal'
    ? 'Enviando em modo normal: 720p, 30 FPS e cerca de 3 Mb/s.'
    : 'Enviando em modo econômico: 480p, 24 FPS e cerca de 1,4 Mb/s.';
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
  target.toneMappingExposure = .9;
  target.autoClear = false;
  return target;
}

const renderer = createRenderer();
elements.scene.append(renderer.domElement);
let scene = new THREE.Scene();
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
scene.fog = new THREE.Fog(0xa9cfe2, 38, 85);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const hudScene = new THREE.Scene();
const hudCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
const rankingCanvas = document.createElement('canvas');
rankingCanvas.width = 768; rankingCanvas.height = 84;
const rankingContext = rankingCanvas.getContext('2d');
const rankingTexture = new THREE.CanvasTexture(rankingCanvas);
rankingTexture.colorSpace = THREE.SRGBColorSpace;
rankingTexture.generateMipmaps = false;
rankingTexture.minFilter = THREE.LinearFilter;
rankingTexture.magFilter = THREE.LinearFilter;
const rankingSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: rankingTexture,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
}));
hudScene.add(rankingSprite);
const rankingImages = new Map();
let currentRankingPeople = [];
const pixDonationCanvas = document.createElement('canvas');
pixDonationCanvas.width = 1024; pixDonationCanvas.height = 1160;
const pixDonationContext = pixDonationCanvas.getContext('2d');
const pixDonationTexture = new THREE.CanvasTexture(pixDonationCanvas);
pixDonationTexture.colorSpace = THREE.SRGBColorSpace;
pixDonationTexture.generateMipmaps = false;
pixDonationTexture.minFilter = THREE.LinearFilter;
pixDonationTexture.magFilter = THREE.LinearFilter;
const pixDonationSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: pixDonationTexture,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
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
  const gradient = context.createLinearGradient(0, 0, 1024, 1160);
  gradient.addColorStop(0, '#063f30');
  gradient.addColorStop(1, '#09291f');
  context.fillStyle = gradient;
  context.beginPath(); context.roundRect(8, 8, 1008, 1144, 44); context.fill();
  context.strokeStyle = '#9af4d9'; context.lineWidth = 10; context.stroke();
  context.fillStyle = '#ffffff'; context.font = '700 58px Arial, sans-serif';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(state.demo ? 'PIX • DEMONSTRAÇÃO' : 'PIX DA LIVE', 512, 62);
  context.fillStyle = '#ffffff';
  context.beginPath(); context.roundRect(42, 112, 940, 940, 28); context.fill();
  const qrSize = 872;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 76, 146, qrSize, qrSize);
  context.imageSmoothingEnabled = true;
  const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: state.currency || 'BRL' }).format(Number(state.amount));
  context.fillStyle = '#fff29a'; context.font = '700 68px Arial, sans-serif';
  context.fillText(formattedAmount, 512, 1100);
  pixDonationTexture.needsUpdate = true;
  pixDonationSprite.visible = true;
}

async function refreshMercadoPagoQr(expectedChargeId) {
  if (!expectedChargeId || loadingPixChargeId === expectedChargeId) return;
  loadingPixChargeId = expectedChargeId;
  try {
    const state = platformPix;
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
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.minDistance = 7;
controls.maxPolarAngle = Math.PI * .47;
function activeSceneView() {
  return normaliseSceneView(sceneComposition?.views?.[compositionKey(activeBiome?.id, orientation)], orientation);
}
function applyOutputCameraPreset({ ignoreSaved = false } = {}) {
  const preset = orientedCameraPreset(activeBiome?.cameraPreset || outputCameraPreset(), orientation);
  const saved = ignoreSaved ? null : activeSceneView().camera;
  camera.fov = saved?.fov || preset.fov;
  const position = saved?.position || preset.position, target = saved?.target || preset.target;
  camera.position.set(position.x, position.y, position.z);
  controls.target.set(target.x, target.y, target.z);
  controls.maxDistance = preset.maxDistance;
  scene.fog.near = preset.fog.near;
  scene.fog.far = preset.fog.far;
  camera.updateProjectionMatrix();
  controls.update();
}
const fantasyBiome = await createBiomeRuntime('fantasy', { scene });
let activeBiome = fantasyBiome;
const biomeRuntimes = new Map([['fantasy', fantasyBiome]]);
applyOutputCameraPreset();

const pixAnimation = createPixAnimation(scene);
const { root: donationRoot, light: donationLight, trigger: triggerDonationAlert, update: animateDonationAlert } = pixAnimation;

const characterManager = new CharacterManager(THREE);
const { root: avatarRoot, avatars } = characterManager;
characterManager.attach(scene);
let socialAvatarIds = [];
const characterFiles = Array.from({ length: 18 }, (_, index) => `character-${String.fromCharCode(97 + index)}.glb`);
const characterTemplates = new Map();
const characterLoads = new Map();
const characterLoader = new GLTFLoader();

function makeLabel(name, role) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 112;
  const context = canvas.getContext('2d');
  context.fillStyle = '#10251f';
  context.beginPath();
  context.roundRect(5, 5, 502, 102, 50); context.fill();
  context.strokeStyle = role === 'criador' ? '#ffe080' : '#b9e987'; context.lineWidth = 3; context.stroke();
  context.fillStyle = '#f3f9ff'; context.font = '700 52px Arial, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
  const visibleName = Array.from(String(name));
  context.fillText(visibleName.length > 18 ? visibleName.slice(0, 17).join('') + '…' : name, 256, 57, 455);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const sprite = new THREE.Sprite(material); sprite.scale.set(2.4, .53, 1); sprite.position.y = 2.75;
  sprite.userData.isNameLabel = true;
  sprite.renderOrder = 10;
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
  replaceAvatarBody(group, activeBiome.id === 'minecraft' ? activeBiome.createBody(person.id) : fallbackBody()); group.add(makeLabel(person.display_name, person.role));
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
  group.userData.characterFile = characterFile;
  if (activeBiome.id === 'fantasy') loadCharacterTemplate(characterFile).then((template) => {
    if (template && activeBiome.id === 'fantasy' && avatars.get(person.id) === group) replaceAvatarBody(group, cloneSkinned(template.scene), template.animations);
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
      const index = avatar.userData.socialIndex ?? 0;
      const exitX = direction * (9.2 + (index % 3) * 0.4);
      const exitZ = 5.2 + (index % 5) * 0.45;
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
  image.src = '/api/photo?token=' + encodeURIComponent(stageToken || '') + '&id=' + encodeURIComponent(person.id);
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
  const visiblePeople = orientation === 'portrait' ? currentRankingPeople.slice(0, 3) : currentRankingPeople.slice(0, 5);
  if (rankingCanvas.width !== 768) rankingCanvas.width = 768;
  const desiredHeight = visiblePeople.length ? 102 + visiblePeople.length * 61 : 84;
  if (rankingCanvas.height !== desiredHeight) rankingCanvas.height = desiredHeight;
  rankingContext.clearRect(0, 0, rankingCanvas.width, rankingCanvas.height);
  rankingContext.fillStyle = 'rgba(7, 54, 35, .96)';
  rankingContext.beginPath(); rankingContext.roundRect(8, 8, 752, rankingCanvas.height - 16, 30); rankingContext.fill();
  rankingContext.strokeStyle = '#e2f4ae'; rankingContext.lineWidth = 5; rankingContext.stroke();
  rankingContext.fillStyle = '#ffffff'; rankingContext.font = '700 34px Arial, sans-serif'; rankingContext.textAlign = 'left'; rankingContext.textBaseline = 'middle';
  rankingContext.fillText('RANKING DO CHAT', 38, 42);
  rankingContext.font = '700 26px Arial, sans-serif'; rankingContext.fillStyle = '#fff19a'; rankingContext.textAlign = 'right';
  rankingContext.fillText(`${currentRankingPeople.length ? elements.rankingTotal.textContent : '0 autores'}`, 724, 42);
  visiblePeople.forEach((person, index) => {
    const y = 94 + index * 61;
    rankingContext.fillStyle = index === 0 ? 'rgba(255, 232, 121, .22)' : 'rgba(255,255,255,.085)';
    rankingContext.beginPath(); rankingContext.roundRect(28, y - 26, 712, 53, 20); rankingContext.fill();
    rankingContext.fillStyle = '#ffe36e'; rankingContext.font = '700 27px Arial, sans-serif'; rankingContext.textAlign = 'center'; rankingContext.fillText(`${index + 1}`, 57, y);
    drawRankingAvatar(person, 107, y, 22);
    rankingContext.fillStyle = '#ffffff'; rankingContext.font = '700 30px Arial, sans-serif'; rankingContext.textAlign = 'left';
    rankingContext.fillText(person.display_name, 145, y, 455);
    rankingContext.fillStyle = '#dff7ca'; rankingContext.font = '700 24px Arial, sans-serif'; rankingContext.textAlign = 'right';
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
    const avatar = avatars.get(person.id); const layout = activeBiome.id === 'minecraft' ? activeBiome.layout(index) : avatarLayoutFor(index, visiblePeople.length);
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
    if (avatar.userData.phase === 'active') {
      if (avatar.userData.spawnInitialized !== true) {
        avatar.userData.spawnInitialized = true;
        avatar.position.copy(avatar.userData.layoutTarget);
      }
      if (activeBiome.id === 'fantasy') avatar.userData.target.copy(avatar.userData.layoutTarget);
    }
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
      const exploration = explorationTarget(index, Math.floor((elapsed + index * 850) / 4500));
      avatar.userData.target.set(exploration.x, terrainHeightAt(exploration.x, exploration.z), exploration.z);
    } else {
      avatar.userData.target.copy(avatar.userData.layoutTarget);
    }
  });
}

function getSpawnPosition(avatar, entryMode) {
  const index = avatar.userData.socialIndex ?? 0;
  const layout = avatar.userData.layoutTarget || new THREE.Vector3(0, 0, 0);

  if (entryMode === 'drop' || entryMode === 'portal') {
    const angle = (index * 2.39996) % (Math.PI * 2);
    const jitter = 0.25;
    const x = layout.x + Math.cos(angle) * jitter;
    const z = layout.z + Math.sin(angle) * jitter;
    const y = terrainHeightAt(x, z);
    return {
      spawn: new THREE.Vector3(x, y, z),
      target: new THREE.Vector3(x, y, z),
    };
  }

  if (entryMode === 'spotlight') {
    const baseAngle = Math.PI * 0.5;
    const arcSpread = 0.92;
    const normalizedSlot = ((index * 3) % 7) / 6 - 0.5;
    const angle = baseAngle + normalizedSlot * 2 * arcSpread + (layout.x > 0 ? -0.12 : 0.12);
    const spawnRadius = 7.3 + (index % 3) * 0.35;
    const spawnX = Math.cos(angle) * spawnRadius;
    const spawnZ = Math.sin(angle) * spawnRadius;

    const midRadius = 3.6 + (index % 3) * 0.35;
    const midX = Math.cos(angle) * midRadius;
    const midZ = Math.sin(angle) * midRadius;

    return {
      spawn: new THREE.Vector3(spawnX, terrainHeightAt(spawnX, spawnZ), spawnZ),
      target: new THREE.Vector3(midX, terrainHeightAt(midX, midZ), midZ),
    };
  }

  return {
    spawn: new THREE.Vector3(layout.x, terrainHeightAt(layout.x, layout.z), layout.z),
    target: new THREE.Vector3(layout.x, terrainHeightAt(layout.x, layout.z), layout.z),
  };
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
    avatar.userData.spawnInitialized = true;
    const spawnData = getSpawnPosition(avatar, avatar.userData.entryMode);
    avatar.position.copy(spawnData.spawn);
    avatar.userData.target.copy(spawnData.target);
    if (spawnData.spawn.distanceTo(spawnData.target) > 0.1) {
      avatar.lookAt(spawnData.target.x, avatar.position.y, spawnData.target.z);
      avatar.userData.motionBaseRotation = avatar.rotation.y;
    }
  }
  // Queue scheduling and animation completion are independent: every entrant
  // must become active, including avatars released early for batch arrivals.
  const activeId = arrivalQueue.active;
  const scheduled = activeId ? avatars.get(activeId) : null;
  if (scheduled && arrivalQueue.pending.length && now - scheduled.userData.phaseStartedAt >= 350) {
    arrivalQueue.complete(activeId);
  }
  for (const [id, avatar] of avatars) {
    if (avatar.userData.phase !== 'entering') continue;
    const duration = avatar.userData.entryMode === 'drop' ? 1600 : avatar.userData.entryMode === 'portal' ? 1500 : 1250;
    if (now - avatar.userData.phaseStartedAt < duration) continue;
    avatar.userData.phase = 'active';
    avatar.userData.spawnInitialized = true;
    avatar.userData.target.copy(avatar.userData.layoutTarget);
    avatar.scale.setScalar(avatar.userData.layoutScale);
    avatar.rotation.y = avatar.userData.motionBaseRotation;
    arrivalQueue.complete(id);
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
  const box = activeSceneView().ranking;
  rankingSprite.scale.set(box.width * width, box.height * height, 1);
  rankingSprite.position.set((box.x + box.width / 2) * width, height - (box.y + box.height / 2) * height, 0);
}

function positionMercadoPagoQr(width, height) {
  const box = activeSceneView().pix;
  pixDonationSprite.scale.set(box.width * width, box.height * height, 1);
  pixDonationSprite.position.set((box.x + box.width / 2) * width, height - (box.y + box.height / 2) * height, 0);
}

const labelWorldPosition = new THREE.Vector3();
function renderWorld(targetRenderer, targetCamera, targetHudCamera, width, height) {
  // Keep names readable in pixels as avatars move farther from the camera.
  const labelPixels = height > width ? Math.max(70, Math.min(112, width * .2)) : Math.max(110, Math.min(170, width * .15));
  const projectionScale = 2 * Math.tan(THREE.MathUtils.degToRad(targetCamera.fov / 2)) / height;
  for (const avatar of avatars.values()) {
    const label = avatar.children.find(child => child.userData.isNameLabel);
    if (!label || avatar.scale.x < .05) continue;
    label.getWorldPosition(labelWorldPosition);
    labelWorldPosition.applyMatrix4(targetCamera.matrixWorldInverse);
    const worldWidth = labelPixels * projectionScale * Math.max(.1, -labelWorldPosition.z) / avatar.scale.x;
    label.scale.set(worldWidth, worldWidth * 112 / 512, 1);
  }
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
  camera.aspect = previewWidth / previewHeight;
  camera.updateProjectionMatrix();
  // Resolve high-density displays without exceeding a Full HD drawing buffer.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2, Math.max(1, 1920 / previewWidth), Math.max(1, 1080 / previewHeight)));
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
  ({ width: captureWidth, height: captureHeight } = outputDimensions(streamProfileId, orientation));
  applyOutputCameraPreset();
  camera.aspect = captureWidth / captureHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(1);
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
let stageRendered = false;
function render(timestamp) {
  const now = performance.now(); const t = (now - sceneStartedAt) / 1000;
  animationTimer.update(timestamp);
  const deltaSeconds = Math.min(animationTimer.getDelta(), .05);
  updateArrivalAnimation(now);
  if (activeBiome.id === 'fantasy') updateSocialTargets(now);
  else activeBiome.updateBuilders(avatars, deltaSeconds, t);
  activeBiome.update(t, deltaSeconds);
  try { animateDonationAlert(now, t, deltaSeconds); }
  catch (error) {
    console.error('Não foi possível exibir o alerta de doação.', error);
    pixAnimation.reset();
  }
  for (const [id, avatar] of avatars) {
    const deltaX = avatar.userData.target.x - avatar.position.x;
    const deltaZ = avatar.userData.target.z - avatar.position.z;
    const distance = Math.hypot(deltaX, deltaZ);
    const moving = distance > .035;
    if (moving && !(activeBiome.id === 'minecraft' && avatar.userData.phase === 'active')) {
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
    if (!(activeBiome.id === 'minecraft' && avatar.userData.phase === 'active')) avatar.position.y = terrainHeightAt(avatar.position.x, avatar.position.z) + fallbackBob + visualMotion.heightOffset;
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
  if (!stageRendered) stageRendered = true;
  if (initialStageApplied && elements.loader && !elements.loader.classList.contains('is-hidden')) {
    elements.loader.classList.add('is-hidden');
    window.parent.postMessage({ type: 'stage-ready' }, location.origin);
  }
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
  const profile = outputProfile(streamProfileId);
  const canvasStream = renderer.domElement.captureStream(profile.fps);
  captureMediaStream = new MediaStream([...canvasStream.getVideoTracks(), audioTrack]);
  const preferredType = 'video/webm;codecs=vp8,opus';
  const options = MediaRecorder.isTypeSupported(preferredType)
    ? { mimeType: preferredType, videoBitsPerSecond: profile.videoBitsPerSecond }
    : { videoBitsPerSecond: profile.videoBitsPerSecond };
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
elements.streamProfile.addEventListener('change', () => {
  streamProfileId = normaliseOutputProfile(elements.streamProfile.value);
  localStorage.setItem('live-gamer-stream-profile', streamProfileId);
  updateStreamProfilePresentation();
  resize();
  if (dashboardStatus.stream_configured && dashboardStatus.stream_profile !== streamProfileId) {
    elements.streamNote.textContent = 'Qualidade alterada. Salve a configuração antes de iniciar a live.';
  }
});
elements.start.addEventListener('click', async () => {
  const source = elements.liveSource.value.trim();
  if (!source) return toast('Informe o link da live para iniciar a transmissão.');
  if (normaliseOutputProfile(dashboardStatus.stream_profile) !== streamProfileId) return toast('Salve a qualidade escolhida antes de iniciar a transmissão.');
  try {
    updateStatus(await api('/api/chat/connect', { method: 'POST', body: JSON.stringify({ source }) }));
    updateStatus(await api('/api/stream/start', { method: 'POST' }));
    await startCanvasCapture();
    toast('Chat conectado e canvas 3D enviado. Confira a prévia no YouTube Studio antes de publicar.');
  } catch (error) { await stopCanvasCapture(); try { updateStatus(await api('/api/stream/stop', { method: 'POST' })); } catch {} toast(error.message); }
});
elements.stop.addEventListener('click', async () => { await stopCanvasCapture(); updateStatus(await api('/api/stream/stop', { method: 'POST' })); toast('Envio interrompido.'); });
document.querySelector('#stream-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const key = elements.streamKey.value.trim();
  if (!key) return toast('Informe a chave de transmissão.');
  try {
    updateStatus(await api('/api/stream/configure', {
      method: 'POST',
      body: JSON.stringify({ stream_key: key, profile: streamProfileId }),
    }));
    toast(`Configuração ${streamProfileId === 'normal' ? 'normal' : 'econômica'} salva somente nesta sessão local.`);
  } catch (error) { toast(error.message); }
});
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
const stageToken = new URLSearchParams(location.search).get('token');
if (!stageToken) initialStageApplied = true;
let platformPix = {};
const receivedEvents = new Set();
let platformPolling = false;


let desiredBiomeId = 'fantasy';
const biomeLoads = new Map();
async function switchBiome(value) {
  const id = normaliseBiome(value);
  desiredBiomeId = id;
  if (activeBiome.id === id) return;
  if (!biomeRuntimes.has(id)) {
    if (!biomeLoads.has(id)) biomeLoads.set(id, createBiomeRuntime(id).then(runtime => { biomeRuntimes.set(id, runtime); return runtime; }).finally(() => biomeLoads.delete(id)));
    await biomeLoads.get(id);
    if (desiredBiomeId !== id || activeBiome.id === id) return;
  }
  activeBiome = biomeRuntimes.get(id);
  scene = activeBiome.scene;
  characterManager.attach(scene);
  scene.add(donationRoot, donationLight);
  for (const [id, avatar] of avatars) {
    const layout = activeBiome.id === 'minecraft' ? activeBiome.layout(avatar.userData.socialIndex) : avatarLayoutFor(avatar.userData.socialIndex, avatars.size);
    avatar.userData.layoutTarget.set(layout.x, activeBiome.heightAt(layout.x, layout.z), layout.z);
    avatar.userData.layoutScale = layout.scale;
    avatar.userData.target.copy(avatar.userData.layoutTarget);
    avatar.position.copy(avatar.userData.layoutTarget);
    avatar.userData.socialPhase = 'rest';
    avatar.userData.socialPartner = null;
    avatar.userData.builderWalking = false;
    avatar.userData.builderWorking = false;
    if (activeBiome.id === 'minecraft') replaceAvatarBody(avatar, activeBiome.createBody(id));
    else {
      replaceAvatarBody(avatar, fallbackBody());
      loadCharacterTemplate(avatar.userData.characterFile).then(template => {
        if (template && activeBiome.id === 'fantasy' && avatars.get(id) === avatar) replaceAvatarBody(avatar, cloneSkinned(template.scene), template.animations);
      });
    }
  }
  for (const runtime of biomeRuntimes.values()) runtime.resetPaths?.();
  applyOutputCameraPreset();
  resize();
}

let stageStateRevision = 0;
async function applyStageState(state) {
  if (!state) return;
  const revision = ++stageStateRevision;
  try { if (state.biome) await switchBiome(state.biome); }
  catch (error) { console.error(error); toast('Não foi possível carregar o ambiente. Tentando novamente…'); }
  if (revision !== stageStateRevision) return;
  if (state.orientation && normaliseOrientation(state.orientation) !== orientation) {
    orientation = normaliseOrientation(state.orientation);
    document.body.classList.toggle('stage-portrait', orientation === 'portrait');
    drawRankingCanvas(); applyOutputCameraPreset(); resize();
  }
  if (state.quality && normaliseOutputProfile(state.quality) !== streamProfileId) {
    streamProfileId = normaliseOutputProfile(state.quality);
    resize();
  }
  if (state.scene_composition) {
    sceneComposition = state.scene_composition;
    applyOutputCameraPreset();
  }
  if (state.pix) {
    platformPix = state.pix;
    if (platformPix.enabled && platformPix.charge_id) {
      void refreshMercadoPagoQr(platformPix.charge_id);
    } else if (!platformPix.enabled) {
      hideMercadoPagoQr();
    }
  }
  if (state.entry_animation) entryAnimationMode = normaliseEntryMode(state.entry_animation);
  if (state.exit_animation) exitAnimationMode = normaliseExitMode(state.exit_animation);
  if (state.participants) updateParticipants(state.participants);
  updateStatus({
    chat_connected: state.active && !state.error,
    participants: (state.participants || []).length,
    mercado_pago_configured: !!platformPix?.enabled,
    mercado_pago_has_qr: !!platformPix?.enabled,
    mercado_pago_charge_id: platformPix?.charge_id,
    mercado_pago_amount: platformPix?.amount,
  });
  for (const event of state.events || []) {
    if (!receivedEvents.has(event.id)) {
      receivedEvents.add(event.id);
      triggerDonationAlert(event);
    }
  }
  if (receivedEvents.size > 100) {
    const keep = [...receivedEvents].slice(-50);
    receivedEvents.clear();
    for (const id of keep) receivedEvents.add(id);
  }
  initialStageApplied = true;
}

async function platformPoll() {
  if (!stageToken || platformPolling) return;
  platformPolling = true;
  try {
    const response = await fetch('/api/stage?token=' + encodeURIComponent(stageToken));
    if (!response.ok) throw new Error('Palco indisponível');
    const state = await response.json();
    await applyStageState(state);
  } catch { /* The studio displays connection failures. Keep the last scene. */ }
  finally { platformPolling = false; }
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== window.parent) return;
  if (event.data?.type === 'stage-ready-check' && stageRendered && initialStageApplied) window.parent.postMessage({ type: 'stage-ready' }, location.origin);
  if (event.data?.type === 'stage-state') {
    applyStageState(event.data.state);
  } else if (event.data?.type === 'editor-mode') {
    editorMode = !!event.data.enabled;
    document.body.classList.toggle('editor-mode', editorMode);
    resize();
  } else if (event.data?.type === 'camera-mode') {
    const pan = event.data.mode === 'pan';
    controls.mouseButtons.LEFT = pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches.ONE = pan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    elements.scene.style.cursor = pan ? 'move' : 'grab';
  } else if (event.data?.type === 'reset-camera') {
    applyOutputCameraPreset({ ignoreSaved: true });
  } else if (event.data?.type === 'scene-composition-preview') {
    sceneComposition = event.data.scene_composition || sceneComposition;
    applyOutputCameraPreset();
  } else if (event.data?.type === 'stage-participants') {
    updateParticipants(event.data.participants || []);
  } else if (event.data?.type === 'update-settings') {
    if (event.data.entry_animation) entryAnimationMode = normaliseEntryMode(event.data.entry_animation);
    if (event.data.exit_animation) exitAnimationMode = normaliseExitMode(event.data.exit_animation);
  }
});
let cameraCommitTimer = 0;
function scheduleCameraCommit() {
  if (!editorMode) return;
  clearTimeout(cameraCommitTimer);
  cameraCommitTimer = setTimeout(() => {
    if (!editorMode) return;
    window.parent.postMessage({ type: 'scene-camera-change', camera: {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      fov: camera.fov,
    } }, location.origin);
  }, 180);
}
// OrbitControls keeps moving briefly after pointer-up when damping is enabled.
// Persist the settled camera, otherwise the saved OBS framing differs from the
// position the creator sees at the end of the gesture.
controls.addEventListener('change', scheduleCameraCommit);
controls.addEventListener('end', scheduleCameraCommit);
platformPoll(); if (stageToken) setInterval(platformPoll, 2500);
