import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl, ToggleControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

type ChaosSystemMode = 'double' | 'single' | 'spring';

interface DoubleState {
  th1: number;
  w1: number;
  th2: number;
  w2: number;
  trail: { x: number; y: number }[];
}

interface ChaosSimulatorProps {
  initialParams?: Record<string, unknown>;
  presetId?: string;
  onOpenLearn?: () => void;
}

export const ChaosSimulator: React.FC<ChaosSimulatorProps> = ({
  initialParams,
  presetId,
  onOpenLearn,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<ChaosSystemMode>(
    (initialParams?.mode as ChaosSystemMode) || (presetId === 'double-butterfly' ? 'double' : 'double')
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(Number(initialParams?.speed ?? 1));
  const [zoom, setZoom] = useState(1);

  const [l1, setL1] = useState(Number(initialParams?.l1 ?? 1.2));
  const [l2, setL2] = useState(Number(initialParams?.l2 ?? 1.1));
  const [m1, setM1] = useState(Number(initialParams?.m1 ?? 2.0));
  const [m2, setM2] = useState(Number(initialParams?.m2 ?? 1.5));
  const [gravity, setGravity] = useState(Number(initialParams?.gravity ?? 9.81));
  const [initAngleDeg, setInitAngleDeg] = useState(Number(initialParams?.initAngleDeg ?? 125));
  const [damping, setDamping] = useState(Number(initialParams?.damping ?? 0.0));
  const [compareTwin, setCompareTwin] = useState(true);
  const [deltaAngleRad, setDeltaAngleRad] = useState(0.002);

  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [seriesData, setSeriesData] = useState<TelemetrySeriesPoint[]>([]);

  const primaryRef = useRef<DoubleState>({ th1: 2.18, w1: 0, th2: 2.0, w2: 0, trail: [] });
  const twinRef = useRef<DoubleState>({ th1: 2.182, w1: 0, th2: 2.0, w2: 0, trail: [] });
  const simTimeRef = useRef(0);

  const paramsRef = useRef({
    mode,
    isPlaying,
    speed,
    zoom,
    l1,
    l2,
    m1,
    m2,
    gravity,
    damping,
    compareTwin,
  });

  useEffect(() => {
    paramsRef.current = {
      mode,
      isPlaying,
      speed,
      zoom,
      l1,
      l2,
      m1,
      m2,
      gravity,
      damping,
      compareTwin,
    };
  }, [mode, isPlaying, speed, zoom, l1, l2, m1, m2, gravity, damping, compareTwin]);

  const resetStates = useCallback(() => {
    const rad = (initAngleDeg * Math.PI) / 180;
    if (mode === 'spring') {
      primaryRef.current = { th1: 0.9, w1: 0, th2: -0.4, w2: 0, trail: [] };
      twinRef.current = { th1: 0.9 + deltaAngleRad * 5, w1: 0, th2: -0.4, w2: 0, trail: [] };
    } else {
      primaryRef.current = { th1: rad, w1: 0, th2: rad * 0.85, w2: 0, trail: [] };
      twinRef.current = { th1: rad + deltaAngleRad, w1: 0, th2: rad * 0.85, w2: 0, trail: [] };
    }
    simTimeRef.current = 0;
    setSeriesData([]);
  }, [deltaAngleRad, initAngleDeg, mode]);

  useEffect(() => {
    resetStates();
  }, [resetStates]);

  // Exact RK4 derivatives for Double Pendulum, Single Pendulum, or Coupled Spring-Mass
  const derivs = (
    s: { th1: number; w1: number; th2: number; w2: number },
    cfg: typeof paramsRef.current
  ) => {
    const { mode: sysMode, l1: L1, l2: L2, m1: M1, m2: M2, gravity: g, damping: damp } = cfg;

    if (sysMode === 'single') {
      const a1 = -(g / L1) * Math.sin(s.th1) - damp * s.w1;
      return { dth1: s.w1, dw1: a1, dth2: 0, dw2: 0 };
    }

    if (sysMode === 'spring') {
      // Two coupled masses connected by 3 springs (k = 14)
      const k = 14;
      const x1 = s.th1;
      const v1 = s.w1;
      const x2 = s.th2;
      const v2 = s.w2;
      const a1 = (-k * x1 + k * (x2 - x1)) / M1 - damp * v1;
      const a2 = (-k * x2 + k * (x1 - x2)) / M2 - damp * v2;
      return { dth1: v1, dw1: a1, dth2: v2, dw2: a2 };
    }

    // Double pendulum Lagrangian ODE
    const d = s.th1 - s.th2;
    const denom1 = (M1 + M2) * L1 - M2 * L1 * Math.cos(d) * Math.cos(d);
    const denom2 = (L2 / L1) * denom1;

    const num1 =
      -M2 * L1 * s.w1 * s.w1 * Math.sin(d) * Math.cos(d) +
      M2 * g * Math.sin(s.th2) * Math.cos(d) +
      M2 * L2 * s.w2 * s.w2 * Math.sin(d) -
      (M1 + M2) * g * Math.sin(s.th1);

    const num2 =
      -M2 * L2 * s.w2 * s.w2 * Math.sin(d) * Math.cos(d) +
      (M1 + M2) * g * Math.sin(s.th1) * Math.cos(d) -
      (M1 + M2) * L1 * s.w1 * s.w1 * Math.sin(d) -
      (M1 + M2) * g * Math.sin(s.th2);

    const a1 = num1 / denom1 - damp * s.w1;
    const a2 = num2 / denom2 - damp * s.w2;

    return { dth1: s.w1, dw1: a1, dth2: s.w2, dw2: a2 };
  };

  const rk4Step = (st: DoubleState, dt: number, cfg: typeof paramsRef.current) => {
    const k1 = derivs(st, cfg);
    const k2 = derivs(
      {
        th1: st.th1 + 0.5 * dt * k1.dth1,
        w1: st.w1 + 0.5 * dt * k1.dw1,
        th2: st.th2 + 0.5 * dt * k1.dth2,
        w2: st.w2 + 0.5 * dt * k1.dw2,
      },
      cfg
    );
    const k3 = derivs(
      {
        th1: st.th1 + 0.5 * dt * k2.dth1,
        w1: st.w1 + 0.5 * dt * k2.dw1,
        th2: st.th2 + 0.5 * dt * k2.dth2,
        w2: st.w2 + 0.5 * dt * k2.dw2,
      },
      cfg
    );
    const k4 = derivs(
      {
        th1: st.th1 + dt * k3.dth1,
        w1: st.w1 + dt * k3.dw1,
        th2: st.th2 + dt * k3.dth2,
        w2: st.w2 + dt * k3.dw2,
      },
      cfg
    );

    st.th1 += (dt / 6) * (k1.dth1 + 2 * k2.dth1 + 2 * k3.dth1 + k4.dth1);
    st.w1 += (dt / 6) * (k1.dw1 + 2 * k2.dw1 + 2 * k3.dw1 + k4.dw1);
    st.th2 += (dt / 6) * (k1.dth2 + 2 * k2.dth2 + 2 * k3.dth2 + k4.dth2);
    st.w2 += (dt / 6) * (k1.dw2 + 2 * k2.dw2 + 2 * k3.dw2 + k4.dw2);
  };

  const stepPhysics = useCallback((dt: number) => {
    const cfg = paramsRef.current;
    const sub = 6;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      rk4Step(primaryRef.current, h, cfg);
      if (cfg.compareTwin) rk4Step(twinRef.current, h, cfg);
    }
    simTimeRef.current += dt;

    const pushTrail = (st: DoubleState) => {
      let tx = 0;
      let ty = 0;
      const pxScale = 95;
      if (cfg.mode === 'double') {
        tx = Math.sin(st.th1) * cfg.l1 * pxScale + Math.sin(st.th2) * cfg.l2 * pxScale;
        ty = Math.cos(st.th1) * cfg.l1 * pxScale + Math.cos(st.th2) * cfg.l2 * pxScale;
      } else if (cfg.mode === 'single') {
        tx = Math.sin(st.th1) * cfg.l1 * pxScale;
        ty = Math.cos(st.th1) * cfg.l1 * pxScale;
      } else {
        tx = st.th2 * 90;
        ty = st.th1 * 70;
      }
      st.trail.push({ x: tx, y: ty });
      if (st.trail.length > 260) st.trail.shift();
    };

    pushTrail(primaryRef.current);
    if (cfg.compareTwin) pushTrail(twinRef.current);
  }, []);

  const sampleTelemetry = useCallback(() => {
    const p = primaryRef.current;
    const tw = twinRef.current;
    const cfg = paramsRef.current;
    const div = Math.abs(p.th1 - tw.th1) + Math.abs(p.th2 - tw.th2);

    let energy = 0;
    if (cfg.mode === 'single') {
      const ke = 0.5 * cfg.m1 * (cfg.l1 * p.w1) ** 2;
      const pe = cfg.m1 * cfg.gravity * cfg.l1 * (1 - Math.cos(p.th1));
      energy = ke + pe;
    } else if (cfg.mode === 'spring') {
      const k = 14;
      const ke = 0.5 * cfg.m1 * p.w1 ** 2 + 0.5 * cfg.m2 * p.w2 ** 2;
      const pe = 0.5 * k * (p.th1 ** 2 + (p.th2 - p.th1) ** 2 + p.th2 ** 2);
      energy = ke + pe;
    } else {
      const y1 = -cfg.l1 * Math.cos(p.th1);
      const y2 = y1 - cfg.l2 * Math.cos(p.th2);
      const v1Sq = (cfg.l1 * p.w1) ** 2;
      const v2Sq =
        (cfg.l1 * p.w1) ** 2 +
        (cfg.l2 * p.w2) ** 2 +
        2 * cfg.l1 * cfg.l2 * p.w1 * p.w2 * Math.cos(p.th1 - p.th2);
      const ke = 0.5 * cfg.m1 * v1Sq + 0.5 * cfg.m2 * v2Sq;
      const pe = cfg.m1 * cfg.gravity * (y1 + cfg.l1) + cfg.m2 * cfg.gravity * (y2 + cfg.l1 + cfg.l2);
      energy = ke + pe;
    }

    setSimTime(simTimeRef.current);
    setMetrics([
      {
        id: 'ang',
        label: cfg.mode === 'spring' ? 'Displacements (x1, x2)' : 'Angles (th1, th2)',
        value: `${p.th1.toFixed(2)} / ${p.th2.toFixed(2)}`,
        unit: cfg.mode === 'spring' ? 'm' : 'rad',
        tone: 'cyan',
      },
      {
        id: 'vel',
        label: cfg.mode === 'spring' ? 'Velocities (v1, v2)' : 'Angular Vel (w1)',
        value: p.w1.toFixed(2),
        unit: cfg.mode === 'spring' ? 'm/s' : 'rad/s',
        tone: 'neutral',
      },
      {
        id: 'div',
        label: 'Twin Divergence',
        value: cfg.compareTwin ? div.toFixed(4) : 'Off',
        unit: cfg.compareTwin ? (cfg.mode === 'spring' ? 'm' : 'rad') : '',
        tone: 'amber',
      },
      {
        id: 'en',
        label: 'Mechanical Energy',
        value: energy.toFixed(2),
        unit: 'J',
        tone: 'emerald',
      },
    ]);

    setSeriesData((prev) => {
      const next = [
        ...prev,
        {
          t: +simTimeRef.current.toFixed(2),
          primary: +p.th1.toFixed(3),
          twin: +(cfg.compareTwin ? tw.th1 : p.th2).toFixed(3),
          divergence: +div.toFixed(4),
        },
      ];
      return next.length > 90 ? next.slice(next.length - 90) : next;
    });
  }, []);

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

        const cfg = paramsRef.current;
        if (cfg.isPlaying) {
          stepPhysics(dt * cfg.speed);
          telAcc += dt;
          if (telAcc >= 0.07) {
            telAcc = 0;
            sampleTelemetry();
          }
        }

        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2, cfg.mode === 'spring' ? h / 2 : h * 0.42);
        ctx.scale(cfg.zoom, cfg.zoom);

        const drawPendulum = (st: DoubleState, color: string, alpha: number) => {
          ctx.save();
          ctx.globalAlpha = alpha;
          if (st.trail.length > 1 && cfg.mode !== 'spring') {
            ctx.beginPath();
            ctx.moveTo(st.trail[0].x, st.trail[0].y);
            for (let i = 1; i < st.trail.length; i++) ctx.lineTo(st.trail[i].x, st.trail[i].y);
            ctx.strokeStyle = `${color}88`;
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }

          if (cfg.mode === 'spring') {
            const wallX = -210;
            const x1 = -70 + st.th1 * 65;
            const x2 = 70 + st.th2 * 65;
            // Draw spring zigzags
            const drawSpring = (sx: number, ex: number, yOff: number) => {
              const coils = 10;
              ctx.beginPath();
              ctx.moveTo(sx, yOff);
              for (let i = 1; i < coils; i++) {
                const px = sx + ((ex - sx) * i) / coils;
                const py = yOff + (i % 2 === 0 ? -9 : 9);
                ctx.lineTo(px, py);
              }
              ctx.lineTo(ex, yOff);
              ctx.strokeStyle = '#94A3B8';
              ctx.lineWidth = 1.6;
              ctx.stroke();
            };

            const yLine = alpha < 1 ? 48 : -20;
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(wallX, yLine - 28);
            ctx.lineTo(wallX, yLine + 28);
            ctx.moveTo(-wallX, yLine - 28);
            ctx.lineTo(-wallX, yLine + 28);
            ctx.stroke();

            drawSpring(wallX, x1 - 16, yLine);
            drawSpring(x1 + 16, x2 - 16, yLine);
            drawSpring(x2 + 16, -wallX, yLine);

            ctx.fillStyle = color;
            ctx.fillRect(x1 - 16, yLine - 16, 32, 32);
            ctx.fillRect(x2 - 16, yLine - 16, 32, 32);
          } else {
            const pxScale = 95;
            const x1 = Math.sin(st.th1) * cfg.l1 * pxScale;
            const y1 = Math.cos(st.th1) * cfg.l1 * pxScale;

            ctx.strokeStyle = '#94A3B8';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(x1, y1);
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x1, y1, 6 + cfg.m1 * 2, 0, Math.PI * 2);
            ctx.fill();

            if (cfg.mode === 'double') {
              const x2 = x1 + Math.sin(st.th2) * cfg.l2 * pxScale;
              const y2 = y1 + Math.cos(st.th2) * cfg.l2 * pxScale;
              ctx.strokeStyle = '#94A3B8';
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();

              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(x2, y2, 6 + cfg.m2 * 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        };

        if (cfg.compareTwin) drawPendulum(twinRef.current, '#F59E0B', 0.85);
        drawPendulum(primaryRef.current, '#06B6D4', 1);

        if (cfg.mode !== 'spring') {
          ctx.fillStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [sampleTelemetry, stepPhysics]);

  return (
    <SimulationWorkspace
      simId="chaos"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {
        setIsPlaying(false);
        stepPhysics(0.02 * speed);
        sampleTelemetry();
      }}
      onReset={resetStates}
      speed={speed}
      onSpeedChange={setSpeed}
      zoom={zoom}
      onZoomChange={setZoom}
      simTime={simTime}
      metrics={metrics}
      seriesData={seriesData}
      chartTitle={
        compareTwin
          ? 'Primary vs Perturbed Twin Trajectory & Divergence'
          : 'Oscillator Displacement Over Time'
      }
      chartSeries={[
        { key: 'primary', label: 'Primary (Cyan)', color: '#06B6D4' },
        { key: 'twin', label: compareTwin ? 'Twin (Amber)' : 'Secondary Arm', color: '#F59E0B' },
        ...(compareTwin ? [{ key: 'divergence', label: 'Divergence |dTheta|', color: '#10B981' }] : []),
      ]}
      currentParams={{ mode, l1, l2, m1, m2, gravity, initAngleDeg, damping, compareTwin }}
      hintText="Toggle Compare Perturbed Twin to see a 0.002 rad difference amplify into chaos."
      onOpenLearn={onOpenLearn}
      toolbarExtra={
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'double', label: 'Double Pendulum' },
              { id: 'single', label: 'Single Pendulum' },
              { id: 'spring', label: 'Coupled Springs' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-2 py-1 rounded-sm text-[11px] font-medium cursor-pointer ${
                mode === m.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
      controlsPanel={
        <div className="space-y-3">
          <SliderControl
            label="Initial Angle (theta1)"
            value={initAngleDeg}
            min={10}
            max={175}
            step={1}
            precision={0}
            unit="deg"
            onChange={(v) => setInitAngleDeg(v)}
          />
          <SliderControl
            label="Arm 1 Length (L1)"
            value={l1}
            min={0.5}
            max={2.0}
            step={0.05}
            precision={2}
            unit="m"
            onChange={setL1}
          />
          {mode === 'double' && (
            <SliderControl
              label="Arm 2 Length (L2)"
              value={l2}
              min={0.5}
              max={2.0}
              step={0.05}
              precision={2}
              unit="m"
              onChange={setL2}
            />
          )}
          <SliderControl
            label="Mass 1 (m1)"
            value={m1}
            min={0.5}
            max={5.0}
            step={0.1}
            precision={1}
            unit="kg"
            onChange={setM1}
          />
          {mode !== 'single' && (
            <SliderControl
              label="Mass 2 (m2)"
              value={m2}
              min={0.5}
              max={5.0}
              step={0.1}
              precision={1}
              unit="kg"
              onChange={setM2}
            />
          )}
          <SliderControl
            label="Gravity (g)"
            value={gravity}
            min={1.0}
            max={20.0}
            step={0.1}
            precision={2}
            unit="m/s²"
            onChange={setGravity}
          />
          <SliderControl
            label="Damping"
            value={damping}
            min={0}
            max={0.5}
            step={0.01}
            precision={2}
            unit="1/s"
            onChange={setDamping}
          />
          <ToggleControl
            label="Compare Perturbed Twin"
            checked={compareTwin}
            onChange={setCompareTwin}
            description="Run second system offset by delta_theta"
          />
          {compareTwin && (
            <SliderControl
              label="Initial Perturbation"
              value={deltaAngleRad}
              min={0.0005}
              max={0.05}
              step={0.0005}
              precision={4}
              unit="rad"
              onChange={setDeltaAngleRad}
            />
          )}
        </div>
      }
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </SimulationWorkspace>
  );
};
