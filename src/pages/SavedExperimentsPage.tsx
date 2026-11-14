import React, { useState } from 'react';
import {
  Play,
  Copy,
  Download,
  Share2,
  Trash2,
  Upload,
  Plus,
  Check,
  AlertCircle,
} from 'lucide-react';
import { SIMULATION_MAP } from '../data/simulations';
import { NavRoute, SavedExperiment } from '../types/physics';
import {
  deleteExperimentRecord,
  duplicateExperimentRecord,
  encodeShareableExperimentUrl,
  exportExperimentAsJson,
  loadSavedExperiments,
  saveExperimentRecord,
  validateImportedExperimentJson,
} from '../utils/experimentStorage';

interface SavedExperimentsPageProps {
  onNavigate: (route: NavRoute) => void;
  onOpenSaved: (exp: SavedExperiment) => void;
}

export const SavedExperimentsPage: React.FC<SavedExperimentsPageProps> = ({
  onNavigate,
  onOpenSaved,
}) => {
  const [experiments, setExperiments] = useState<SavedExperiment[]>(() => loadSavedExperiments());
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const refresh = () => setExperiments(loadSavedExperiments());

  const handleDuplicate = (id: string) => {
    duplicateExperimentRecord(id);
    refresh();
    setStatus({ type: 'ok', text: 'Experiment duplicated.' });
  };

  const handleDelete = (id: string) => {
    deleteExperimentRecord(id);
    refresh();
    setStatus({ type: 'ok', text: 'Experiment removed from local storage.' });
  };

  const handleShare = async (exp: SavedExperiment) => {
    const url = encodeShareableExperimentUrl({
      simId: exp.simId,
      name: exp.name,
      params: exp.params,
    });
    try {
      await navigator.clipboard.writeText(url);
      setStatus({ type: 'ok', text: 'Shareable URL copied to clipboard.' });
    } catch {
      setStatus({ type: 'ok', text: `Share URL ready: ${url}` });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = validateImportedExperimentJson(text);
    if (!res.valid || !res.data) {
      setStatus({ type: 'err', text: res.error || 'Invalid JSON configuration.' });
      return;
    }
    saveExperimentRecord(res.data);
    refresh();
    setStatus({ type: 'ok', text: `Imported "${res.data.name}".` });
    e.target.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400">Local Laboratory Storage</div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">Saved Experiments</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="px-3 py-2 rounded-md border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Import JSON</span>
            <input type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
          </label>
          <button
            type="button"
            onClick={() => onNavigate({ view: 'builder' })}
            className="px-3.5 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Experiment</span>
          </button>
        </div>
      </div>

      {status && (
        <div
          className={`p-3 rounded-md border text-xs flex items-center gap-2 ${
            status.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {status.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="truncate">{status.text}</span>
        </div>
      )}

      {experiments.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-[#0A101D] p-10 text-center space-y-3">
          <h2 className="text-base font-semibold text-slate-200">No Saved Experiments Yet</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Save any active simulation from its top toolbar, build a custom trial in the Experiment
            Builder, or import a shared JSON configuration file.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate({ view: 'builder' })}
              className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold cursor-pointer"
            >
              Open Experiment Builder
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ view: 'catalog', category: 'All' })}
              className="px-4 py-2 rounded-md border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              Browse Simulators
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {experiments.map((exp) => {
            const meta = SIMULATION_MAP[exp.simId];
            return (
              <article
                key={exp.id}
                className="rounded-lg border border-slate-800 bg-[#0A101D] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{meta ? meta.title : exp.simId}</span>
                    <span className="font-mono text-[11px]">
                      {new Date(exp.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-slate-100">{exp.name}</h2>
                  {exp.notes && <p className="text-xs text-slate-400 leading-relaxed">{exp.notes}</p>}
                  <div className="p-2.5 rounded-md bg-[#070B14] border border-slate-800 font-mono text-[11px] text-slate-300 truncate">
                    {JSON.stringify(exp.params)}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenSaved(exp)}
                    className="px-3 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Reopen</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(exp.id)}
                      title="Duplicate experiment"
                      className="p-1.5 rounded-md border border-slate-800 hover:bg-slate-800 text-slate-300 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => exportExperimentAsJson(exp)}
                      title="Export JSON"
                      className="p-1.5 rounded-md border border-slate-800 hover:bg-slate-800 text-slate-300 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare(exp)}
                      title="Copy Share URL"
                      className="p-1.5 rounded-md border border-slate-800 hover:bg-slate-800 text-slate-300 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(exp.id)}
                      title="Delete experiment"
                      className="p-1.5 rounded-md border border-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
