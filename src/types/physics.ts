export type SimulationId =
  | 'gravity'
  | 'fluid'
  | 'elements'
  | 'electromagnetism'
  | 'chaos'
  | 'optics'
  | 'collision'
  | 'spacetime'
  | 'windtunnel'
  | 'molecular'
  | 'playground';

export type SimulationCategory =
  | 'All'
  | 'Space & Gravity'
  | 'Fluid Dynamics'
  | 'Electromagnetism'
  | 'Mechanics'
  | 'Optics'
  | 'Molecular Physics';

export type NavRoute =
  | { view: 'home' }
  | { view: 'catalog'; category: SimulationCategory }
  | { view: 'sim'; simId: SimulationId; experimentId?: string; presetId?: string }
  | { view: 'builder' }
  | { view: 'saved' }
  | { view: 'learn' }
  | { view: 'settings' }
  | { view: 'privacy' }
  | { view: 'terms' };

export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface EquationSpec {
  label: string;
  formula: string;
  variables: { symbol: string; name: string; unit: string }[];
}

export interface SimulationMeta {
  id: SimulationId;
  title: string;
  shortTitle: string;
  category: Exclude<SimulationCategory, 'All'>;
  engineLabel: string;
  difficulty: DifficultyLevel;
  summary: string;
  modelNote: string;
  accentHex: string;
  featured?: boolean;
  equations: EquationSpec[];
  metricsDescription: string[];
}

export interface TelemetryMetric {
  id: string;
  label: string;
  value: string;
  unit: string;
  tone?: 'neutral' | 'cyan' | 'amber' | 'emerald' | 'rose';
}

export interface TelemetrySeriesPoint {
  t: number;
  [key: string]: number;
}

export interface SavedExperiment {
  id: string;
  name: string;
  simId: SimulationId;
  notes: string;
  createdAt: string;
  updatedAt: string;
  params: Record<string, unknown>;
  objects?: unknown[];
}

export interface AppSettings {
  unitSystem: 'SI' | 'Scaled';
  targetFps: 60 | 30;
  showModelNotes: boolean;
  reducedMotion: boolean;
  highDpiCanvas: boolean;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LearnModule {
  id: string;
  title: string;
  category: Exclude<SimulationCategory, 'All'>;
  difficulty: DifficultyLevel;
  simId: SimulationId;
  presetId?: string;
  overview: string;
  formula: string;
  variables: { symbol: string; description: string; unit: string }[];
  guidedSteps: string[];
  realWorldApplications: string[];
  quiz: QuizQuestion[];
}
