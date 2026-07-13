import * as THREE from 'three';

export function normalizeModel(group: THREE.Group) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const scale = 3.8 / maxAxis;

  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box.min.y;
  group.scale.setScalar(scale);

  return group;
}
