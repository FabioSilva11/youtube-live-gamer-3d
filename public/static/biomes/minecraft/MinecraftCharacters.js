import * as THREE from 'three';

export function createMinecraftCharacter(id) {
  const body = new THREE.Group(); body.userData.ownsAvatarResources = true;
  const hash = [...id].reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 0);
  const shirt = new THREE.MeshStandardMaterial({ color: [0x52bec1, 0xe7a747, 0xb079ce, 0xdf7962, 0x7098d1][hash % 5], roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: [0xd8a071, 0xf0c29b, 0x96633e][hash % 3], roughness: 1 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x35495d, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x302923 });
  function cube(parent, w, h, d, x, y, z, material) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  cube(body, .55, .65, .32, 0, 1.02, 0, shirt);
  cube(body, .51, .51, .5, 0, 1.62, 0, skin);
  cube(body, .53, .16, .52, 0, 1.83, 0, dark);
  for (const x of [-.13, .13]) cube(body, .07, .065, .025, x, 1.66, .26, dark);
  function limb(x, y, material, length) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); body.add(pivot);
    cube(pivot, .23, length, .29, 0, -length / 2, 0, material); return pivot;
  }
  const leftLeg = limb(-.15, .7, pants, .7), rightLeg = limb(.15, .7, pants, .7);
  const leftArm = limb(-.41, 1.34, skin, .64), rightArm = limb(.41, 1.34, skin, .64);
  const block = cube(rightArm, .3, .3, .3, 0, -.66, .12, new THREE.MeshStandardMaterial({ color: 0xc89b5c })); block.visible = false;
  body.userData.limbs = { leftLeg, rightLeg, leftArm, rightArm, block };
  return body;
}
