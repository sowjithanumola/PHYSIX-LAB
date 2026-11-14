import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

interface EmSource {
  id: string;
  kind: 'charge' | 'magnet';
  x: number;
  y: number;
  strength: number; // +q or -q for charge; dipole strength for magnet
  angle: number; // dipole orientation in radians
}

interface TestCharge {
  x: number;
  y: number;
  vx: number;
  vy: number;
  q: number;
  trail: { x: number; y: number }[];
}

interface ElectromagnetismSimulatorProps {
  initialParams?: Record<string, unknown>;
  presetId?: string;
  onOpenLearn?: () => void;
}

function createPresetSources(preset: string): EmSource[] {
  if (preset === 'quadrupole') {
    return [
      { id: 'c1', kind: 'charge', x: -110, y: -90, strength: 4, angle: 0 },
      { id: 'c2', kind: 'charge', x: 110, y: -90, strength: -4, angle: 0 },
      { id: 'c3', kind: 'charge', x: 110, y: 90, strength: 4, angle: 0 },
      { id: 'c4', kind: 'charge', x: -110, y: 90, strength: -4, angle: 0 },
    ];
  }
  if (preset === 'magnet') {
    return [
      { id: 'm1', kind: 'magnet', x: 0, y: 0, strength: 6, angle: 0 },
      { id: 'c1', kind: 'charge', x: -170, y: 0, strength: 3, angle: 0 },
    ];
  }
  // Default dipole
  return [
    { id: 'c1', kind: 'charge', x: -120, y: 0, strength: 5, angle: 0 },
    { id: 'c2', kind: 'charge', x: 120, y: 0, strength: -5, angle: 0 },
  ];
}

export const ElectromagnetismSimulator: React.FC<ElectromagnetismSimulatorProps> = ({
  initialParams,
  presetId,
  onOpenLearn,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preset, setPreset] = useState((initialParams?.preset as string) || presetId || 'dipole');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [vizMode, setVizMode] = useState<'lines' | 'vectors' | 'potential' | 'combined'>('combined');
  const [tool, setTool] = useState<'drag' | 'add-pos' | 'add-neg' | 'add-mag' | 'launch-test'>('drag');
  const [selectedId, setSelectedId] = useState<string | null>('c1');
  const [selectedSnap, setSelectedSnap] = useState<EmSource | null>(null);
  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [seriesData, setSeriesData] = useState<TelemetrySeriesPoint[]>([]);

  const sourcesRef = useRef<EmSource[]>(createPresetSources(preset));
  const testChargesRef = useRef<TestCharge[]>([
    { x: -120, y: -60, vx: 35, vy: 0, q: 1, trail: [] },
  ]);
  const probePosRef = useRef({ x: 0, y: 0 });
  const dragIdRef = useRef<string | null>(null);
  const simTimeRef = useRef(0);

  const stateRef = useRef({ isPlaying, speed, zoom, vizMode, selectedId });
  useEffect(() => {
    stateRef.current = { isPlaying, speed, zoom, vizMode, selectedId };
  }, [isPlaying, speed, zoom, vizMode, selectedId]);

  const evalField = useCallback((x: number, y: number) => {
    let ex = 0;
    let ey = 0;
    let vPot = 0;
    let bz = 0;
    const k = 28000;
    const eps2 = 160;

    for (const s of sourcesRef.current) {
      const dx = x - s.x;
      const dy = y - s.y;
      const r2 = dx * dx + dy * dy + eps2;
      const r = Math.sqrt(r2);
      if (s.kind === 'charge') {
        const mag = (k * s.strength) / (r2 * r);
        ex += mag * dx;
        ey += mag * dy;
        vPot += (s.strength * 140) / r;
      } else {
        // 2D magnetic dipole field around N/S poles
        const poleOffset = 22;
        const nx = s.x + Math.cos(s.angle) * poleOffset;
        const ny = s.y + Math.sin(s.angle) * poleOffset;
        const sx = s.x - Math.cos(s.angle) * poleOffset;
        const sy = s.y - Math.sin(s.angle) * poleOffset;
        const dn2 = (x - nx) ** 2 + (y - ny) ** 2 + 180;
        const ds2 = (x - sx) ** 2 + (y - sy) ** 2 + 180;
        bz += (s.strength * 240) / (dn2 ** 0.5 + 10) - (s.strength * 240) / (ds2 ** 0.5 + 10);
      }
    }
    return { ex, ey, vPot, bz };
  }, []);

  const stepParticles = useCallback(
    (dt: number) => {
      const list = testChargesRef.current;
      for (const p of list) {
        const { ex, ey, bz } = evalField(p.x, p.y);
        // Lorentz force F = q(E + v x B_z)
        const fx = p.q * (ex + p.vy * bz * 0.15);
        const fy = p.q * (ey - p.vx * bz * 0.15);
        p.vx += fx * dt;
        p.vy += fy * dt;
        const spd = Math.hypot(p.vx, p.vy);
        if (spd > 320) {
          p.vx = (p.vx / spd) * 320;
          p.vy = (p.vy / spd) * 320;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 90) p.trail.shift();
      }
      // Keep particles in reasonable bounds
      testChargesRef.current = list.filter((p) => Math.abs(p.x) < 600 && Math.abs(p.y) < 420);
      simTimeRef.current += dt;
    },
    [evalField]
  );

  const sampleTelemetry = useCallback(() => {
    const netCharge = sourcesRef.current
      .filter((s) => s.kind === 'charge')
      .reduce((acc, s) => acc + s.strength, 0);
    const probe = probePosRef.current;
    const { ex, ey, vPot } = evalField(probe.x, probe.y);
    const eMag = Math.hypot(ex, ey);
    const sel = sourcesRef.current.find((s) => s.id === stateRef.current.selectedId) || null;
    setSelectedSnap(sel ? { ...sel } : null);
    setSimTime(simTimeRef.current);

    setMetrics([
      { id: 'q', label: 'Net Charge', value: netCharge.toFixed(1), unit: 'uC', tone: 'cyan' },
      { id: 'e', label: 'Probe |E| Field', value: eMag.toFixed(1), unit: 'N/C eq.', tone: 'amber' },
      { id: 'v', label: 'Probe Potential V', value: vPot.toFixed(1), unit: 'V eq.', tone: 'emerald' },
      { id: 'tp', label: 'Test Particles', value: String(testChargesRef.current.length), unit: 'active', tone: 'neutral' },
    ]);

    setSeriesData((prev) => {
      const next = [...prev, { t: +simTimeRef.current.toFixed(2), eMag: +eMag.toFixed(1), pot: +vPot.toFixed(1) }];
      return next.length > 75 ? next.slice(next.length - 75) : next;
    });
  }, [evalField]);

  const loadPreset = useCallback(
    (p: string) => {
      setPreset(p);
      sourcesRef.current = createPresetSources(p);
      testChargesRef.current = [{ x: -60, y: -70, vx: 30, vy: 15, q: 1, trail: [] }];
      simTimeRef.current = 0;
      setSeriesData([]);
      setSelectedId(sourcesRef.current[0]?.id || null);
      sampleTelemetry();
    },
    [sampleTelemetry]
  );

  useEffect(() => {
    sampleTelemetry();
  }, [sampleTelemetry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTs = performance.now();
    let telAcc = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - lastTs) / 1000, 0.04);
      lastTs = now;

      const parent = canvas.parentElement;
      if (parent) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const st = stateRef.current;
        if (st.isPlaying) {
          stepParticles(dt * st.speed);
          telAcc += dt;
          if (telAcc >= 0.1) {
            telAcc = 0;
            sampleTelemetry();
          }
        }

        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(st.zoom, st.zoom);

        // Potential heatmap
        if (st.vizMode === 'potential' || st.vizMode === 'combined') {
          const step = 22;
          for (let gx = -w / 2; gx < w / 2; gx += step) {
            for (let gy = -h / 2; gy < h / 2; gy += step) {
              const { vPot } = evalField(gx, gy);
              const norm = Math.tanh(vPot / 18);
              if (Math.abs(norm) > 0.04) {
                ctx.fillStyle =
                  norm > 0
                    ? `rgba(245, 158, 11, ${Math.min(0.28, norm * 0.28)})`
                    : `rgba(6, 182, 212, ${Math.min(0.28, -norm * 0.28)})`;
                ctx.fillRect(gx - step / 2, gy - step / 2, step, step);
              }
            }
          }
        }

        // Vector arrows grid
        if (st.vizMode === 'vectors' || st.vizMode === 'combined') {
          const spacing = 42;
          for (let gx = -w / 2 + 20; gx < w / 2; gx += spacing) {
            for (let gy = -h / 2 + 20; gy < h / 2; gy += spacing) {
              const { ex, ey } = evalField(gx, gy);
              const mag = Math.hypot(ex, ey);
              if (mag < 2) continue;
              const len = Math.min(18, Math.log1p(mag) * 3.2);
              const ux = (ex / mag) * len;
              const uy = (ey / mag) * len;
              ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
              ctx.lineWidth = 1.1;
              ctx.beginPath();
              ctx.moveTo(gx, gy);
              ctx.lineTo(gx + ux, gy + uy);
              ctx.stroke();
            }
          }
        }

        // Electric field lines traced via RK2 from charges
        if (st.vizMode === 'lines' || st.vizMode === 'combined') {
          for (const src of sourcesRef.current) {
            if (src.kind !== 'charge' || Math.abs(src.strength) < 0.1) continue;
            const rays = 12;
            const sign = src.strength > 0 ? 1 : -1;
            for (let i = 0; i < rays; i++) {
              const a = (i / rays) * Math.PI * 2;
              let rx = src.x + Math.cos(a) * 16;
              let ry = src.y + Math.sin(a) * 16;
              ctx.beginPath();
              ctx.moveTo(rx, ry);
              for (let step = 0; step < 64; step++) {
                const { ex, ey } = evalField(rx, ry);
                const mag = Math.hypot(ex, ey);
                if (mag < 0.4) break;
                const ds = 8 * sign;
                const k1x = (ex / mag) * ds;
                const k1y = (ey / mag) * ds;
                const f2 = evalField(rx + k1x * 0.5, ry + k1y * 0.5);
                const m2 = Math.hypot(f2.ex, f2.ey) || 1;
                rx += (f2.ex / m2) * ds;
                ry += (f2.ey / m2) * ds;
                ctx.lineTo(rx, ry);
                // Stop if absorbed into opposite charge
                if (
                  sourcesRef.current.some(
                    (o) => o.id !== src.id && o.kind === 'charge' && Math.hypot(o.x - rx, o.y - ry) < 15
                  )
                ) {
                  break;
                }
              }
              ctx.strokeStyle = sign > 0 ? 'rgba(245, 158, 11, 0.45)' : 'rgba(6, 182, 212, 0.45)';
              ctx.lineWidth = 1.25;
              ctx.stroke();
            }
          }
        }

        // Draw test particle trails & dots
        for (const tp of testChargesRef.current) {
          if (tp.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(tp.trail[0].x, tp.trail[0].y);
            for (let i = 1; i < tp.trail.length; i++) ctx.lineTo(tp.trail[i].x, tp.trail[i].y);
            ctx.strokeStyle = '#10B981';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.fillStyle = '#34D399';
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw charges & magnets
        for (const s of sourcesRef.current) {
          if (s.kind === 'charge') {
            const pos = s.strength >= 0;
            ctx.fillStyle = pos ? '#F59E0B' : '#06B6D4';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = s.id === st.selectedId ? '#F8FAFC' : '#0F172A';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#070B14';
            ctx.font = 'bold 14px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pos ? '+' : '-', s.x, s.y + 0.5);
          } else {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle);
            ctx.fillStyle = '#EF4444';
            ctx.fillRect(0, -10, 22, 20);
            ctx.fillStyle = '#3B82F6';
            ctx.fillRect(-22, -10, 22, 20);
            ctx.strokeStyle = s.id === st.selectedId ? '#F8FAFC' : '#1E293B';
            ctx.lineWidth = 2;
            ctx.strokeRect(-22, -10, 44, 20);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('N', 11, 0);
            ctx.fillText('S', -11, 0);
            ctx.restore();
          }
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [evalField, sampleTelemetry, stepParticles]);

  const toWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - rect.width / 2) / zoom,
      y: (clientY - rect.top - rect.height / 2) / zoom,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toWorld(e.clientX, e.clientY);
    if (tool === 'launch-test') {
      testChargesRef.current.push({
        x: pt.x,
        y: pt.y,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        q: 1,
        trail: [],
      });
      sampleTelemetry();
      return;
    }

    if (tool === 'add-pos' || tool === 'add-neg' || tool === 'add-mag') {
      const id = `em_${Date.now().toString(36)}`;
      const item: EmSource =
        tool === 'add-mag'
          ? { id, kind: 'magnet', x: pt.x, y: pt.y, strength: 5, angle: 0 }
          : { id, kind: 'charge', x: pt.x, y: pt.y, strength: tool === 'add-pos' ? 4 : -4, angle: 0 };
      sourcesRef.current.push(item);
      setSelectedId(id);
      setTool('drag');
      sampleTelemetry();
      return;
    }

    const hit = sourcesRef.current.find((s) => Math.hypot(s.x - pt.x, s.y - pt.y) <= 22);
    if (hit) {
      dragIdRef.current = hit.id;
      setSelectedId(hit.id);
      setSelectedSnap({ ...hit });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toWorld(e.clientX, e.clientY);
    probePosRef.current = pt;
    if (dragIdRef.current) {
      const target = sourcesRef.current.find((s) => s.id === dragIdRef.current);
      if (target) {
        target.x = pt.x;
        target.y = pt.y;
      }
    }
  };

  const updateSelected = (patch: Partial<EmSource>) => {
    if (!selectedId) return;
    const t = sourcesRef.current.find((s) => s.id === selectedId);
    if (!t) return;
    Object.assign(t, patch);
    setSelectedSnap({ ...t });
    sampleTelemetry();
  };

  return (
    <SimulationWorkspace
      simId="electromagnetism"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {
        setIsPlaying(false);
        stepParticles(0.02 * speed);
        sampleTelemetry();
      }}
      onReset={() => loadPreset(preset)}
      onClear={() => {
        sourcesRef.current = [];
        testChargesRef.current = [];
        setSelectedId(null);
        sampleTelemetry();
      }}
      speed={speed}
      onSpeedChange={setSpeed}
      zoom={zoom}
      onZoomChange={setZoom}
      simTime={simTime}
      metrics={metrics}
      seriesData={seriesData}
      chartTitle="Cursor Probe Electric Field & Potential"
      chartSeries={[
        { key: 'eMag', label: 'Field |E|', color: '#F59E0B' },
        { key: 'pot', label: 'Potential V', color: '#06B6D4' },
      ]}
      currentParams={{ preset, vizMode }}
      hintText="Move pointer to probe field strength, drag poles, or spawn charges and test particles."
      onOpenLearn={onOpenLearn}
      toolbarExtra={
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'drag', label: 'Select / Drag' },
            { id: 'add-pos', label: '+ Charge' },
            { id: 'add-neg', label: '- Charge' },
            { id: 'add-mag', label: '+ Magnet' },
            { id: 'launch-test', label: 'Emit Test Charge' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setTool(btn.id as typeof tool)}
              className={`px-2 py-1 rounded-sm text-[11px] font-medium cursor-pointer ${
                tool === btn.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      }
      controlsPanel={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Configuration Preset</label>
            <select
              value={preset}
              onChange={(e) => loadPreset(e.target.value)}
              className="w-full px-2.5 py-2 rounded-md bg-[#070B14] border border-slate-700 text-xs text-slate-100"
            >
              <option value="dipole">Electric Dipole</option>
              <option value="quadrupole">Electric Quadrupole</option>
              <option value="magnet">Magnetic Dipole & Charge</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Field Visualization Mode</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'combined', label: 'Combined' },
                  { id: 'lines', label: 'Field Lines' },
                  { id: 'vectors', label: 'Vector Grid' },
                  { id: 'potential', label: 'Potential Map' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setVizMode(m.id)}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium cursor-pointer ${
                    vizMode === m.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-[#070B14] text-slate-400 border border-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      }
      inspectorPanel={
        selectedSnap ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-cyan-300">
                {selectedSnap.kind === 'charge' ? 'Point Charge' : 'Magnetic Dipole'}
              </span>
              <button
                type="button"
                onClick={() => {
                  sourcesRef.current = sourcesRef.current.filter((s) => s.id !== selectedSnap.id);
                  setSelectedId(null);
                  sampleTelemetry();
                }}
                className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                Delete
              </button>
            </div>
            <SliderControl
              label={selectedSnap.kind === 'charge' ? 'Charge Strength' : 'Dipole Moment'}
              value={selectedSnap.strength}
              min={-12}
              max={12}
              step={0.5}
              precision={1}
              unit={selectedSnap.kind === 'charge' ? 'uC' : 'A·m²'}
              onChange={(v) => updateSelected({ strength: v })}
            />
            {selectedSnap.kind === 'magnet' && (
              <SliderControl
                label="Orientation Angle"
                value={(selectedSnap.angle * 180) / Math.PI}
                min={-180}
                max={180}
                step={5}
                precision={0}
                unit="deg"
                onChange={(deg) => updateSelected({ angle: (deg * Math.PI) / 180 })}
              />
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400">Click any charge or magnet to adjust its strength.</div>
        )
      }
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          dragIdRef.current = null;
        }}
        className="w-full h-full block cursor-crosshair touch-none"
      />
    </SimulationWorkspace>
  );
};
