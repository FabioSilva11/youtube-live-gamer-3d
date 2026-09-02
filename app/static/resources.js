export function disposeOwnedRenderObject(object) {
  if (!object?.userData?.ownsAvatarResources) return false;
  object.userData.ownsAvatarResources = false;
  object.traverse((node) => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => material?.dispose?.());
  });
  return true;
}
