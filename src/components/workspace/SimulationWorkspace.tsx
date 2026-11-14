import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Gauge,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Trash2,
  Camera,
  Save,
  Download,
  Share2,
  ChevronRight,
  ChevronLeft,
  Activity,
  BookOpen,
  Info,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { SIMULATION_MAP } from '../../data/simulations';
import { SimulationId, TelemetryMetric, TelemetrySeriesPoint } from '../../types/physics';
import { TelemetryGrid } from '../ui/LabControls';
import {
  captureCanvasScreenshot,
  encodeShareableExperimentUrl,
  exportExperimentAsJson,
  saveExperimentRecord,
} from '../../utils/experimentStorage';

export interface ChartSeriesSpec {
  key: string;
  label: string;
  color: string;
}

interface SimulationWorkspaceProps {
  simId: SimulationId;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  onClear?: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  simTime: number;
  metrics: TelemetryMetric[];
  seriesData: TelemetrySeriesPoint[];
  chartSeries: ChartSeriesSpec[];
  chartTitle: string;
  controlsPanel: React.ReactNode;
  inspectorPanel?: React.ReactNode;
  toolbarExtra?: React.ReactNode;
  currentParams: Record<string, unknown>;
  currentObjects?: unknown[];
  hintText?: string;
  onOpenLearn?: () => void;
  children: React.ReactNode;
}

export const SimulationWorkspace: React.FC<SimulationWorkspaceProps> = ({
  simId,
  isPlaying,
  onTogglePlay,
  onStep,
  onReset,
  onClear,
  speed,
  onSpeedChange,
  zoom,
  onZoomChange,
  simTime,
  metrics,
  seriesData,
  chartSeries,
  chartTitle,
  controlsPanel,
  inspectorPanel,
  toolbarExtra,
  currentParams,
  currentObjects,
  hintText,
  onOpenLearn,
  children,
}) => {
  const meta = SIMULATION_MAP[simId];
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const workspaceRootRef = useRef<HTMLDivElement>(null);

  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [showEquations, setShowEquations] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [expName, setExpName] = useState(`${meta.shortTitle} Trial`);
  const [expNotes, setExpNotes] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => setFeedbackMsg(null), 2600);
  };

  const handleToggleFullscreen = async () => {
    const el = workspaceRootRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  const handleScreenshot = () => {
    const ok = captureCanvasScreenshot(stageWrapperRef.current, `physix-${simId}`);
    showToast(ok ? 'Screenshot downloaded as PNG' : 'Canvas snapshot unavailable');
  };

  const handleExportJson = () => {
    exportExperimentAsJson({
      name: expName || `${meta.shortTitle} Export`,
      simId,
      notes: expNotes,
      params: currentParams,
      objects: currentObjects,
    });
    showToast('Experiment configuration exported');
  };

  const handleShareUrl = async () => {
    const url = encodeShareableExperimentUrl({
      simId,
      name: expName || meta.shortTitle,
      params: currentParams,
    });
    try {
      await navigator.clipboard.writeText(url);
      showToast('Shareable configuration URL copied');
    } catch {
      window.history.replaceState(null, '', url);
      showToast('Shareable configuration URL applied to address bar');
    }
  };

  const handleSaveExperiment = (e: React.FormEvent) => {
    e.preventDefault();
    saveExperimentRecord({
      name: expName,
      simId,
      notes: expNotes,
      params: currentParams,
      objects: currentObjects,
    });
    setShowSaveDialog(false);
    showToast('Experiment saved to local library');
  };

  const isSlowMo = Math.abs(speed - 0.25) < 0.01;

  return (
    <div
      ref={workspaceRootRef}
      className={`flex flex-col bg-[#070B14] text-slate-100 ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'min-h-[calc(100vh-56px)]'
      }`}
    >
      {/* Top Simulation Control & Telemetry Ribbon */}
      <div className="border-b border-slate-800 bg-[#0A101D] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{meta.category}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{meta.engineLabel}</span>
            </div>
            <h1 className="text-sm sm:text-base font-semibold text-slate-100 truncate">
              {meta.title}
            </h1>
          </div>
        </div>

        {/* Transport & Time Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 bg-[#070B14] border border-slate-800 rounded-md p-1">
            <button
              type="button"
              onClick={onTogglePlay}
              title={isPlaying ? 'Pause simulation' : 'Play simulation'}
              className={`px-2.5 py-1.5 rounded-sm text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isPlaying
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              onClick={onStep}
              title="Step forward one frame"
              className="p-1.5 rounded-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Step forward"
            >
              <StepForward className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onReset}
              title="Reset simulation"
              className="p-1.5 rounded-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Reset simulation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {onClear && (
              <button
                type="button"
                onClick={onClear}
                title="Clear experiment objects"
                className="p-1.5 rounded-sm text-slate-300 hover:text-rose-300 hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Clear experiment"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Speed & Slow Motion */}
          <div className="flex items-center gap-2 bg-[#070B14] border border-slate-800 rounded-md px-2.5 py-1">
            <button
              type="button"
              onClick={() => onSpeedChange(isSlowMo ? 1 : 0.25)}
              title="Toggle 0.25x slow motion"
              className={`px-2 py-0.5 rounded-sm text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                isSlowMo
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Slow 0.25x
            </button>
            <Gauge className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <input
              type="range"
              min={0.1}
              max={3.0}
              step={0.05}
              value={speed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              className="lab-slider w-16 sm:w-20"
              aria-label="Simulation speed multiplier"
            />
            <span className="font-mono tabular-nums text-[11px] text-cyan-300 w-9 text-right">
              {speed.toFixed(2)}x
            </span>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5 bg-[#070B14] border border-slate-800 rounded-md p-1">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(0.4, +(zoom - 0.15).toFixed(2)))}
              title="Zoom out"
              className="p-1.5 rounded-sm text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(1)}
              title="Reset zoom to 100%"
              className="px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-slate-300 hover:text-white cursor-pointer"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(2.5, +(zoom + 0.15).toFixed(2)))}
              title="Zoom in"
              className="p-1.5 rounded-sm text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Utility Actions */}
          <div className="flex items-center gap-1 bg-[#070B14] border border-slate-800 rounded-md p-1">
            <button
              type="button"
              onClick={() => setShowSaveDialog(true)}
              title="Save experiment to local library"
              className="p-1.5 rounded-sm text-slate-300 hover:text-cyan-300 hover:bg-slate-800 cursor-pointer"
              aria-label="Save experiment"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              title="Export experiment JSON"
              className="p-1.5 rounded-sm text-slate-300 hover:text-cyan-300 hover:bg-slate-800 cursor-pointer"
              aria-label="Export JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleShareUrl}
              title="Copy shareable configuration URL"
              className="p-1.5 rounded-sm text-slate-300 hover:text-cyan-300 hover:bg-slate-800 cursor-pointer"
              aria-label="Share URL"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleScreenshot}
              title="Capture PNG screenshot"
              className="p-1.5 rounded-sm text-slate-300 hover:text-cyan-300 hover:bg-slate-800 cursor-pointer"
              aria-label="Capture screenshot"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen simulation'}
              className="p-1.5 rounded-sm text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-800 text-xs font-mono tabular-nums text-slate-300">
            <span className="text-slate-500">T+</span>
            <span>{simTime.toFixed(2)} s</span>
          </div>
        </div>
      </div>

      {/* Toast confirmation banner */}
      {feedbackMsg && (
        <div className="bg-cyan-500/15 border-b border-cyan-500/30 px-4 py-1.5 text-xs text-cyan-200 flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-cyan-400" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left Parameter & Object Inspector Column */}
        {showLeftPanel && (
          <aside className="w-full lg:w-[320px] xl:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#0A101D] overflow-y-auto max-h-[420px] lg:max-h-none">
            <div className="p-3.5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Parameters & Controls
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowEquations((prev) => !prev)}
                    className={`px-2 py-1 rounded-sm text-[11px] font-medium transition-colors cursor-pointer ${
                      showEquations
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    Equations
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLeftPanel(false)}
                    className="p-1 text-slate-400 hover:text-slate-200 rounded-sm cursor-pointer lg:inline-flex hidden"
                    title="Collapse parameter panel"
                    aria-label="Collapse parameter panel"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {showEquations && (
                <div className="p-3 rounded-md bg-[#070B14] border border-slate-800 space-y-2.5 text-xs">
                  {meta.equations.map((eq) => (
                    <div key={eq.label} className="space-y-1">
                      <div className="font-medium text-slate-300">{eq.label}</div>
                      <div className="font-mono text-[11px] text-cyan-300 bg-[#0D1526] px-2 py-1.5 rounded-sm border border-slate-800 overflow-x-auto">
                        {eq.formula}
                      </div>
                      <ul className="space-y-0.5 text-[11px] text-slate-400">
                        {eq.variables.map((v) => (
                          <li key={v.symbol}>
                            <span className="font-mono text-slate-200">{v.symbol}</span>: {v.name} ({v.unit})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {onOpenLearn && (
                    <button
                      type="button"
                      onClick={onOpenLearn}
                      className="w-full py-1.5 px-2.5 rounded-md bg-slate-800/80 hover:bg-slate-800 text-xs text-cyan-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Open Theory & Guided Lesson</span>
                    </button>
                  )}
                </div>
              )}

              {/* Simulation-specific Parameter Controls */}
              <div className="space-y-3">{controlsPanel}</div>

              {/* Selected Object Inspector */}
              {inspectorPanel && (
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Selected Object Inspector
                  </h3>
                  {inspectorPanel}
                </div>
              )}

              {/* Scientific Model Honesty Note */}
              <div className="p-2.5 rounded-md bg-[#070B14] border border-slate-800/90 text-[11px] leading-relaxed text-slate-400 flex gap-2">
                <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>{meta.modelNote}</span>
              </div>
            </div>
          </aside>
        )}

        {/* Center Canvas Stage + Bottom Live Science Data */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Sub-toolbar for quick toggles & hints */}
          <div className="px-3 py-1.5 border-b border-slate-800/80 bg-[#080E1A] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {!showLeftPanel && (
                <button
                  type="button"
                  onClick={() => setShowLeftPanel(true)}
                  className="px-2 py-1 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>Controls</span>
                </button>
              )}
              {toolbarExtra}
              {hintText && <span className="text-slate-400 truncate hidden sm:inline">{hintText}</span>}
            </div>

            <button
              type="button"
              onClick={() => setShowTelemetry((prev) => !prev)}
              className={`px-2.5 py-1 rounded-sm text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                showTelemetry
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{showTelemetry ? 'Hide Live Science Data' : 'Show Live Science Data'}</span>
            </button>
          </div>

          {/* Interactive Simulation Viewport */}
          <div
            ref={stageWrapperRef}
            className="relative flex-1 min-h-[380px] sm:min-h-[440px] bg-[#050811] overflow-hidden"
          >
            {children}
          </div>

          {/* Bottom Live Science Data & Real-Time Graph Tray */}
          {showTelemetry && (
            <section
              aria-label="Live Science Data"
              className="border-t border-slate-800 bg-[#0A101D] p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Live Science Data
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  Sample Time: {simTime.toFixed(2)} s
                </span>
              </div>

              <TelemetryGrid metrics={metrics} />

              {chartSeries.length > 0 && (
                <div className="rounded-md bg-[#070B14] border border-slate-800 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-slate-300">{chartTitle}</span>
                    <div className="flex flex-wrap items-center gap-3 text-[11px]">
                      {chartSeries.map((s) => (
                        <span key={s.key} className="flex items-center gap-1.5 text-slate-300">
                          <span
                            className="inline-block w-2.5 h-0.5"
                            style={{ backgroundColor: s.color }}
                          />
                          <span>{s.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="h-36 w-full">
                    {seriesData.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={seriesData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                          <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="t"
                            stroke="#64748B"
                            fontSize={10}
                            tickFormatter={(val) => `${Number(val).toFixed(1)}s`}
                          />
                          <YAxis stroke="#64748B" fontSize={10} width={52} />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: '#0B111E',
                              borderColor: '#334155',
                              borderRadius: '6px',
                              fontSize: '11px',
                            }}
                            labelFormatter={(val) => `t = ${Number(val).toFixed(2)} s`}
                          />
                          {chartSeries.map((s) => (
                            <Line
                              key={s.key}
                              type="monotone"
                              dataKey={s.key}
                              name={s.label}
                              stroke={s.color}
                              strokeWidth={1.75}
                              dot={false}
                              isAnimationActive={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                        Collecting simulation samples...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Save Experiment Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveExperiment}
            className="w-full max-w-md rounded-lg bg-[#0D1422] border border-slate-700 p-5 space-y-4 shadow-2xl"
          >
            <h2 className="text-base font-semibold text-slate-100">Save Experiment Configuration</h2>
            <div className="space-y-1.5">
              <label htmlFor="exp-name" className="block text-xs font-medium text-slate-300">
                Experiment Name
              </label>
              <input
                id="exp-name"
                type="text"
                required
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[#070B14] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="exp-notes" className="block text-xs font-medium text-slate-300">
                Lab Notes (Optional)
              </label>
              <textarea
                id="exp-notes"
                rows={3}
                value={expNotes}
                onChange={(e) => setExpNotes(e.target.value)}
                placeholder="Record hypothesis, parameters tested, or observed outcomes..."
                className="w-full px-3 py-2 rounded-md bg-[#070B14] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 rounded-md border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold cursor-pointer"
              >
                Save to Library
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
