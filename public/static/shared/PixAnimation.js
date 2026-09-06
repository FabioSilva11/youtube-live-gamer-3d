import * as THREE from 'three';

export function createPixAnimation(scene) {
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
// Keep the light in the scene: toggling its parent changes the light count
// and recompiles every lit material when an alert starts or ends.
scene.add(donationLight);

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
const donationBannerMaterial = new THREE.SpriteMaterial({ map: donationBannerTexture, transparent: true, depthTest: false, depthWrite: false, opacity: 0, toneMapped: false, fog: false });
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
  context.beginPath();
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
    donationLight.intensity = 0;
    activeDonation = null;
  }
}


return { root: donationRoot, light: donationLight, trigger: triggerDonationAlert, update: animateDonationAlert, reset() { activeDonation = null; donationRoot.visible = false; donationLight.intensity = 0; } };
}
