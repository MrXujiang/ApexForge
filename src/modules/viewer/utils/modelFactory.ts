import * as THREE from 'three';
import type { ModelCategory, ModelGenerationParams, ModelMetrics } from '@/shared/types/generation';

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value ?? fallback);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

let activeEdgeStyle: ReturnType<typeof resolveParams>['edgeStyle'] = 'filleted';
let activeChamferRadius = 0.065;
let activeCurveIntensity = 0.72;
let activeTextureDataUrl = '';
let activeTextureRepeatX = 1;
let activeTextureRepeatY = 1;
let activeTextureStrength = 0.72;
const textureCache = new Map<string, THREE.Texture>();

function getActiveTexture() {
  if (!activeTextureDataUrl) {
    return undefined;
  }

  const cacheKey = `${activeTextureDataUrl}:${activeTextureRepeatX}:${activeTextureRepeatY}`;
  const cached = textureCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const texture = new THREE.TextureLoader().load(activeTextureDataUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(activeTextureRepeatX, activeTextureRepeatY);
  texture.anisotropy = 8;
  textureCache.set(cacheKey, texture);
  return texture;
}

function createMaterial(color: string, preset = 'brushed-metal', roughness = 0.58) {
  const profile = {
    'matte-polymer': { metalness: 0.12, roughness: 0.82, clearcoat: 0.18, opacity: 1 },
    'brushed-metal': { metalness: 0.58, roughness: 0.38, clearcoat: 0.28, opacity: 1 },
    'anodized-metal': { metalness: 0.78, roughness: 0.28, clearcoat: 0.42, opacity: 1 },
    ceramic: { metalness: 0.08, roughness: 0.32, clearcoat: 0.55, opacity: 1 },
    'carbon-fiber': { metalness: 0.42, roughness: 0.52, clearcoat: 0.5, opacity: 1 },
    glass: { metalness: 0.02, roughness: 0.08, clearcoat: 0.82, opacity: 0.58 },
  }[preset] ?? { metalness: 0.38, roughness, clearcoat: 0.28, opacity: 1 };

  const texture = getActiveTexture();

  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: profile.metalness,
    roughness: texture ? Math.min(0.72, profile.roughness + (1 - activeTextureStrength) * 0.28) : profile.roughness,
    clearcoat: profile.clearcoat,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.25,
    transparent: profile.opacity < 1,
    opacity: profile.opacity,
    map: texture,
  });
}

function resolveParams(params?: ModelGenerationParams) {
  return {
    bodyColor: params?.bodyColor ?? '#f5f5f5',
    accentColor: params?.accentColor ?? '#111111',
    secondaryColor: params?.secondaryColor ?? '#8a8a8a',
    scale: clampNumber(params?.scale, 1, 0.7, 1.4),
    detailLevel: Math.round(clampNumber(params?.detailLevel, 4, 1, 5)),
    complexity: Math.round(clampNumber(params?.complexity, 4, 1, 5)),
    panelDensity: Math.round(clampNumber(params?.panelDensity, 4, 1, 5)),
    materialPreset: params?.materialPreset ?? 'brushed-metal',
    silhouette: params?.silhouette ?? 'technical-premium',
    skillsApplied: params?.skillsApplied ?? [],
    variantSeed: Math.round(clampNumber(params?.variantSeed, 0, 0, 999999)),
    mirrorVariant: params?.mirrorVariant ?? 'wall-mounted',
    frameStyle: params?.frameStyle ?? 'minimal-metal',
    reflectionOpacity: clampNumber(params?.reflectionOpacity, 0.66, 0.35, 0.92),
    edgeStyle: params?.edgeStyle ?? 'filleted',
    chamferRadius: clampNumber(params?.chamferRadius, 0.065, 0.01, 0.14),
    connectorDensity: Math.round(clampNumber(params?.connectorDensity, 3, 1, 5)),
    curveIntensity: clampNumber(params?.curveIntensity, 0.72, 0, 1),
    smoothJoints: params?.smoothJoints ?? true,
    mainTextureDataUrl: params?.mainTextureDataUrl ?? '',
    textureName: params?.textureName ?? '',
    textureRepeatX: clampNumber(params?.textureRepeatX, 1, 0.5, 4),
    textureRepeatY: clampNumber(params?.textureRepeatY, 1, 0.5, 4),
    textureStrength: clampNumber(params?.textureStrength, 0.72, 0.1, 1),
  };
}

function applyShadow(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createRoundedBoxGeometry(width: number, height: number, depth: number, radius: number) {
  const minDimension = Math.min(width, height, depth);
  if (minDimension < 0.045 || radius <= 0.01) {
    return new THREE.BoxGeometry(width, height, depth, 2, 2, 2);
  }

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const safeRadius = Math.min(radius, halfWidth * 0.42, halfHeight * 0.42, depth * 0.5);
  const bevel = Math.min(safeRadius * 0.35, depth * 0.22);
  const shape = new THREE.Shape();

  shape.moveTo(-halfWidth + safeRadius, -halfHeight);
  shape.lineTo(halfWidth - safeRadius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + safeRadius);
  shape.lineTo(halfWidth, halfHeight - safeRadius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - safeRadius, halfHeight);
  shape.lineTo(-halfWidth + safeRadius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - safeRadius);
  shape.lineTo(-halfWidth, -halfHeight + safeRadius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + safeRadius, -halfHeight);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geometry.center();
  return geometry;
}

function box(width: number, height: number, depth: number, material: THREE.Material, radius?: number) {
  const fallbackRadius = Math.min(width, height, depth) * 0.18;
  const styleRadius = activeEdgeStyle === 'sharp' ? 0 : activeChamferRadius * (activeEdgeStyle === 'filleted' ? 1 : 0.62) * (0.55 + activeCurveIntensity * 0.65);
  const geometry = createRoundedBoxGeometry(width, height, depth, radius ?? Math.min(0.11, Math.max(fallbackRadius, styleRadius)));
  return applyShadow(new THREE.Mesh(geometry, material));
}

function cylinder(radiusTop: number, radiusBottom: number, height: number, material: THREE.Material, segments = 32) {
  return applyShadow(new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material));
}

function sphere(radius: number, material: THREE.Material) {
  return applyShadow(new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material));
}

function torus(radius: number, tube: number, material: THREE.Material, radialSegments = 16, tubularSegments = 80) {
  return applyShadow(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments), material));
}

function connectorBetween(start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const connector = cylinder(radius, radius, length, material, 24);
  connector.position.copy(start).add(end).multiplyScalar(0.5);
  connector.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return connector;
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function createMirrorMaterial(color: string, opacity: number) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.18,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    reflectivity: 1,
    envMapIntensity: 2.2,
    transparent: true,
    opacity,
  });
}

function addSymmetricBox(group: THREE.Group, width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number) {
  [-1, 1].forEach((side) => {
    const item = box(width, height, depth, material);
    item.position.set(x, y, z * side);
    group.add(item);
  });
}

function addPanelLines(group: THREE.Group, count: number, material: THREE.Material, length: number, y: number, z: number) {
  for (let index = 0; index < count; index += 1) {
    const line = box(0.035, 0.035, length, material);
    line.position.set(-length / 2 + index * (length / Math.max(1, count - 1)), y, z);
    group.add(line);
  }
}

function addLocalMeshConnectors(group: THREE.Group, params: ReturnType<typeof resolveParams>, material: THREE.Material) {
  const meshInfos: Array<{ center: THREE.Vector3; radius: number; volume: number }> = [];
  group.updateMatrixWorld(true);
  const groupCenter = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const volume = size.x * size.y * size.z;
    if (!Number.isFinite(volume) || volume < 0.0008) {
      return;
    }

    meshInfos.push({
      center: bounds.getCenter(new THREE.Vector3()),
      radius: Math.max(size.x, size.y, size.z) * 0.5,
      volume,
    });
  });

  const candidates = meshInfos.sort((a, b) => b.volume - a.volume).slice(0, 36);
  const maxConnectors = Math.min(18, params.connectorDensity * 4 + params.complexity * 2);
  const usedPairs = new Set<string>();
  let connectorCount = 0;

  for (let index = 0; index < candidates.length && connectorCount < maxConnectors; index += 1) {
    const current = candidates[index];
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let nextIndex = 0; nextIndex < candidates.length; nextIndex += 1) {
      if (nextIndex === index) {
        continue;
      }

      const next = candidates[nextIndex];
      const distance = current.center.distanceTo(next.center);
      const pairKey = [Math.min(index, nextIndex), Math.max(index, nextIndex)].join(':');
      const threshold = Math.max(0.42, Math.min(1.45, (current.radius + next.radius) * (0.72 + params.curveIntensity * 0.46)));

      if (distance < nearestDistance && distance > 0.12 && distance <= threshold && !usedPairs.has(pairKey)) {
        nearestIndex = nextIndex;
        nearestDistance = distance;
      }
    }

    if (nearestIndex >= 0) {
      const pairKey = [Math.min(index, nearestIndex), Math.max(index, nearestIndex)].join(':');
      usedPairs.add(pairKey);
      const connector = connectorBetween(candidates[index].center, candidates[nearestIndex].center, 0.018 + params.curveIntensity * 0.032, material);
      const joint = sphere(0.035 + params.curveIntensity * 0.025, material);
      joint.position.copy(candidates[index].center).add(candidates[nearestIndex].center).multiplyScalar(0.5);
      group.add(connector);
      group.add(joint);
      connectorCount += 1;
    } else if (index > 0 && current.center.distanceTo(groupCenter) > 0.32) {
      const anchor = connectorBetween(current.center, groupCenter, 0.014 + params.curveIntensity * 0.02, material);
      group.add(anchor);
      connectorCount += 1;
    }
  }
}

function applyContinuityEnhancements(group: THREE.Group, params: ReturnType<typeof resolveParams>, category: string) {
  if (!params.smoothJoints) {
    return;
  }

  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const connectorMaterial = createMaterial(params.accentColor, 'anodized-metal');
  const secondaryMaterial = createMaterial(params.secondaryColor, 'brushed-metal');
  const radius = 0.025 + params.curveIntensity * 0.035;
  const shouldUseConnectorNetwork = ['vehicle', 'aircraft', 'furniture'].includes(category);

  if (!shouldUseConnectorNetwork) {
    return;
  }

  if (params.connectorDensity >= 3) {
    addLocalMeshConnectors(group, params, connectorMaterial);
  }

  const lowY = bounds.min.y + size.y * 0.22;
  const midY = bounds.min.y + size.y * 0.48;
  const xSpan = Math.max(size.x * 0.42, 0.7);
  const zSpan = Math.max(size.z * 0.42, 0.7);

  if (category !== 'jewelry' && category !== 'watch') {
    const spine = connectorBetween(
      new THREE.Vector3(center.x - xSpan, lowY, center.z),
      new THREE.Vector3(center.x + xSpan, lowY, center.z),
      radius,
      connectorMaterial,
    );
    group.add(spine);
  }

  const bridgeCount = Math.min(2, Math.max(1, params.connectorDensity - 2));
  for (let index = 0; index < bridgeCount; index += 1) {
    const ratio = bridgeCount === 1 ? 0.5 : index / (bridgeCount - 1);
    const x = center.x - xSpan + xSpan * 2 * ratio;
    const front = connectorBetween(
      new THREE.Vector3(x, lowY, center.z - zSpan),
      new THREE.Vector3(x, midY, center.z - zSpan * 0.52),
      radius * 0.72,
      secondaryMaterial,
    );
    const back = front.clone();
    back.position.z = center.z + Math.abs(front.position.z - center.z);
    group.add(front);
    group.add(back);
  }

  if (category === 'vehicle') {
    [-1, 1].forEach((side) => {
      const rail = connectorBetween(
        new THREE.Vector3(center.x - size.x * 0.36, bounds.min.y + size.y * 0.35, center.z + side * size.z * 0.42),
        new THREE.Vector3(center.x + size.x * 0.36, bounds.min.y + size.y * 0.35, center.z + side * size.z * 0.42),
        radius * 0.9,
        connectorMaterial,
      );
      group.add(rail);
    });
  }
}

function applySkillEnhancements(group: THREE.Group, params: ReturnType<typeof resolveParams>) {
  if (params.skillsApplied.length === 0) {
    return;
  }

  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const railMaterial = createMaterial(params.accentColor, 'anodized-metal');
  const markerMaterial = createMaterial(params.secondaryColor, 'ceramic');
  const width = Math.max(size.x, 1.2);
  const depth = Math.max(size.z, 1.2);
  const baseY = bounds.min.y - 0.08;

  const inspectionBase = box(width + 0.48, 0.035, depth + 0.48, railMaterial);
  inspectionBase.position.set(center.x, baseY, center.z);
  group.add(inspectionBase);

  const railCount = Math.min(8, params.panelDensity + params.detailLevel);
  for (let index = 0; index < railCount; index += 1) {
    const ratio = railCount === 1 ? 0.5 : index / (railCount - 1);
    const frontMarker = box(0.055, 0.08, 0.18, markerMaterial);
    frontMarker.position.set(center.x - width / 2 + width * ratio, baseY + 0.08, center.z + depth / 2 + 0.24);
    group.add(frontMarker);

    const rearMarker = frontMarker.clone();
    rearMarker.position.z = center.z - depth / 2 - 0.24;
    group.add(rearMarker);
  }

  params.skillsApplied.slice(0, 4).forEach((skill, index) => {
    const tag = box(0.28, 0.035, 0.08, railMaterial);
    tag.position.set(center.x - width / 2 + 0.2 + index * 0.34, baseY + 0.13, center.z - depth / 2 - 0.34);
    tag.userData = { skill: skill.name };
    group.add(tag);
  });
}

function normalizeCategory(category: ModelCategory) {
  const value = String(category).trim().toLowerCase();

  if (['vehicle', 'car', 'sport-car', 'supercar', '跑车', '汽车', '车辆'].some((keyword) => value.includes(keyword))) {
    return 'vehicle';
  }

  if (['jewelry', 'necklace', 'pendant', 'bracelet', 'bangle', 'wristband', '首饰', '珠宝', '项链', '吊坠', '手链', '手镯'].some((keyword) => value.includes(keyword))) {
    return 'jewelry';
  }

  if (['watch', 'wristwatch', 'wearable', '手表', '腕表', '穿戴'].some((keyword) => value.includes(keyword))) {
    return 'watch';
  }

  if (['architecture', 'building', 'tower', '建筑', '楼'].some((keyword) => value.includes(keyword))) {
    return 'architecture';
  }

  if (['aircraft', 'drone', '飞行器', '无人机'].some((keyword) => value.includes(keyword))) {
    return 'aircraft';
  }

  if (['furniture', 'chair', '家具', '椅'].some((keyword) => value.includes(keyword))) {
    return 'furniture';
  }

  if (['prop', '道具', '信标'].some((keyword) => value.includes(keyword))) {
    return 'prop';
  }

  return 'product';
}

export function createModelByCategory(category: ModelCategory, params?: ModelGenerationParams) {
  const resolvedParams = resolveParams(params);
  activeEdgeStyle = resolvedParams.edgeStyle;
  activeChamferRadius = resolvedParams.chamferRadius;
  activeCurveIntensity = resolvedParams.curveIntensity;
  activeTextureDataUrl = resolvedParams.mainTextureDataUrl;
  activeTextureRepeatX = resolvedParams.textureRepeatX;
  activeTextureRepeatY = resolvedParams.textureRepeatY;
  activeTextureStrength = resolvedParams.textureStrength;
  const normalizedCategory = normalizeCategory(category);
  let model: THREE.Group;

  switch (normalizedCategory) {
    case 'vehicle':
      model = createVehicleModel(resolvedParams);
      break;
    case 'watch':
      model = createWatchModel(resolvedParams);
      break;
    case 'jewelry':
      model = createJewelryModel(resolvedParams);
      break;
    case 'architecture':
      model = createArchitectureModel(resolvedParams);
      break;
    case 'aircraft':
      model = createAircraftModel(resolvedParams);
      break;
    case 'furniture':
      model = createFurnitureModel(resolvedParams);
      break;
    case 'prop':
      model = createPropModel(resolvedParams);
      break;
    default:
      model = createProductModel(resolvedParams, String(category));
  }

  applyContinuityEnhancements(model, resolvedParams, normalizedCategory);
  applySkillEnhancements(model, resolvedParams);
  model.scale.setScalar(resolvedParams.scale);
  return model;
}

export function calculateMetrics(group: THREE.Group): ModelMetrics {
  let meshes = 0;
  let vertices = 0;
  const materials = new Set<string>();

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      meshes += 1;
      vertices += object.geometry.attributes.position?.count ?? 0;
      const material = Array.isArray(object.material) ? object.material : [object.material];
      material.forEach((item) => materials.add(item.uuid));
    }
  });

  const score = Math.max(72, Math.min(96, 100 - Math.floor(meshes / 3)));
  return { meshes, vertices, materials: materials.size, score };
}

function createVehicleModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const body = createMaterial(params.bodyColor, params.materialPreset);
  const accent = createMaterial(params.accentColor, 'anodized-metal');
  const secondary = createMaterial(params.secondaryColor, 'brushed-metal');
  const glass = createMaterial('#9ca3af', 'glass');
  const length = params.silhouette.includes('robust') ? 5.5 : 5.35;
  const width = params.silhouette.includes('robust') ? 2.06 : 1.9;

  const underbody = box(length + 0.38, 0.18, width + 0.26, accent);
  underbody.position.y = 0.44;
  group.add(underbody);

  const monocoque = sphere(1, body);
  monocoque.scale.set(length * 0.5, 0.28, width * 0.48);
  monocoque.position.y = 0.86;
  group.add(monocoque);

  const lowCabin = sphere(1, glass);
  lowCabin.scale.set(1.15, 0.38, 0.62);
  lowCabin.position.set(-0.32, 1.22, 0);
  lowCabin.rotation.z = -0.08;
  group.add(lowCabin);

  const hood = box(1.78, 0.18, 1.42, body);
  hood.position.set(1.62, 1.0, 0);
  hood.rotation.z = -0.11;
  group.add(hood);

  const noseSplitter = box(1.3, 0.08, width + 0.46, accent);
  noseSplitter.position.set(2.75, 0.48, 0);
  noseSplitter.rotation.z = -0.04;
  group.add(noseSplitter);

  const rearDeck = box(1.42, 0.16, 1.5, body);
  rearDeck.position.set(-1.78, 1.02, 0);
  rearDeck.rotation.z = 0.08;
  group.add(rearDeck);

  const rearWing = box(0.12, 0.16, width + 0.86, accent);
  rearWing.position.set(-2.55, 1.52, 0);
  rearWing.rotation.z = 0.06;
  group.add(rearWing);

  addSymmetricBox(group, 2.92, 0.1, 0.12, secondary, 0.05, 1.08, width * 0.54);
  addSymmetricBox(group, 1.24, 0.22, 0.1, accent, 1.42, 0.78, width * 0.64);
  addSymmetricBox(group, 1.02, 0.2, 0.1, accent, -1.72, 0.78, width * 0.64);
  addSymmetricBox(group, 1.7, 0.08, 0.12, secondary, 0.32, 1.38, 0.76);

  const diffuser = box(0.62, 0.16, width, secondary);
  diffuser.position.set(-2.76, 0.55, 0);
  diffuser.rotation.z = 0.08;
  group.add(diffuser);

  const wheelPositions: Array<[number, number, number]> = [
    [-1.58, 0.42, -1.08],
    [1.58, 0.42, -1.08],
    [-1.58, 0.42, 1.08],
    [1.58, 0.42, 1.08],
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const sideOffset = z > 0 ? 0.18 : -0.18;
    const wheelZ = z + sideOffset;

    const tire = torus(0.46, 0.09, accent, 18, 72);
    tire.position.set(x, y, wheelZ);
    group.add(tire);

    const hub = cylinder(0.2, 0.2, 0.08, secondary, 48);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(x, y, wheelZ);
    group.add(hub);

    const rim = torus(0.26, 0.025, secondary, 10, 40);
    rim.position.set(x, y, wheelZ + (z > 0 ? 0.01 : -0.01));
    group.add(rim);

    const suspension = connectorBetween(new THREE.Vector3(x, y + 0.04, wheelZ), new THREE.Vector3(x, 0.72, z * 0.72), 0.045, secondary);
    group.add(suspension);

    const wheelArch = torus(0.52, 0.028, body, 10, 56);
    wheelArch.scale.set(1, 0.52, 0.18);
    wheelArch.position.set(x, y + 0.2, z * 0.9);
    wheelArch.rotation.x = Math.PI / 2;
    group.add(wheelArch);

    for (let spokeIndex = 0; spokeIndex < 8; spokeIndex += 1) {
      const spoke = box(0.36, 0.032, 0.026, secondary);
      spoke.rotation.z = (Math.PI * spokeIndex) / 8;
      spoke.position.set(x, y, wheelZ + (z > 0 ? 0.02 : -0.02));
      group.add(spoke);
    }
  });

  for (let index = 0; index < params.panelDensity + 2; index += 1) {
    const x = -2.0 + index * 0.34;

    [-1, 1].forEach((side) => {
      const intakeSlat = box(0.26, 0.035, 0.055, accent);
      intakeSlat.position.set(x, 0.86, side * (width * 0.58));
      intakeSlat.rotation.z = -0.08;
      group.add(intakeSlat);
    });
  }

  if (params.complexity >= 4) {
    [-1, 1].forEach((side) => {
      const sideSeam = box(3.2, 0.026, 0.035, secondary);
      sideSeam.position.set(0.12, 1.08, side * (width * 0.52));
      sideSeam.rotation.z = -0.04;
      group.add(sideSeam);
    });

    for (let index = 0; index < Math.min(params.panelDensity + 2, 6); index += 1) {
      const hoodGroove = box(0.52, 0.024, 0.035, secondary);
      hoodGroove.position.set(0.78 + index * 0.24, 1.11, index % 2 === 0 ? 0.34 : -0.34);
      hoodGroove.rotation.z = -0.1;
      group.add(hoodGroove);
    }

    const roofInlay = box(0.62, 0.032, 0.34, secondary);
    roofInlay.position.set(-0.18, 1.5, 0);
    roofInlay.rotation.z = -0.05;
    group.add(roofInlay);
  }

  return group;
}

function createArchitectureModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const facade = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const glass = createMaterial(params.secondaryColor, 'glass');
  const levels = 6 + params.detailLevel * 2;

  const podium = box(2.5, 0.42, 2.1, frame);
  podium.position.y = 0.24;
  group.add(podium);

  for (let index = 0; index < levels; index += 1) {
    const taper = index * 0.035;
    const level = box(1.85 - taper, 0.32, 1.55 - taper, index % 3 === 0 ? glass : facade);
    level.position.y = 0.62 + index * 0.35;
    level.rotation.y = index * 0.035;
    group.add(level);

    const slab = box(2.04 - taper, 0.055, 1.74 - taper, frame);
    slab.position.y = 0.8 + index * 0.35;
    slab.rotation.y = level.rotation.y;
    group.add(slab);
  }

  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < params.panelDensity + 2; index += 1) {
      const fin = box(0.045, levels * 0.18, 0.045, frame);
      fin.position.set(-0.78 + index * 0.32, 1.8, side * 0.88);
      group.add(fin);
    }
  }

  if (params.complexity >= 4) {
    const skyBridge = box(1.35, 0.18, 0.38, glass);
    skyBridge.position.set(1.28, 2.65, 0);
    group.add(skyBridge);

    const sideTower = box(0.7, 2.1, 0.78, facade);
    sideTower.position.set(2.05, 1.55, 0);
    group.add(sideTower);
  }

  const crown = cylinder(0.34, 0.72, 0.5, frame, 8);
  crown.position.y = 0.88 + levels * 0.35;
  group.add(crown);
  return group;
}

function createAircraftModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const accent = createMaterial(params.accentColor, 'anodized-metal');
  const secondary = createMaterial(params.secondaryColor, 'brushed-metal');

  const core = sphere(0.58, shell);
  core.scale.set(1.65, 0.52, 1.0);
  core.position.y = 1.18;
  group.add(core);

  const spine = box(2.3, 0.16, 0.22, accent);
  spine.position.y = 1.28;
  group.add(spine);

  const arms: Array<[number, number]> = [
    [1.72, 0],
    [-1.72, 0],
    [0, 1.72],
    [0, -1.72],
  ];

  arms.forEach(([x, z]) => {
    const arm = box(Math.abs(x) > 0 ? 2.55 : 0.18, 0.13, Math.abs(z) > 0 ? 2.55 : 0.18, accent);
    arm.position.set(0, 1.12, 0);
    group.add(arm);

    const motor = cylinder(0.24, 0.28, 0.24, secondary, 32);
    motor.position.set(x, 1.16, z);
    group.add(motor);

    const rotor = cylinder(0.62, 0.62, 0.045, shell, 64);
    rotor.position.set(x, 1.32, z);
    group.add(rotor);

    if (params.complexity >= 4) {
      const guard = cylinder(0.75, 0.75, 0.035, accent, 64);
      guard.position.set(x, 1.31, z);
      group.add(guard);
    }
  });

  addSymmetricBox(group, 0.12, 0.42, 0.88, secondary, -0.8, 0.62, 0.48);
  addSymmetricBox(group, 0.12, 0.42, 0.88, secondary, 0.8, 0.62, 0.48);

  for (let index = 0; index < params.panelDensity; index += 1) {
    const sensor = box(0.18, 0.08, 0.08, secondary);
    sensor.position.set(-0.65 + index * 0.32, 1.58, 0.52);
    group.add(sensor);
  }

  return group;
}

function createFurnitureModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const surface = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const soft = createMaterial(params.secondaryColor, 'matte-polymer');

  const seat = box(2.05, 0.24, 1.58, surface);
  seat.position.y = 0.92;
  group.add(seat);

  const cushion = box(1.82, 0.18, 1.34, soft);
  cushion.position.y = 1.14;
  group.add(cushion);

  const back = box(2.05, 1.45, 0.22, surface);
  back.position.set(0, 1.64, -0.68);
  back.rotation.x = -0.16;
  group.add(back);

  const backBridge = connectorBetween(new THREE.Vector3(0, 1.1, -0.56), new THREE.Vector3(0, 1.42, -0.72), 0.09, frame);
  backBridge.rotation.z = Math.PI / 2;
  group.add(backBridge);

  const headrest = box(1.35, 0.34, 0.22, soft);
  headrest.position.set(0, 2.42, -0.78);
  headrest.rotation.x = -0.16;
  group.add(headrest);

  [-0.82, 0.82].forEach((x) => {
    [-0.58, 0.58].forEach((z) => {
      const leg = cylinder(0.06, 0.08, 0.9, frame, 20);
      leg.position.set(x, 0.46, z);
      group.add(leg);
    });
  });

  addSymmetricBox(group, 0.18, 0.42, 1.34, frame, 1.12, 1.25, 0);
  addSymmetricBox(group, 0.18, 0.42, 1.34, frame, -1.12, 1.25, 0);

  for (let index = 0; index < params.panelDensity; index += 1) {
    const stitch = box(1.42, 0.025, 0.035, frame);
    stitch.position.set(0, 1.26, -0.48 + index * 0.18);
    group.add(stitch);
  }

  return group;
}

function createPropModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const secondary = createMaterial(params.secondaryColor, 'brushed-metal');

  const base = cylinder(1.05, 1.22, 0.34, frame, 12);
  base.position.y = 0.18;
  group.add(base);

  const lowerRing = cylinder(0.82, 0.92, 0.16, secondary, 32);
  lowerRing.position.y = 0.48;
  group.add(lowerRing);

  const column = cylinder(0.25, 0.34, 1.76, shell, 48);
  column.position.y = 1.36;
  group.add(column);

  for (let index = 0; index < params.panelDensity + 2; index += 1) {
    const blade = box(0.08, 1.46, 0.2, frame);
    blade.position.y = 1.36;
    blade.rotation.y = (Math.PI * 2 * index) / (params.panelDensity + 2);
    blade.position.x = Math.cos(blade.rotation.y) * 0.34;
    blade.position.z = Math.sin(blade.rotation.y) * 0.34;
    group.add(blade);
  }

  const core = sphere(0.48, shell);
  core.position.y = 2.32;
  group.add(core);

  const cap = cylinder(0.62, 0.42, 0.26, frame, 10);
  cap.position.y = 2.78;
  group.add(cap);

  if (params.complexity >= 4) {
    const display = box(0.92, 0.16, 0.08, secondary);
    display.position.set(0, 2.28, 0.5);
    group.add(display);
  }

  return group;
}

function createWatchModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const caseMaterial = createMaterial(params.bodyColor, params.materialPreset);
  const bezelMaterial = createMaterial(params.accentColor, 'anodized-metal');
  const dialMaterial = createMaterial(params.secondaryColor, 'ceramic');
  const darkMaterial = createMaterial('#080808', 'matte-polymer');

  const caseBody = cylinder(1.05, 1.05, 0.28, caseMaterial, 96);
  caseBody.rotation.x = Math.PI / 2;
  caseBody.position.y = 1.05;
  group.add(caseBody);

  const bezel = torus(1.04, 0.085, bezelMaterial, 18, 96);
  bezel.position.y = 1.05;
  group.add(bezel);

  const dial = cylinder(0.86, 0.86, 0.06, dialMaterial, 96);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 1.05, 0.16);
  group.add(dial);

  const innerRing = torus(0.72, 0.015, bezelMaterial, 8, 80);
  innerRing.position.set(0, 1.05, 0.2);
  group.add(innerRing);

  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12;
    const marker = box(index % 3 === 0 ? 0.06 : 0.035, 0.18, 0.025, bezelMaterial);
    marker.position.set(Math.sin(angle) * 0.64, 1.05 + Math.cos(angle) * 0.64, 0.22);
    marker.rotation.z = -angle;
    group.add(marker);
  }

  const hourHand = box(0.08, 0.42, 0.025, bezelMaterial);
  hourHand.position.set(0.1, 1.22, 0.24);
  hourHand.rotation.z = -0.48;
  group.add(hourHand);

  const minuteHand = box(0.05, 0.58, 0.02, darkMaterial);
  minuteHand.position.set(0.18, 0.88, 0.245);
  minuteHand.rotation.z = 0.72;
  group.add(minuteHand);

  const crown = cylinder(0.12, 0.12, 0.22, bezelMaterial, 32);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(1.18, 1.05, 0);
  group.add(crown);

  [-1, 1].forEach((side) => {
    const lug = box(0.42, 0.22, 0.18, bezelMaterial);
    lug.position.set(0, 1.05 + side * 1.1, 0.02);
    group.add(lug);

    const strapBridge = connectorBetween(new THREE.Vector3(0, 1.05 + side * 1.02, 0.02), new THREE.Vector3(0, 1.05 + side * 1.24, -0.02), 0.08, bezelMaterial);
    group.add(strapBridge);

    const strap = box(0.88, 1.28, 0.12, darkMaterial);
    strap.position.set(0, 1.05 + side * 1.82, -0.02);
    group.add(strap);

    for (let index = 0; index < params.panelDensity + 1; index += 1) {
      const link = box(0.96, 0.045, 0.135, bezelMaterial);
      link.position.set(0, 1.05 + side * (1.26 + index * 0.22), 0.05);
      group.add(link);
    }
  });

  if (params.complexity >= 4) {
    const subDialLeft = cylinder(0.18, 0.18, 0.025, darkMaterial, 48);
    subDialLeft.rotation.x = Math.PI / 2;
    subDialLeft.position.set(-0.34, 1.05, 0.25);
    group.add(subDialLeft);

    const subDialRight = subDialLeft.clone();
    subDialRight.position.x = 0.34;
    group.add(subDialRight);
  }

  return group;
}

function createJewelryModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const metal = createMaterial(params.bodyColor, params.materialPreset);
  const accent = createMaterial(params.accentColor, 'anodized-metal');
  const gem = createMaterial(params.secondaryColor, 'ceramic');
  const beadCount = 18 + params.panelDensity * 2;

  for (let index = 0; index < beadCount; index += 1) {
    const angle = Math.PI * 0.18 + (Math.PI * 0.64 * index) / Math.max(1, beadCount - 1);
    const x = Math.cos(angle) * 1.55;
    const y = 1.62 - Math.sin(angle) * 1.06;
    const bead = torus(0.11, 0.025, metal, 8, 24);
    bead.position.set(x, y, 0);
    bead.rotation.z = angle;
    group.add(bead);
  }

  const pendantFrame = torus(0.42, 0.04, accent, 12, 72);
  pendantFrame.position.set(0, 0.58, 0);
  group.add(pendantFrame);

  const pendantCore = sphere(0.3, gem);
  pendantCore.scale.set(0.82, 1.05, 0.18);
  pendantCore.position.set(0, 0.58, 0.04);
  group.add(pendantCore);

  const connector = cylinder(0.055, 0.055, 0.34, accent, 24);
  connector.position.set(0, 0.94, 0);
  group.add(connector);

  for (let index = 0; index < params.detailLevel + 2; index += 1) {
    const ray = box(0.035, 0.42, 0.025, accent);
    ray.position.set(0, 0.58, 0.08);
    ray.rotation.z = (Math.PI * 2 * index) / (params.detailLevel + 2);
    group.add(ray);
  }

  if (params.complexity >= 4) {
    [-1, 1].forEach((side) => {
      const sideGem = sphere(0.12, gem);
      sideGem.scale.set(1, 1, 0.35);
      sideGem.position.set(side * 0.38, 0.72, 0.08);
      group.add(sideGem);
    });
  }

  return group;
}

function hasProductKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function createProductModel(params: ReturnType<typeof resolveParams>, category = 'product') {
  const rawCategory = String(category).trim().toLowerCase();
  const value = `${category} ${params.silhouette}`.toLowerCase();

  if (rawCategory === 'product' || hasProductKeyword(value, ['收音机', '复古收音机', '智能收音机', 'radio', 'portable radio', 'speaker radio'])) {
    return createRadioProductModel(params);
  }

  if (hasProductKeyword(value, ['镜子', '化妆镜', '穿衣镜', '全身镜', '浴室镜', '智能镜', 'mirror', 'vanity mirror', 'standing mirror'])) {
    return createMirrorProductModel(params);
  }

  if (hasProductKeyword(value, ['飞机', '客机', '战斗机', '喷气机', 'plane', 'airplane', 'jet'])) {
    return createPlaneProductModel(params);
  }

  if (hasProductKeyword(value, ['耳机', '头戴耳机', 'headphone', 'earphone'])) {
    return createHeadphoneProductModel(params);
  }

  if (hasProductKeyword(value, ['相机', '摄像机', 'camera'])) {
    return createCameraProductModel(params);
  }

  if (hasProductKeyword(value, ['鞋子', '运动鞋', 'shoe', 'sneaker'])) {
    return createShoeProductModel(params);
  }

  if (hasProductKeyword(value, ['背包', '手提包', '包', 'bag', 'backpack'])) {
    return createBagProductModel(params);
  }

  if (hasProductKeyword(value, ['台灯', '咖啡机', '吹风机', '小家电', 'lamp', 'coffee', 'appliance'])) {
    return createApplianceProductModel(params);
  }

  if (hasProductKeyword(value, ['花瓶', '瓶子', '杯子', '水杯', 'vase', 'bottle', 'cup'])) {
    return createVesselProductModel(params);
  }

  if (hasProductKeyword(value, ['机器人', '玩具', '头盔', 'robot', 'toy', 'helmet'])) {
    return createCharacterProductModel(params);
  }

  if (hasProductKeyword(value, ['手机', '平板', '电脑', 'phone', 'tablet', 'computer'])) {
    return createPanelProductModel(params);
  }

  return createAdaptiveOpenProductModel(params, category);
}

function createRadioProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const trim = createMaterial(params.accentColor, 'anodized-metal');
  const grille = createMaterial(params.secondaryColor, 'brushed-metal');
  const glass = createMaterial('#1f2937', 'glass');
  const warm = createMaterial('#f7c873', 'ceramic');

  const cabinet = box(2.7, 1.42, 0.82, shell, 0.16);
  cabinet.position.y = 1.08;
  group.add(cabinet);

  const rearShell = box(2.42, 1.18, 0.18, trim, 0.12);
  rearShell.position.set(0, 1.08, -0.43);
  group.add(rearShell);

  const facePlate = box(2.38, 1.12, 0.08, trim, 0.1);
  facePlate.position.set(0, 1.08, 0.46);
  group.add(facePlate);

  const speakerPanel = box(1.14, 0.82, 0.05, grille, 0.08);
  speakerPanel.position.set(-0.54, 1.08, 0.53);
  group.add(speakerPanel);

  for (let index = 0; index < 7; index += 1) {
    const slat = box(0.9, 0.026, 0.035, shell, 0.012);
    slat.position.set(-0.54, 0.77 + index * 0.1, 0.59);
    group.add(slat);
  }

  const display = box(0.78, 0.26, 0.045, glass, 0.04);
  display.position.set(0.72, 1.34, 0.55);
  group.add(display);

  const tunerLine = box(0.62, 0.018, 0.025, warm, 0.01);
  tunerLine.position.set(0.72, 1.34, 0.59);
  group.add(tunerLine);

  const dial = cylinder(0.22, 0.22, 0.08, trim, 48);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.52, 0.94, 0.58);
  group.add(dial);

  const volume = cylinder(0.16, 0.16, 0.07, grille, 40);
  volume.rotation.x = Math.PI / 2;
  volume.position.set(1.02, 0.94, 0.58);
  group.add(volume);

  const handle = torus(0.72, 0.045, trim, 12, 72);
  handle.scale.set(1, 0.42, 0.16);
  handle.position.set(0, 1.88, -0.02);
  group.add(handle);

  const base = box(2.2, 0.12, 0.68, trim, 0.05);
  base.position.y = 0.34;
  group.add(base);

  [-1, 1].forEach((side) => {
    const foot = box(0.32, 0.12, 0.22, grille, 0.035);
    foot.position.set(side * 0.86, 0.2, 0.12);
    group.add(foot);
  });

  return group;
}

function createAdaptiveOpenProductModel(params: ReturnType<typeof resolveParams>, category: string) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const secondary = createMaterial(params.secondaryColor, 'brushed-metal');
  const seed = params.variantSeed + category.length * 17;
  const variant = seed % 4;

  if (variant === 0) {
    const core = sphere(1, shell);
    core.scale.set(0.92, 1.2, 0.52);
    core.position.y = 1.25;
    group.add(core);

    const waist = torus(0.72, 0.045, frame, 12, 80);
    waist.scale.set(1, 0.22, 0.72);
    waist.position.y = 1.28;
    group.add(waist);
  } else if (variant === 1) {
    const tower = cylinder(0.42, 0.72, 1.85, shell, 64);
    tower.position.y = 1.18;
    group.add(tower);

    const cap = sphere(0.54, secondary);
    cap.scale.set(1, 0.32, 1);
    cap.position.y = 2.18;
    group.add(cap);
  } else if (variant === 2) {
    const ring = torus(0.82, 0.09, shell, 16, 96);
    ring.scale.set(1, 1.2, 0.32);
    ring.position.y = 1.32;
    group.add(ring);

    const core = sphere(0.38, secondary);
    core.position.y = 1.32;
    group.add(core);
  } else {
    const base = cylinder(0.74, 0.92, 0.32, frame, 64);
    base.position.y = 0.32;
    group.add(base);

    const shellTop = sphere(0.88, shell);
    shellTop.scale.set(1, 0.72, 0.82);
    shellTop.position.y = 1.08;
    group.add(shellTop);
  }

  const ribCount = Math.min(3, Math.max(1, params.panelDensity));
  for (let index = 0; index < ribCount; index += 1) {
    const angle = (Math.PI * 2 * index) / ribCount;
    const rib = box(0.035, 0.82, 0.055, frame);
    rib.position.set(Math.cos(angle) * 0.6, 1.14, Math.sin(angle) * 0.6);
    rib.rotation.y = -angle;
    group.add(rib);
  }

  return group;
}

function createVesselProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'ceramic');

  const body = sphere(1, shell);
  body.scale.set(0.72, 1.18, 0.72);
  body.position.y = 1.08;
  group.add(body);

  const neck = cylinder(0.28, 0.42, 0.88, shell, 64);
  neck.position.y = 2.02;
  group.add(neck);

  const lip = torus(0.34, 0.045, frame, 12, 80);
  lip.position.y = 2.46;
  group.add(lip);

  const foot = cylinder(0.5, 0.62, 0.18, frame, 64);
  foot.position.y = 0.18;
  group.add(foot);

  return group;
}

function createCharacterProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const secondary = createMaterial(params.secondaryColor, 'ceramic');

  const body = sphere(0.72, shell);
  body.scale.set(0.72, 1.08, 0.46);
  body.position.y = 1.08;
  group.add(body);

  const head = sphere(0.42, secondary);
  head.position.y = 2.08;
  group.add(head);

  [-1, 1].forEach((side) => {
    const arm = connectorBetween(new THREE.Vector3(side * 0.42, 1.32, 0), new THREE.Vector3(side * 0.86, 0.86, 0), 0.08, frame);
    group.add(arm);

    const leg = connectorBetween(new THREE.Vector3(side * 0.24, 0.42, 0), new THREE.Vector3(side * 0.42, 0.05, 0), 0.09, frame);
    group.add(leg);
  });

  return group;
}

function createPanelProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const glass = createMaterial(params.secondaryColor, 'glass');

  const body = box(1.24, 2.1, 0.12, shell, 0.14);
  body.position.y = 1.24;
  group.add(body);

  const screen = box(1.02, 1.78, 0.035, glass, 0.09);
  screen.position.set(0, 1.28, 0.09);
  group.add(screen);

  const stand = connectorBetween(new THREE.Vector3(0, 0.2, -0.06), new THREE.Vector3(0, 0.78, -0.02), 0.055, frame);
  group.add(stand);

  return group;
}

function createMirrorProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const frame = createMaterial(params.bodyColor, params.frameStyle.includes('ceramic') ? 'ceramic' : 'anodized-metal');
  const edge = createMaterial(params.accentColor, 'brushed-metal');
  const backing = createMaterial(params.secondaryColor, 'matte-polymer');
  const mirror = createMirrorMaterial('#dbeafe', params.reflectionOpacity);
  const seedOffset = seededRandom(params.variantSeed + 17);
  const isTall = params.mirrorVariant === 'freestanding' || params.mirrorVariant === 'standing mirror' || params.mirrorVariant.includes('standing');
  const width = isTall ? 1.28 + seedOffset * 0.18 : 1.86 + seedOffset * 0.24;
  const height = isTall ? 2.72 : 1.72 + seedOffset * 0.2;
  const radiusDetail = params.frameStyle.includes('ornate') ? 0.08 : 0.045;

  const backPlate = box(width + 0.34, height + 0.34, 0.12, backing);
  backPlate.position.y = 1.38;
  group.add(backPlate);

  const glassPanel = box(width, height, 0.045, mirror);
  glassPanel.position.set(0, 1.38, 0.09);
  group.add(glassPanel);

  const topFrame = box(width + 0.34, 0.14, 0.18, frame);
  topFrame.position.set(0, 1.38 + height / 2 + 0.12, 0.13);
  group.add(topFrame);

  const bottomFrame = topFrame.clone();
  bottomFrame.position.y = 1.38 - height / 2 - 0.12;
  group.add(bottomFrame);

  [-1, 1].forEach((side) => {
    const verticalFrame = box(0.14, height + 0.2, 0.18, frame);
    verticalFrame.position.set(side * (width / 2 + 0.12), 1.38, 0.13);
    group.add(verticalFrame);
  });

  const innerHighlight = torus(Math.min(width, height) * 0.36, radiusDetail, edge, 10, 96);
  innerHighlight.scale.set(width / Math.min(width, height), height / Math.min(width, height), 0.05);
  innerHighlight.position.set(0, 1.38, 0.18);
  group.add(innerHighlight);

  if (params.mirrorVariant === 'smart-panel') {
    const displayBar = box(width * 0.56, 0.08, 0.035, edge);
    displayBar.position.set(0, 1.38 - height * 0.36, 0.23);
    group.add(displayBar);
  }

  if (isTall) {
    const stand = box(0.16, 1.1, 0.14, edge);
    stand.position.set(0, 0.16, -0.2);
    stand.rotation.x = -0.16;
    group.add(stand);

    const foot = box(1.2, 0.1, 0.72, edge);
    foot.position.set(0, -0.42, -0.32);
    group.add(foot);
  } else {
    const wallMount = box(width * 0.7, 0.1, 0.16, edge);
    wallMount.position.set(0, 0.36, -0.08);
    group.add(wallMount);
  }

  for (let index = 0; index < params.panelDensity + 4; index += 1) {
    const angle = (Math.PI * 2 * index) / (params.panelDensity + 4);
    const screw = cylinder(0.035, 0.035, 0.018, edge, 24);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(Math.cos(angle) * (width / 2 + 0.05), 1.38 + Math.sin(angle) * (height / 2 + 0.05), 0.25);
    group.add(screw);
  }

  if (params.complexity >= 4) {
    [-1, 1].forEach((side) => {
      const lightStrip = box(0.035, height * 0.78, 0.03, createMaterial('#f8fafc', 'glass'));
      lightStrip.position.set(side * (width / 2 - 0.08), 1.38, 0.26);
      group.add(lightStrip);
    });
  }

  return group;
}

function createPlaneProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const glass = createMaterial(params.secondaryColor, 'glass');

  const fuselage = sphere(1, shell);
  fuselage.scale.set(2.45, 0.34, 0.34);
  fuselage.position.y = 1.06;
  group.add(fuselage);

  const nose = cylinder(0.08, 0.36, 0.58, shell, 32);
  nose.rotation.z = Math.PI / 2;
  nose.position.set(2.48, 1.06, 0);
  group.add(nose);

  const cockpit = sphere(0.32, glass);
  cockpit.scale.set(1.18, 0.42, 0.7);
  cockpit.position.set(0.9, 1.3, 0);
  cockpit.rotation.z = -0.12;
  group.add(cockpit);

  const mainWing = box(1.34, 0.08, 3.5, frame);
  mainWing.position.set(0.05, 0.98, 0);
  mainWing.rotation.z = -0.05;
  group.add(mainWing);

  const wingRootFairing = sphere(0.34, shell);
  wingRootFairing.scale.set(1.4, 0.18, 1.75);
  wingRootFairing.position.set(0.05, 1.0, 0);
  group.add(wingRootFairing);

  const tailWing = box(0.72, 0.06, 1.5, frame);
  tailWing.position.set(-1.92, 1.08, 0);
  tailWing.rotation.z = 0.08;
  group.add(tailWing);

  const verticalTail = box(0.16, 0.82, 0.08, frame);
  verticalTail.position.set(-2.06, 1.48, 0);
  verticalTail.rotation.z = -0.22;
  group.add(verticalTail);

  [-1, 1].forEach((side) => {
    const engine = cylinder(0.16, 0.18, 0.34, frame, 32);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(0.24, 0.78, side * 0.98);
    group.add(engine);

    const pylon = connectorBetween(new THREE.Vector3(0.22, 0.96, side * 0.74), new THREE.Vector3(0.24, 0.82, side * 0.98), 0.035, frame);
    group.add(pylon);
  });

  for (let index = 0; index < params.panelDensity + 3; index += 1) {
    const window = box(0.08, 0.055, 0.025, glass);
    window.position.set(1.15 - index * 0.28, 1.24, 0.31);
    group.add(window);

    const oppositeWindow = window.clone();
    oppositeWindow.position.z = -0.31;
    group.add(oppositeWindow);
  }

  return group;
}

function createHeadphoneProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const soft = createMaterial(params.secondaryColor, 'matte-polymer');

  const headband = torus(1.15, 0.055, frame, 16, 96);
  headband.scale.set(0.82, 1, 0.18);
  headband.position.y = 1.36;
  group.add(headband);

  [-1, 1].forEach((side) => {
    const cup = cylinder(0.45, 0.52, 0.34, shell, 64);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * 0.92, 0.92, 0);
    group.add(cup);

    const cushion = torus(0.42, 0.055, soft, 16, 72);
    cushion.position.set(side * 0.92, 0.92, side * 0.08);
    group.add(cushion);

    const hinge = box(0.14, 0.46, 0.18, frame);
    hinge.position.set(side * 0.78, 1.22, 0);
    hinge.rotation.z = side * 0.18;
    group.add(hinge);
  });

  return group;
}

function createCameraProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const glass = createMaterial(params.secondaryColor, 'glass');

  const body = box(2.3, 1.2, 0.72, shell);
  body.position.y = 1.05;
  group.add(body);

  const grip = box(0.42, 1.3, 0.82, frame);
  grip.position.set(1.08, 1.0, 0);
  group.add(grip);

  const lens = cylinder(0.46, 0.58, 0.62, glass, 72);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(-0.2, 1.05, 0.62);
  group.add(lens);

  const lensRing = torus(0.6, 0.045, frame, 12, 80);
  lensRing.position.set(-0.2, 1.05, 0.94);
  group.add(lensRing);

  for (let index = 0; index < params.panelDensity + 1; index += 1) {
    const button = cylinder(0.08, 0.08, 0.08, frame, 24);
    button.position.set(-0.8 + index * 0.22, 1.72, 0.02);
    group.add(button);
  }

  return group;
}

function createShoeProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const upper = createMaterial(params.bodyColor, params.materialPreset);
  const soleMaterial = createMaterial(params.accentColor, 'matte-polymer');
  const laceMaterial = createMaterial(params.secondaryColor, 'brushed-metal');

  const sole = box(2.7, 0.22, 0.9, soleMaterial);
  sole.position.set(0.15, 0.42, 0);
  sole.rotation.z = -0.04;
  group.add(sole);

  const toe = sphere(1, upper);
  toe.scale.set(0.9, 0.34, 0.42);
  toe.position.set(0.86, 0.72, 0);
  group.add(toe);

  const heel = box(1.05, 0.66, 0.86, upper);
  heel.position.set(-0.72, 0.82, 0);
  heel.rotation.z = 0.12;
  group.add(heel);

  for (let index = 0; index < params.panelDensity + 3; index += 1) {
    const lace = box(0.7, 0.025, 0.035, laceMaterial);
    lace.position.set(-0.18 + index * 0.16, 1.16, 0.18);
    lace.rotation.z = -0.3;
    group.add(lace);
  }

  return group;
}

function createBagProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const secondary = createMaterial(params.secondaryColor, 'brushed-metal');

  const body = box(1.7, 1.45, 0.72, shell);
  body.position.y = 0.98;
  group.add(body);

  const flap = box(1.78, 0.42, 0.08, secondary);
  flap.position.set(0, 1.38, 0.42);
  flap.rotation.x = -0.16;
  group.add(flap);

  const handle = torus(0.58, 0.045, frame, 12, 72);
  handle.scale.set(1, 0.52, 0.18);
  handle.position.y = 1.84;
  group.add(handle);

  [-1, 1].forEach((side) => {
    const strap = box(0.09, 1.32, 0.08, frame);
    strap.position.set(side * 0.58, 0.98, 0.44);
    group.add(strap);
  });

  return group;
}

function createApplianceProductModel(params: ReturnType<typeof resolveParams>) {
  const group = new THREE.Group();
  const shell = createMaterial(params.bodyColor, params.materialPreset);
  const frame = createMaterial(params.accentColor, 'anodized-metal');
  const secondary = createMaterial(params.secondaryColor, 'ceramic');

  const base = box(1.5, 0.2, 1.08, frame);
  base.position.y = 0.42;
  group.add(base);

  const tower = cylinder(0.55, 0.72, 1.45, shell, 48);
  tower.position.y = 1.18;
  group.add(tower);

  const panel = box(0.72, 0.46, 0.06, secondary);
  panel.position.set(0, 1.26, 0.62);
  group.add(panel);

  for (let index = 0; index < params.panelDensity + 2; index += 1) {
    const vent = box(0.82, 0.025, 0.035, frame);
    vent.position.set(0, 0.78 + index * 0.12, 0.67);
    group.add(vent);
  }

  const cap = cylinder(0.42, 0.5, 0.22, frame, 48);
  cap.position.y = 2.02;
  group.add(cap);

  return group;
}
