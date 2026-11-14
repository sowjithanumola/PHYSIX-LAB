import React, { useState } from 'react';
import { Play, Save, Download, Share2, Upload, Check, AlertCircle } from 'lucide-react';
import { SIMULATIONS, SIMULATION_MAP } from '../data/simulations';
import { NavRoute, SimulationId } from '../types/physics';
import { SliderControl } from '../components/ui/LabControls';
import {
  encodeShareableExperimentUrl,
  exportExperimentAsJson,
  saveExperimentRecord,
  validateImportedExperimentJson,
} from '../utils/experimentStorage';

interface ExperimentBuilderPageProps {
  onNavigate: (route: NavRoute) => void;
  onLaunchCustom: (simId: SimulationId, params: Record<string, unknown>) => void;
}

export const ExperimentBuilderPage: React.FC<ExperimentBuilderPageProps> = ({
  onNavigate,
  onLaunchCustom,
}) => {
  const [name, setName] = useState('Custom Laboratory Trial');
  const [simId, setSimId] = useState<SimulationId>('gravity');
  const [notes, setNotes] = useState('');

  // Editable environment parameters mapped cleanly per environment
  const [speed, setSpeed] = useState(1.0);
  const [gravityVal, setGravityVal] = useState(1.0);
  const [restitution, setRestitution] = useState(0.85);
  const [temperature, setTemperature] = useState(280);
  const [flowSpeed, setFlowSpeed] = useState(140);
  const [gravConstant, setGravConstant] = useState(300);

  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const buildParams = (): Record<string, unknown> => {
    switch (simId) {
      case 'gravity':
        return { speed, gravStrength: gravConstant };
      case 'fluid':
        return { speed, flowSpeed };
      case 'elements':
        return { speed, temperature: Math.min(150, temperature - 250), gravity: gravityVal };
      case 'collision':
        return { speed, restitution, gravityY: gravityVal === 1 ? 0 : gravityVal };
      case 'molecular':
        return { speed, targetTemp: temperature };
      case 'windtunnel':
        return { speed, airflowSpeed: Math.max(8, Math.min(55, flowSpeed / 4)) };
      case 'playground':
        return { speed, gravityY: gravityVal, restitution };
      default:
        return { speed };
    }
  };

  const handleSave = () => {
    const saved = saveExperimentRecord({
      name,
      simId,
      notes,
      params: buildParams(),
    });
    setStatusMsg({ type: 'ok', text: `Saved "${saved.name}" to your Saved Experiments library.` });
  };

  const handleExport = () => {
    exportExperimentAsJson({
      name,
      simId,
      notes,
      params: buildParams(),
    });
    setStatusMsg({ type: 'ok', text: 'Configuration JSON downloaded.' });
  };

  const handleShare = async () => {
    const url = encodeShareableExperimentUrl({
      simId,
      name,
      params: buildParams(),
    });
    try {
      await navigator.clipboard.writeText(url);
      setStatusMsg({ type: 'ok', text: 'Shareable experiment URL copied to clipboard.' });
    } catch {
      setStatusMsg({ type: 'ok', text: `Share URL ready: ${url}` });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = validateImportedExperimentJson(text);
    if (!res.valid || !res.data) {
      setStatusMsg({ type: 'err', text: res.error || 'Failed to parse experiment JSON.' });
      return;
    }
    const saved = saveExperimentRecord({
      name: res.data.name,
      simId: res.data.simId,
      notes: res.data.notes,
      params: res.data.params,
      objects: res.data.objects,
    });
    setName(saved.name);
    setSimId(saved.simId);
    setNotes(saved.notes);
    setStatusMsg({ type: 'ok', text: `Imported "${saved.name}" and saved to library.` });
    e.target.value = '';
  };

  const meta = SIMULATION_MAP[simId];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400">Experiment Builder</div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            Configure, Save &amp; Share Custom Trials
          </h1>
        </div>
        <label className="px-3.5 py-2 rounded-md border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-2 cursor-pointer self-start">
          <Upload className="w-4 h-4 text-cyan-400" />
          <span>Import JSON Config</span>
          <input type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />
        </label>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-md border text-xs flex items-center gap-2 ${
            statusMsg.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMsg.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="truncate">{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-[#0A101D] p-5 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="builder-name" className="block text-xs font-medium text-slate-300">
              Experiment Title
            </label>
            <input
              id="builder-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-[#070B14] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="builder-env" className="block text-xs font-medium text-slate-300">
              Simulation Environment
            </label>
            <select
              id="builder-env"
              value={simId}
              onChange={(e) => setSimId(e.target.value as SimulationId)}
              className="w-full px-3 py-2 rounded-md bg-[#070B14] border border-slate-700 text-sm text-slate-100"
            >
              {SIMULATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.category})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 pt-1">{meta.summary}</p>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Initial Physical Parameters
            </h2>

            <SliderControl
              label="Time Speed Multiplier"
              value={speed}
              min={0.25}
              max={2.5}
              step={0.05}
              precision={2}
              unit="x"
              onChange={setSpeed}
            />

            {simId === 'gravity' && (
              <SliderControl
                label="Gravitational Constant G"
                value={gravConstant}
                min={80}
                max={750}
                step={10}
                precision={0}
                unit="scaled"
                onChange={setGravConstant}
              />
            )}

            {(simId === 'collision' || simId === 'playground' || simId === 'elements') && (
              <SliderControl
                label="Gravity Scale"
                value={gravityVal}
                min={0}
                max={2.0}
                step={0.1}
                precision={1}
                unit="g"
                onChange={setGravityVal}
              />
            )}

            {(simId === 'collision' || simId === 'playground') && (
              <SliderControl
                label="Elastic Restitution"
                value={restitution}
                min={0}
                max={1}
                step={0.05}
                precision={2}
                onChange={setRestitution}
              />
            )}

            {(simId === 'molecular' || simId === 'elements') && (
              <SliderControl
                label="Initial Temperature"
                value={temperature}
                min={30}
                max={550}
                step={10}
                precision={0}
                unit="K eq."
                onChange={setTemperature}
              />
            )}

            {(simId === 'fluid' || simId === 'windtunnel') && (
              <SliderControl
                label="Inlet Flow Speed"
                value={flowSpeed}
                min={40}
                max={240}
                step={10}
                precision={0}
                unit="units"
                onChange={setFlowSpeed}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="builder-notes" className="block text-xs font-medium text-slate-300">
              Hypothesis &amp; Notes
            </label>
            <textarea
              id="builder-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document expected behavior or test conditions..."
              className="w-full px-3 py-2 rounded-md bg-[#070B14] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-lg border border-slate-800 bg-[#0A101D] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">Configuration Preview</h2>
            <pre className="p-3 rounded-md bg-[#070B14] border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
              {JSON.stringify({ name, simId, params: buildParams() }, null, 2)}
            </pre>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onLaunchCustom(simId, buildParams())}
                className="w-full py-2.5 px-4 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Launch Experiment Now</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="w-full py-2 px-4 rounded-md border border-slate-700 hover:bg-slate-800 text-slate-100 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4 text-cyan-400" />
                <span>Save to Local Library</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="py-2 px-3 rounded-md border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="py-2 px-3 rounded-md border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share URL</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => onNavigate({ view: 'saved' })}
                className="w-full py-1.5 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                View Saved Experiments Library
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
