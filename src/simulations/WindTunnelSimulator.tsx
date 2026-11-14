import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl, ToggleControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

type TunnelShape = 'cylinder' | 'airfoil' | 'flat-plate' | 'square';

interface SmokeParticle {
  x: number;
  y: number;
  px: number;
  py: number;
  lane: number;
}

interface WindTunnelSimulatorProps {
  initialParams?: Record<string, unknown>;
  presetId?: string;
  onOpenLearn?: () => void;
}

const SHAPE_DRAG_BASE: Record<TunnelShape, { label: string; cd: number; area: number }> = {
  airfoil: { label: 'Streamlined Airfoil', cd: 0.08, area: 0.25 },
  cylinder: { label: 'Circular Cylinder', cd: 1.17, area: 0.55 },
  square: { label: 'Square Prism', cd: 2.05, area: 0.6 },
  'flat-plate': { label: 'Perpendicular Flat Plate', cd: 1.98, area: 0.7 },
};

export const WindTunnelSimulator: React.FC<WindTunnelSimulatorProps> = ({
  initialParams,
  presetId,
  onOpenLearn,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shape, setShape] = useState<TunnelShape>(
    (initialParams?.shape as TunnelShape) || (presetId === 'airfoil' ? 'airfoil' : 'airfoil')
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);

  const [airflowSpeed, setAirflowSpeed] = useState(Number(initialParams?.airflowSpeed ?? 24)); // m/s
  const [angleOfAttack, setAngleOfAttack] = useState(Number(initialParams?.angleOfAttack ?? 6)); // deg
  const [airDensity, setAirDensity] = useState(Number(initialParams?.airDensity ?? 1.225)); // kg/m^3
  const [showPressureField, setShowPressureField] = useState(true);
  const [showStreamlines, setShowStreamlines] = useState(true);

  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);

  const bodyPosRef = useRef({ x: 260, y: 210 });
  const draggingRef = useRef(false);
  const stageSizeRef = useRef({ w: 800, h: 420 });
  const particlesRef = useRef<SmokeParticle[]>([]);
  const simTimeRef = useRef(0);

  const stateRef = useRef({
    shape,
    isPlaying,
    speed,
    airflowSpeed,
    angleOfAttack,
    airDensity,
    showPressureField,
    showStreamlines,
  });

  useEffect(() => {
    stateRef.current = {
      shape,
      isPlaying,
      speed,
      airflowSpeed,
      angleOfAttack,
      airDensity,
      showPressureField,
      showStreamlines,
    };
  }, [shape, isPlaying, speed, airflowSpeed, angleOfAttack, airDensity, showPressureField, showStreamlines]);

  const initSmoke = useCallback(() => {
    const { w, h } = stageSizeRef.current;
    const list: SmokeParticle[] = [];
    const lanes = 18;
    for (let i = 0; i < 320; i++) {
      const lane = i % lanes;
      const y = 30 + ((lane + 0.5) / lanes) * (h - 60);
      const x = Math.random() * w;
      list.push({ x, y, px: x, py: y, lane });
    }
    particlesRef.current = list;
    simTimeRef.current = 0;
  }, []);

  useEffect(() => {
    initSmoke();
  }, [initSmoke]);

  // Analytical potential flow + simplified wake velocity field
  const sampleFlow = useCallback((x: number, y: number) => {
    const { airflowSpeed: U, shape: sh, angleOfAttack: aoaDeg } = stateRef.current;
    const bx = bodyPosRef.current.x;
    const by = bodyPosRef.current.y;
    const Upx = U * 9;

    const dx = x - bx;
    const dy = y - by;
    const r2 = dx * dx + dy * dy;
    const a = sh === 'airfoil' ? 32 : 42;
    const a2 = a * a;

    // Doublet potential flow around body + circulation for airfoil AoA
    const r2Safe = Math.max(a2 * 0.65, r2);
    const cos2 = (dx * dx - dy * dy) / r2Safe;
    const sin2 = (2 * dx * dy) / r2Safe;
    const factor = a2 / r2Safe;

    let vx = Upx * (1 - factor * cos2);
    let vy = -Upx * factor * sin2;

    if (sh === 'airfoil') {
      // Bound vortex circulation proportional to sin(alpha)
      const gamma = 1.9 * Upx * a * Math.sin((aoaDeg * Math.PI) / 180);
      vx += (gamma * dy) / (2 * Math.PI * r2Safe);
      vy -= (gamma * dx) / (2 * Math.PI * r2Safe);
    }

    // Wake deficit downstream for blunt shapes
    if (dx > 0 && Math.abs(dy) < a * 1.15 && sh !== 'airfoil') {
      const wakeStrength = sh === 'cylinder' ? 0.45 : 0.72;
      const decay = Math.exp(-dx / 220);
      vx *= 1 - wakeStrength * decay;
      vy += Math.sin(simTimeRef.current * 8 + dx * 0.05) * Upx * 0.16 * decay;
    }

    const vMag = Math.hypot(vx, vy) / 9;
    // Bernoulli pressure deviation deltaP = 0.5 * rho * (U^2 - v^2)
    const cp = 1 - (vMag * vMag) / Math.max(1, U * U);
    return { vx, vy, vMag, cp };
  }, []);

  const dragComparisonData = useMemo<TelemetrySeriesPoint[]>(() => {
    const q = 0.5 * airDensity * airflowSpeed * airflowSpeed;
    return (Object.keys(SHAPE_DRAG_BASE) as TunnelShape[]).map((k, idx) => {
      const base = SHAPE_DRAG_BASE[k];
      const aoaFactor = k === 'airfoil' ? 1 + 0.03 * Math.abs(angleOfAttack) ** 1.4 : 1;
      const cd = base.cd * aoaFactor;
      const fd = q * cd * base.area;
      return {
        t: idx + 1,
        cd: +cd.toFixed(2),
        dragN: +fd.toFixed(1),
      };
    });
  }, [airDensity, airflowSpeed, angleOfAttack]);

  const updateMetrics = useCallback(() => {
    const base = SHAPE_DRAG_BASE[shape];
    const aoaRad = (angleOfAttack * Math.PI) / 180;
    const effectiveCd =
      shape === 'airfoil' ? base.cd + 0.85 * Math.sin(aoaRad) ** 2 : base.cd;
    const effectiveCl = shape === 'airfoil' ? 2 * Math.PI * Math.sin(aoaRad) * 0.65 : 0;
    const q = 0.5 * airDensity * airflowSpeed * airflowSpeed;
    const dragForce = q * effectiveCd * base.area;

    setMetrics([
      { id: 'u', label: 'Freestream Speed', value: airflowSpeed.toFixed(1), unit: 'm/s', tone: 'cyan' },
      { id: 'q', label: 'Dynamic Pressure q', value: q.toFixed(0), unit: 'Pa', tone: 'neutral' },
      { id: 'cd', label: 'Approx. Cd / Cl', value: `${effectiveCd.toFixed(2)} / ${effectiveCl.toFixed(2)}`, unit: 'est.', tone: 'amber' },
      { id: 'fd', label: 'Est. Drag Force', value: dragForce.toFixed(1), unit: 'N', tone: 'emerald' },
    ]);
  }, [airDensity, airflowSpeed, angleOfAttack, shape]);

  useEffect(() => {
    updateMetrics();
  }, [updateMetrics]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTs = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - lastTs) / 1000, 0.04);
      lastTs = now;

      const parent = canvas.parentElement;
      if (parent) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        stageSizeRef.current = { w, h };

        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const st = stateRef.current;
        if (st.isPlaying) {
          const stepDt = dt * st.speed;
          simTimeRef.current += stepDt;
          setSimTime(simTimeRef.current);

          const lanes = 18;
          for (const p of particlesRef.current) {
            p.px = p.x;
            p.py = p.y;
            const { vx, vy } = sampleFlow(p.x, p.y);
            p.x += vx * stepDt;
            p.y += vy * stepDt;

            // Keep outside solid body approximation
            const dx = p.x - bodyPosRef.current.x;
            const dy = p.y - bodyPosRef.current.y;
            const r = Math.hypot(dx, dy);
            const minR = st.shape === 'airfoil' ? 28 : 40;
            if (r < minR && r > 0.1) {
              p.x = bodyPosRef.current.x + (dx / r) * minR;
              p.y = bodyPosRef.current.y + (dy / r) * minR;
            }

            if (p.x > w + 10 || p.y < 10 || p.y > h - 10) {
              p.x = 0;
              p.px = 0;
              p.y = 30 + ((p.lane + 0.5) / lanes) * (h - 60);
              p.py = p.y;
            }
          }
        }

        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, w, h);

        // Pressure distribution heatmap (Bernoulli Cp)
        if (st.showPressureField) {
          const cell = 24;
          for (let gx = 0; gx < w; gx += cell) {
            for (let gy = 0; gy < h; gy += cell) {
              const { cp } = sampleFlow(gx + cell / 2, gy + cell / 2);
              const clamped = Math.max(-1, Math.min(1, cp));
              if (Math.abs(clamped) > 0.05) {
                ctx.fillStyle =
                  clamped > 0
                    ? `rgba(245, 158, 11, ${clamped * 0.25})`
                    : `rgba(6, 182, 212, ${-clamped * 0.25})`;
                ctx.fillRect(gx, gy, cell, cell);
              }
            }
          }
        }

        // Smoke streamlines & streak particles
        if (st.showStreamlines) {
          for (const p of particlesRef.current) {
            const { vMag } = sampleFlow(p.x, p.y);
            const ratio = Math.min(1.5, vMag / Math.max(1, st.airflowSpeed));
            ctx.strokeStyle =
              ratio > 1.08 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(203, 213, 225, 0.65)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.px, p.py);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }

        // Draw test shape
        const bx = bodyPosRef.current.x;
        const by = bodyPosRef.current.y;
        ctx.save();
        ctx.translate(bx, by);
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.2;

        if (st.shape === 'cylinder') {
          ctx.beginPath();
          ctx.arc(0, 0, 38, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (st.shape === 'square') {
          ctx.fillRect(-34, -34, 68, 68);
          ctx.strokeRect(-34, -34, 68, 68);
        } else if (st.shape === 'flat-plate') {
          ctx.fillRect(-8, -44, 16, 88);
          ctx.strokeRect(-8, -44, 16, 88);
        } else {
          ctx.rotate((st.angleOfAttack * Math.PI) / 180);
          ctx.beginPath();
          ctx.moveTo(-58, 0);
          ctx.bezierCurveTo(-40, -24, 10, -16, 58, 0);
          ctx.bezierCurveTo(10, 12, -40, 18, -58, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [sampleFlow]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (Math.hypot(x - bodyPosRef.current.x, y - bodyPosRef.current.y) < 60) {
      draggingRef.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    bodyPosRef.current = {
      x: Math.max(90, Math.min(rect.width - 90, e.clientX - rect.left)),
      y: Math.max(60, Math.min(rect.height - 60, e.clientY - rect.top)),
    };
  };

  return (
    <SimulationWorkspace
      simId="windtunnel"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {}}
      onReset={() => {
        bodyPosRef.current = { x: stageSizeRef.current.w * 0.36, y: stageSizeRef.current.h * 0.5 };
        initSmoke();
      }}
      speed={speed}
      onSpeedChange={setSpeed}
      zoom={zoom}
      onZoomChange={setZoom}
      simTime={simTime}
      metrics={metrics}
      seriesData={dragComparisonData}
      chartTitle="Shape Comparison: Drag Coefficient (Cd) & Estimated Drag (N) across Profiles (1:Airfoil, 2:Cylinder, 3:Square, 4:Plate)"
      chartSeries={[
        { key: 'cd', label: 'Approx. Cd', color: '#F59E0B' },
        { key: 'dragN', label: 'Est. Drag Force (N)', color: '#06B6D4' },
      ]}
      currentParams={{ shape, airflowSpeed, angleOfAttack, airDensity }}
      hintText="Drag the test object inside the wind tunnel and compare shapes across profiles."
      onOpenLearn={onOpenLearn}
      toolbarExtra={
        <div className="flex flex-wrap items-center gap-1">
          {(Object.keys(SHAPE_DRAG_BASE) as TunnelShape[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setShape(k)}
              className={`px-2 py-1 rounded-sm text-[11px] font-medium cursor-pointer ${
                shape === k
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {SHAPE_DRAG_BASE[k].label.split(' ').slice(-1)[0]}
            </button>
          ))}
        </div>
      }
      controlsPanel={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Test Body Shape</label>
            <select
              value={shape}
              onChange={(e) => setShape(e.target.value as TunnelShape)}
              className="w-full px-2.5 py-2 rounded-md bg-[#070B14] border border-slate-700 text-xs text-slate-100"
            >
              {(Object.keys(SHAPE_DRAG_BASE) as TunnelShape[]).map((k) => (
                <option key={k} value={k}>
                  {SHAPE_DRAG_BASE[k].label}
                </option>
              ))}
            </select>
          </div>

          <SliderControl
            label="Airflow Speed (U)"
            value={airflowSpeed}
            min={5}
            max={60}
            step={1}
            precision={0}
            unit="m/s"
            onChange={setAirflowSpeed}
          />
          {shape === 'airfoil' && (
            <SliderControl
              label="Angle of Attack (alpha)"
              value={angleOfAttack}
              min={-20}
              max={20}
              step={1}
              precision={0}
              unit="deg"
              onChange={setAngleOfAttack}
            />
          )}
          <SliderControl
            label="Air Density (rho)"
            value={airDensity}
            min={0.3}
            max={2.0}
            step={0.05}
            precision={2}
            unit="kg/m³"
            onChange={setAirDensity}
          />
          <ToggleControl
            label="Bernoulli Pressure Heatmap"
            checked={showPressureField}
            onChange={setShowPressureField}
            description="Amber = higher pressure, Cyan = lower pressure"
          />
          <ToggleControl
            label="Smoke Streamlines"
            checked={showStreamlines}
            onChange={setShowStreamlines}
          />
        </div>
      }
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
      />
    </SimulationWorkspace>
  );
};
