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
  previewFovForAspect,
  rankingOverlayLayout,
} from '/static/output.js';
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
  streamNote: document.querySelector('#stream-note'), chatStatus: document.querySelector('#chat-status'),
  rankingList: document.querySelector('#ranking-list'), rankingTotal: document.querySelector('#ranking-total'),
  entryAnimation: document.querySelector('#entry-animation'), exitAnimation: document.querySelector('#exit-animation'),
  start: document.querySelector('#start-stream'), stop: document.querySelector('#stop-stream'),
  disconnect: document.querySelector('#disconnect-chat'), toast: document.querySelector('#toast'),
  musicFile: document.querySelector('#music-file'), musicName: document.querySelector('#music-name'),
  musicVolume: document.querySelector('#music-volume'), musicPlay: document.querySelector('#music-play'),
  musicPause: document.querySelector('#music-pause'),
};

let toastTimer;
let canvasRecorder = null;
let outputSocket = null;
let captureAudio = null;
let captureRenderer = null;
let captureCamera = null;
let captureHudCamera = null;
let captureMediaStream = null;
let captureStopPromise = null;
let captureSessionGeneration = 0;
let captureWidth = 0;
let captureHeight = 0;
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
function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 3600);
}

function updateStatus(incomingStatus) {
  const status = mergeDashboardStatus(dashboardStatus, incomingStatus);
  dashboardStatus = status;
  const count = status.participants ?? avatars.size;
  elements.count.textContent = `${count} participante${count === 1 ? '' : 's'}`;
  const chatConnected = Boolean(status.chat_connected);
  elements.chatStatus.textContent = chatConnected ? 'CONECTADO' : 'OFFLINE';
  elements.chatStatus.style.color = chatConnected ? '#63eed2' : '#ff9bac';
  elements.disconnect.disabled = !chatConnected;
  elements.onlineCopy.textContent = chatConnected ? 'Chat ao vivo conectado' : 'Aguardando chat';
  const streaming = Boolean(status.stream_running);
  elements.streamStatus.textContent = status.stream_error ? 'ERRO DE ENVIO' : streaming ? 'AO VIVO' : status.stream_configured ? 'CONFIGURADA' : 'PRONTA';
  elements.streamStatus.style.color = status.stream_error ? '#ff6f7d' : streaming ? '#63eed2' : '';
  elements.start.disabled = streaming || !status.ffmpeg_available || !status.stream_configured;
  elements.stop.disabled = !streaming;
  elements.musicFile.disabled = streaming;
  if (status.stream_error) elements.streamNote.textContent = status.stream_error;
  else if (streaming) elements.streamNote.textContent = 'O canvas Three.js está sendo enviado ao YouTube em tempo real.';
  else if (!status.ffmpeg_available) elements.streamNote.textContent = 'Instale o FFmpeg e deixe-o disponível no PATH para transmitir.';
  else if (!status.stream_configured) elements.streamNote.textContent = 'Cole a chave do YouTube Studio para liberar o envio do canvas 3D.';
  else elements.streamNote.textContent = 'Tudo pronto: a área 3D acima será a imagem da live.';
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
  target.toneMappingExposure = 1.18;
  target.autoClear = false;
  return target;
}

const renderer = createRenderer();
elements.scene.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x78cdf4);
scene.fog = new THREE.Fog(0x8bd7ee, 14, 35);
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
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(78, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      horizonColor: { value: new THREE.Color(0xc8f4ff) },
      zenithColor: { value: new THREE.Color(0x329df1) },
    },
    vertexShader: 'varying vec3 vDirection; void main(){ vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 horizonColor; uniform vec3 zenithColor; varying vec3 vDirection; void main(){ float blend = smoothstep(-0.08, 0.72, vDirection.y); gl_FragColor = vec4(mix(horizonColor, zenithColor, blend), 1.0); }',
  }),
);
scene.add(skyDome);
scene.add(new THREE.HemisphereLight(0xd8f5ff, 0x326328, 1.85));
const sunlight = new THREE.DirectionalLight(0xffe4a3, 3.25);
sunlight.position.set(-8, 14, 7); sunlight.castShadow = true; sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -11; sunlight.shadow.camera.right = 11; sunlight.shadow.camera.top = 11; sunlight.shadow.camera.bottom = -11;
sunlight.shadow.bias = -.0005; sunlight.shadow.normalBias = .025; scene.add(sunlight);
const warmFill = new THREE.PointLight(0xffb84d, 6.5, 24); warmFill.position.set(-8, 8, -10); scene.add(warmFill);

const meadowBase = new THREE.Mesh(
  new THREE.CylinderGeometry(8.25, 8.65, .48, 80),
  new THREE.MeshStandardMaterial({ color: 0x3f843a, roughness: 1 })
);
meadowBase.position.y = -.47; meadowBase.receiveShadow = true; scene.add(meadowBase);

const meadowGeometry = new THREE.CircleGeometry(8.25, 96);
const meadowPositions = meadowGeometry.getAttribute('position');
const meadowColors = [];
const meadowColor = new THREE.Color();
for (let index = 0; index < meadowPositions.count; index += 1) {
  const x = meadowPositions.getX(index);
  const z = -meadowPositions.getY(index);
  const height = terrainHeightAt(x, z);
  meadowPositions.setZ(index, height);
  meadowColor.setHSL(.285 + Math.sin(x * .8 + z) * .012, .68, .43 + height * .14);
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

const pathMaterial = new THREE.MeshStandardMaterial({ color: 0xd6c58b, roughness: 1 });
for (let index = 0; index < 15; index += 1) {
  const z = -5.6 + index * .74;
  const x = 1.9 + Math.sin(index * .7) * .46;
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(.28, .34, .08, 7), pathMaterial);
  stone.position.set(x, terrainHeightAt(x, z) + .035, z); stone.rotation.y = index * .61; stone.receiveShadow = true; scene.add(stone);
}

const grassBlades = new THREE.InstancedMesh(
  new THREE.ConeGeometry(.035, .32, 4),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .92 }),
  420
);
const grassTransform = new THREE.Object3D();
const grassColor = new THREE.Color();
for (let index = 0; index < 420; index += 1) {
  const angle = index * 2.3999632297;
  const radius = 1.1 + Math.sqrt((index + .5) / 420) * 6.7;
  const x = Math.cos(angle) * radius; const z = Math.sin(angle) * radius;
  grassTransform.position.set(x, terrainHeightAt(x, z) + .13, z);
  grassTransform.rotation.set(0, angle, (index % 5 - 2) * .07);
  grassTransform.scale.setScalar(.7 + (index % 7) * .07);
  grassTransform.updateMatrix();
  grassBlades.setMatrixAt(index, grassTransform.matrix);
  grassColor.setHSL(.28 + (index % 11) * .003, .7, .31 + (index % 5) * .018);
  grassBlades.setColorAt(index, grassColor);
}
grassBlades.instanceMatrix.needsUpdate = true; grassBlades.instanceColor.needsUpdate = true; grassBlades.receiveShadow = true; scene.add(grassBlades);

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

function goldenTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.18 * scale, .25 * scale, 2.1 * scale, 7), new THREE.MeshStandardMaterial({ color: 0x805027, roughness: 1 }));
  trunk.position.y = 1.05 * scale; trunk.castShadow = true; tree.add(trunk);
  const leafColors = [0xffc94a, 0xf6a83c, 0xffdb63];
  [[0, 2.35, 0, 1.15], [.55, 2.05, .08, .82], [-.5, 2.1, .12, .88]].forEach(([leafX, leafY, leafZ, leafScale], crownIndex) => {
    const leaves = new THREE.MeshStandardMaterial({ color: leafColors[crownIndex], roughness: .72, flatShading: true });
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(leafScale * scale, 0), leaves);
    crown.position.set(leafX * scale, leafY * scale, leafZ * scale); crown.castShadow = true; tree.add(crown);
  });
  tree.position.set(x, terrainHeightAt(x, z), z); scene.add(tree);
}
goldenTree(-6.35, -2.9, 1.05); goldenTree(6.2, -3.6, .9); goldenTree(-5.9, 3.9, .82); goldenTree(5.9, 4.3, .76);

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

const springSun = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffdf75 }));
springSun.position.set(-6.8, 7.2, -5.8); springSun.scale.setScalar(.58); scene.add(springSun);
const sunGlow = new THREE.PointLight(0xffd269, 5, 18); sunGlow.position.copy(springSun.position); scene.add(sunGlow);
const clouds = [];
function springCloud(x, y, z, scale = 1) {
  const cloud = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: .78, depthWrite: false });
  [[0, 0, 0, .62], [.55, .06, .02, .46], [-.52, .02, .04, .42], [.15, .25, 0, .45]].forEach(([px, py, pz, size]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(size * scale, 12, 8), material);
    puff.position.set(px * scale, py * scale, pz * scale); cloud.add(puff);
  });
  cloud.position.set(x, y, z); scene.add(cloud); clouds.push(cloud);
}
springCloud(-9, 7.8, -10, 1.05); springCloud(5.5, 9.1, -14, .78); springCloud(11, 6.5, -8, .62);
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

function renderWorld(targetRenderer, targetCamera, targetHudCamera, width, height) {
  positionRanking(width, height);
  targetRenderer.clear();
  targetRenderer.render(scene, targetCamera);
  targetRenderer.clearDepth();
  targetRenderer.render(hudScene, targetHudCamera);
}

function resize() {
  previewWidth = Math.max(1, Math.round(elements.scene.clientWidth));
  previewHeight = Math.max(1, Math.round(elements.scene.clientHeight));
  const output = outputDimensions();
  const preset = outputCameraPreset();
  camera.aspect = previewWidth / previewHeight;
  camera.fov = previewFovForAspect(preset.fov, output.width / output.height, camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(previewWidth, previewHeight, false);
  configureHud(hudCamera, previewWidth, previewHeight);
}
new ResizeObserver(resize).observe(elements.scene); resize();
const sceneStartedAt = performance.now();
const animationTimer = new THREE.Timer();
animationTimer.connect(document);
function render(timestamp) {
  const now = performance.now(); const t = (now - sceneStartedAt) / 1000;
  animationTimer.update(timestamp);
  const deltaSeconds = Math.min(animationTimer.getDelta(), .05);
  updateArrivalAnimation(now);
  updateSocialTargets(now);
  clouds.forEach((cloud, index) => {
    cloud.position.x += deltaSeconds * (.09 + index * .025);
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
  controls.update();
  renderWorld(renderer, camera, hudCamera, previewWidth, previewHeight);
  if (captureRenderer && captureCamera && captureHudCamera) {
    renderWorld(captureRenderer, captureCamera, captureHudCamera, captureWidth, captureHeight);
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
    if (captureRenderer) {
      captureRenderer.dispose();
      captureRenderer.forceContextLoss();
      captureRenderer = null;
    }
    captureCamera = null;
    captureHudCamera = null;
    captureWidth = 0;
    captureHeight = 0;
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
  ({ width: captureWidth, height: captureHeight } = outputDimensions());
  captureRenderer = createRenderer();
  captureRenderer.setSize(captureWidth, captureHeight, false);
  const capturePreset = outputCameraPreset();
  captureCamera = new THREE.PerspectiveCamera(capturePreset.fov, captureWidth / captureHeight, .1, 100);
  captureCamera.position.set(capturePreset.position.x, capturePreset.position.y, capturePreset.position.z);
  captureCamera.lookAt(capturePreset.target.x, capturePreset.target.y, capturePreset.target.z);
  captureCamera.updateProjectionMatrix();
  captureHudCamera = new THREE.OrthographicCamera(0, captureWidth, captureHeight, 0, -1, 1);
  configureHud(captureHudCamera, captureWidth, captureHeight);
  renderWorld(captureRenderer, captureCamera, captureHudCamera, captureWidth, captureHeight);
  const canvasStream = captureRenderer.domElement.captureStream(30);
  captureMediaStream = new MediaStream([...canvasStream.getVideoTracks(), audioTrack]);
  const preferredType = 'video/webm;codecs=vp8,opus';
  const options = MediaRecorder.isTypeSupported(preferredType)
    ? { mimeType: preferredType, videoBitsPerSecond: 3_000_000 }
    : { videoBitsPerSecond: 3_000_000 };
  canvasRecorder = new MediaRecorder(captureMediaStream, options);
  canvasRecorder.addEventListener('dataavailable', async ({ data }) => {
    if (!data.size || !outputSocket || outputSocket.readyState !== WebSocket.OPEN) return;
    outputSocket.send(await data.arrayBuffer());
  });
  assertCaptureSession(generation, socket);
  canvasRecorder.start(500);
}

document.querySelector('#youtube-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const source = document.querySelector('#chat-source').value.trim();
  if (!source) return toast('Informe o link público da live.');
  try { updateStatus(await api('/api/chat/connect', { method: 'POST', body: JSON.stringify({ source }) })); toast('Chat conectado. Os autores públicos aparecerão no palco.'); } catch (error) { toast(error.message); }
});
document.querySelector('#disconnect-chat').addEventListener('click', async () => { updateStatus(await api('/api/chat/disconnect', { method: 'POST' })); toast('Chat desconectado.'); });
const demoNameField = document.querySelector('#demo-name');
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
document.querySelector('#clear-stage').addEventListener('click', async () => { await api('/api/participants/clear', { method: 'POST' }); updateParticipants([]); });
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
elements.start.addEventListener('click', async () => { try { updateStatus(await api('/api/stream/start', { method: 'POST' })); await startCanvasCapture(); toast('Canvas 3D enviado. Confira a prévia no YouTube Studio antes de publicar.'); } catch (error) { await stopCanvasCapture(); try { updateStatus(await api('/api/stream/stop', { method: 'POST' })); } catch {} toast(error.message); } });
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
function connectSocket() { const protocol = location.protocol === 'https:' ? 'wss' : 'ws'; const socket = new WebSocket(`${protocol}://${location.host}/ws`); socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (message.type === 'participants') updateParticipants(message.data); if (message.type === 'status') updateStatus(message.data); }); socket.addEventListener('close', () => setTimeout(connectSocket, 2500)); }
initialise(); connectSocket(); setInterval(pollStreamStatus, 3000);
