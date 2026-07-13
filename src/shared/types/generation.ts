export type GenerationStatus = 'idle' | 'queued' | 'generating' | 'validating' | 'renderable' | 'failed';

export type ModelCategory = string;

export interface ModelMetrics {
  meshes: number;
  vertices: number;
  materials: number;
  score: number;
}

export interface ModelGenerationAgent {
  id: string;
  name: string;
  role: string;
  status: string;
  output: string;
}

export interface ModelGenerationSkill {
  id: string;
  name: string;
  description: string;
}

export interface ModelRenderProfile {
  lighting: string;
  materialPipeline: string;
  detailStrategy: string;
}

export interface ModelGenerationParams {
  bodyColor?: string;
  accentColor?: string;
  secondaryColor?: string;
  scale?: number;
  detailLevel?: number;
  complexity?: number;
  panelDensity?: number;
  materialPreset?: string;
  silhouette?: string;
  style?: string;
  provider?: string;
  variantSeed?: number;
  mirrorVariant?: string;
  frameStyle?: string;
  reflectionOpacity?: number;
  edgeStyle?: 'sharp' | 'soft' | 'chamfered' | 'filleted';
  chamferRadius?: number;
  connectorDensity?: number;
  curveIntensity?: number;
  smoothJoints?: boolean;
  mainTextureDataUrl?: string;
  textureName?: string;
  textureRepeatX?: number;
  textureRepeatY?: number;
  textureStrength?: number;
  importedModelDataUrl?: string;
  importedModelName?: string;
  importedModelFormat?: 'glb' | 'gltf' | 'obj' | 'stl';
  optimizedPrompt?: string;
  agents?: ModelGenerationAgent[];
  skillsApplied?: ModelGenerationSkill[];
  renderProfile?: ModelRenderProfile;
}

export interface GenerationResult {
  id: string;
  prompt: string;
  category: ModelCategory;
  templateId: string;
  status: GenerationStatus;
  createdAt: string;
  traceId: string;
  metrics: ModelMetrics;
  explanation: string;
  generatedCode?: string;
  generatedParams?: ModelGenerationParams;
  validationReport?: {
    passed: boolean;
    blockedReasons: string[];
    warnings: string[];
    complexity: Record<string, unknown>;
  } | null;
  qualityScore?: {
    totalScore: number;
    renderabilityScore: number;
    structureScore: number;
    promptMatchScore: number;
    performanceScore: number;
    details: Record<string, unknown>;
  } | null;
}

export interface GenerationProgress {
  status: GenerationStatus;
  label: string;
  percent: number;
}
