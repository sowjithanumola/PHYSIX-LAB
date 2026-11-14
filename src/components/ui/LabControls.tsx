import React from 'react';
import { Info } from 'lucide-react';
import { TelemetryMetric } from '../../types/physics';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  precision?: number;
  tooltip?: string;
  onChange: (value: number) => void;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit = '',
  precision = 2,
  tooltip,
  onChange,
}) => {
  const formatted = Number.isInteger(step) && precision === 0 ? value.toFixed(0) : value.toFixed(precision);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-300 font-medium flex items-center gap-1.5">
          <span>{label}</span>
          {tooltip && (
            <span className="group relative inline-flex items-center text-slate-500 hover:text-cyan-400">
              <Info className="w-3.5 h-3.5" />
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-5 top-1/2 -translate-y-1/2 z-40 w-48 p-2 rounded-md bg-slate-950 border border-slate-700 text-[11px] leading-snug text-slate-200 shadow-lg">
                {tooltip}
              </span>
            </span>
          )}
        </span>
        <span className="font-mono tabular-nums text-cyan-300 text-xs shrink-0">
          {formatted}
          {unit ? <span className="text-slate-400 ml-1">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="lab-slider w-full"
        aria-label={label}
      />
    </div>
  );
};

interface ToggleControlProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

export const ToggleControl: React.FC<ToggleControlProps> = ({
  label,
  checked,
  onChange,
  description,
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-2 px-2.5 rounded-md bg-[#0D1422] border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
    >
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-200">{label}</div>
        {description && <div className="text-[11px] text-slate-400 truncate">{description}</div>}
      </div>
      <span
        className={`w-9 h-5 rounded-sm flex items-center p-0.5 shrink-0 transition-colors ${
          checked ? 'bg-cyan-500/25 border border-cyan-400/60' : 'bg-slate-800 border border-slate-700'
        }`}
      >
        <span
          className={`w-3.5 h-3.5 rounded-xs transition-transform ${
            checked ? 'translate-x-4 bg-cyan-400' : 'translate-x-0 bg-slate-400'
          }`}
        />
      </span>
    </button>
  );
};

interface TelemetryGridProps {
  metrics: TelemetryMetric[];
}

export const TelemetryGrid: React.FC<TelemetryGridProps> = ({ metrics }) => {
  const toneColor: Record<NonNullable<TelemetryMetric['tone']>, string> = {
    neutral: 'text-slate-100',
    cyan: 'text-cyan-300',
    amber: 'text-amber-300',
    emerald: 'text-emerald-300',
    rose: 'text-rose-300',
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {metrics.map((m) => (
        <div
          key={m.id}
          className="px-3 py-2.5 rounded-md bg-[#0B111E] border border-slate-800/90"
        >
          <div className="text-[11px] font-medium text-slate-400 truncate">{m.label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-base font-mono font-semibold tabular-nums ${toneColor[m.tone || 'neutral']}`}>
              {m.value}
            </span>
            {m.unit && <span className="text-[11px] font-mono text-slate-400">{m.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};
