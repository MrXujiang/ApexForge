import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ControlToolbar } from '@/modules/viewer/components/ControlToolbar';
import { createModelByCategory } from '@/modules/viewer/utils/modelFactory';
import { normalizeModel } from '@/modules/viewer/utils/modelNormalizer';
import type { GenerationStatus, ModelCategory, ModelGenerationParams } from '@/shared/types/generation';

interface ModelViewerProps {
  category: ModelCategory;
  generationId?: string;
  params?: ModelGenerationParams;
  status?: GenerationStatus;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

function dataUrlToArrayBuffer(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function dataUrlToText(dataUrl: string) {
  return new TextDecoder().decode(dataUrlToArrayBuffer(dataUrl));
}

async function loadImportedModel(params: ModelGenerationParams) {
  const dataUrl = params.importedModelDataUrl;
  if (!dataUrl) {
    return null;
  }

  const format = params.importedModelFormat ?? params.importedModelName?.split('.').pop()?.toLowerCase();
  const group = new THREE.Group();
  group.userData = { importedModelName: params.importedModelName };

  if (format === 'glb' || format === 'gltf') {
    const gltf = await new GLTFLoader().loadAsync(dataUrl);
    group.add(gltf.scene);
  } else if (format === 'obj') {
    group.add(new OBJLoader().parse(dataUrlToText(dataUrl)));
  } else if (format === 'stl') {
    const geometry = new STLLoader().parse(dataUrlToArrayBuffer(dataUrl));
    const material = new THREE.MeshPhysicalMaterial({ color: params.bodyColor ?? '#d4d4d8', metalness: 0.18, roughness: 0.46, clearcoat: 0.24 });
    group.add(new THREE.Mesh(geometry, material));
  } else {
    return null;
  }

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
}

function viewerParamsLabel(params?: ModelGenerationParams) {
  return params?.importedModelName ? '导入模型资产' : 'AI 参数化模型';
}

export function ModelViewer({ category, generationId, params, status = 'idle' }: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const frameRef = useRef<number | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [darkScene, setDarkScene] = useState(true);
  const [modelYOffset, setModelYOffset] = useState(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050505');

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(5, 4, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    const ambient = new THREE.AmbientLight('#ffffff', 0.42);
    scene.add(ambient);

    const hemisphere = new THREE.HemisphereLight('#f8fafc', '#111827', 0.85);
    scene.add(hemisphere);

    const key = new THREE.DirectionalLight('#ffffff', 2.45);
    key.position.set(4, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);

    const fill = new THREE.DirectionalLight('#b7c7ff', 0.92);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight('#ffffff', 1.35);
    rim.position.set(-3, 5, 6);
    scene.add(rim);

    const grid = new THREE.GridHelper(8, 16, '#525252', '#262626');
    grid.position.y = -0.02;
    scene.add(grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshPhysicalMaterial({ color: '#020202', roughness: 0.72, metalness: 0.05, clearcoat: 0.12 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    gridRef.current = grid;

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) {
        return;
      }

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameRef.current = window.requestAnimationFrame(animate);
    };

    animate();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
      controls.dispose();
      if (modelRef.current) {
        disposeObject(modelRef.current);
      }
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return undefined;
    }

    let cancelled = false;

    if (modelRef.current) {
      scene.remove(modelRef.current);
      disposeObject(modelRef.current);
      modelRef.current = null;
    }

    const addModelToScene = (rawModel: THREE.Group) => {
      if (cancelled) {
        disposeObject(rawModel);
        return;
      }

      const model = normalizeModel(rawModel);
      model.rotation.y = -0.35;
      model.position.y = modelYOffset;
      scene.add(model);
      modelRef.current = model;
    };

    if (params?.importedModelDataUrl) {
      loadImportedModel(params)
        .then((importedModel) => {
          addModelToScene(importedModel ?? createModelByCategory(category, params));
        })
        .catch(() => {
          addModelToScene(createModelByCategory(category, params));
        });
    } else {
      addModelToScene(createModelByCategory(category, params));
    }

    return () => {
      cancelled = true;
    };
  }, [category, generationId, params]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.visible = showGrid;
    }
  }, [showGrid]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(darkScene ? '#050505' : '#f4f4f5');
    }
  }, [darkScene]);

  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.position.y = modelYOffset;
    }
  }, [modelYOffset]);

  const resetCamera = () => {
    setModelYOffset(0);
    cameraRef.current?.position.set(5, 4, 6);
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
  };

  const isGenerating = ['queued', 'generating', 'validating'].includes(status);
  const loadingLabel = status === 'queued' ? '准备建模任务' : status === 'generating' ? 'AI 正在推导结构参数' : '校验并装配渲染资产';

  return (
    <div className="relative h-full min-h-[480px] overflow-hidden rounded-2xl border border-border bg-black">
      <ControlToolbar
        showGrid={showGrid}
        darkScene={darkScene}
        onReset={resetCamera}
        onMoveModelY={(delta) => setModelYOffset((value) => Math.min(2, Math.max(-2, value + delta)))}
        onToggleGrid={() => setShowGrid((value) => !value)}
        onToggleScene={() => setDarkScene((value) => !value)}
      />
      <div ref={mountRef} className="h-full min-h-[480px] w-full" />
      {isGenerating ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="flex w-[320px] flex-col items-center rounded-2xl border border-white/10 bg-black/80 p-6 text-center shadow-2xl">
            <div className="relative h-24 w-24">
              <div className="absolute inset-0 rounded-full border border-white/10" />
              <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-white/80" />
              <div className="absolute inset-8 rounded bg-white/80 shadow-[0_0_28px_rgba(255,255,255,0.35)]" />
            </div>
            <div className="mt-4 font-mono text-xs uppercase tracking-[0.22em] text-white/55">模型生成中</div>
            <div className="mt-2 text-sm font-medium text-white">{loadingLabel}</div>
            <div className="mt-2 text-xs leading-5 text-white/55">正在执行提示词优化、结构 Agent、材质 Agent 与渲染质检</div>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-white/70" />
            </div>
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-4 left-4 rounded border border-white/10 bg-black/70 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/70 backdrop-blur">
        视图 · {viewerParamsLabel(params)} · 垂直偏移 {modelYOffset.toFixed(2)}
      </div>
    </div>
  );
}
