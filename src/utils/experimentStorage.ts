import { AppSettings, SavedExperiment, SimulationId } from '../types/physics';

const SAVED_EXPERIMENTS_KEY = 'physix_lab_saved_experiments_v1';
const RECENT_SIMS_KEY = 'physix_lab_recent_sims_v1';
const SETTINGS_KEY = 'physix_lab_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  unitSystem: 'SI',
  targetFps: 60,
  showModelNotes: true,
  reducedMotion: false,
  highDpiCanvas: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export function loadSavedExperiments(): SavedExperiment[] {
  try {
    const raw = localStorage.getItem(SAVED_EXPERIMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveExperimentRecord(exp: Omit<SavedExperiment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): SavedExperiment {
  const existing = loadSavedExperiments();
  const now = new Date().toISOString();

  if (exp.id) {
    const idx = existing.findIndex((item) => item.id === exp.id);
    if (idx >= 0) {
      const updated: SavedExperiment = {
        ...existing[idx],
        ...exp,
        id: exp.id,
        updatedAt: now,
      };
      const next = [...existing];
      next[idx] = updated;
      localStorage.setItem(SAVED_EXPERIMENTS_KEY, JSON.stringify(next));
      return updated;
    }
  }

  const created: SavedExperiment = {
    id: `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: exp.name.trim() || 'Untitled Experiment',
    simId: exp.simId,
    notes: exp.notes || '',
    createdAt: now,
    updatedAt: now,
    params: exp.params || {},
    objects: exp.objects,
  };
  localStorage.setItem(SAVED_EXPERIMENTS_KEY, JSON.stringify([created, ...existing]));
  return created;
}

export function duplicateExperimentRecord(id: string): SavedExperiment | null {
  const existing = loadSavedExperiments();
  const target = existing.find((item) => item.id === id);
  if (!target) return null;
  return saveExperimentRecord({
    name: `${target.name} (Copy)`,
    simId: target.simId,
    notes: target.notes,
    params: structuredClone(target.params),
    objects: target.objects ? structuredClone(target.objects) : undefined,
  });
}

export function deleteExperimentRecord(id: string): void {
  const existing = loadSavedExperiments();
  const next = existing.filter((item) => item.id !== id);
  localStorage.setItem(SAVED_EXPERIMENTS_KEY, JSON.stringify(next));
}

export function clearAllSavedExperiments(): void {
  localStorage.removeItem(SAVED_EXPERIMENTS_KEY);
  localStorage.removeItem(RECENT_SIMS_KEY);
}

export function getRecentSimulations(): { simId: SimulationId; openedAt: string }[] {
  try {
    const raw = localStorage.getItem(RECENT_SIMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordRecentSimulation(simId: SimulationId): void {
  try {
    const prev = getRecentSimulations().filter((item) => item.simId !== simId);
    const next = [{ simId, openedAt: new Date().toISOString() }, ...prev].slice(0, 6);
    localStorage.setItem(RECENT_SIMS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function exportExperimentAsJson(exp: {
  name: string;
  simId: SimulationId;
  notes?: string;
  params: Record<string, unknown>;
  objects?: unknown[];
}): void {
  const payload = {
    schema: 'physix-lab-experiment-v1',
    exportedAt: new Date().toISOString(),
    ...exp,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${exp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'experiment'}.physix.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const VALID_SIM_IDS: SimulationId[] = [
  'gravity',
  'fluid',
  'elements',
  'electromagnetism',
  'chaos',
  'optics',
  'collision',
  'spacetime',
  'windtunnel',
  'molecular',
  'playground',
];

export function validateImportedExperimentJson(rawText: string): {
  valid: boolean;
  error?: string;
  data?: {
    name: string;
    simId: SimulationId;
    notes: string;
    params: Record<string, unknown>;
    objects?: unknown[];
  };
} {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Configuration must be a JSON object.' };
    }
    if (!VALID_SIM_IDS.includes(parsed.simId)) {
      return { valid: false, error: `Unknown simulation ID: ${String(parsed.simId)}` };
    }
    if (parsed.params && typeof parsed.params !== 'object') {
      return { valid: false, error: 'Invalid params block in JSON configuration.' };
    }
    return {
      valid: true,
      data: {
        name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Imported Experiment',
        simId: parsed.simId,
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        params: (parsed.params as Record<string, unknown>) || {},
        objects: Array.isArray(parsed.objects) ? parsed.objects : undefined,
      },
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid JSON syntax.',
    };
  }
}

export function encodeShareableExperimentUrl(payload: {
  simId: SimulationId;
  name: string;
  params: Record<string, unknown>;
}): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = new URL(window.location.href);
  url.searchParams.set('sim', payload.simId);
  url.searchParams.set('cfg', encoded);
  return url.toString();
}

export function decodeSharedExperimentFromUrl(): {
  simId?: SimulationId;
  name?: string;
  params?: Record<string, unknown>;
} | null {
  try {
    const url = new URL(window.location.href);
    const sim = url.searchParams.get('sim') as SimulationId | null;
    const cfg = url.searchParams.get('cfg');
    if (cfg) {
      const padded = cfg.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((cfg.length + 3) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(json);
      if (parsed && VALID_SIM_IDS.includes(parsed.simId)) {
        return {
          simId: parsed.simId,
          name: parsed.name,
          params: parsed.params,
        };
      }
    }
    if (sim && VALID_SIM_IDS.includes(sim)) {
      return { simId: sim };
    }
    return null;
  } catch {
    return null;
  }
}

export function captureCanvasScreenshot(container: HTMLElement | null, filenamePrefix: string): boolean {
  if (!container) return false;
  const canvas = container.querySelector('canvas');
  if (!canvas) return false;
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${filenamePrefix}-${Date.now()}.png`;
    a.click();
    return true;
  } catch {
    return false;
  }
}
