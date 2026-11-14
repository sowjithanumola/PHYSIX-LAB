import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl, ToggleControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

interface FluidParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  px: number;
  py: number;
  pressure: number;
}

interface FluidObstacle {
  id: string;
  shape: 'circle' | 'block';
  x: number;
  y: number;
  r: number;
}

interface FluidSimulatorProps {
  initialParams?: Record<string, unknown>;
  onOpenLearn?: () => void;
}

export const FluidSimulator: React.FC<FluidSimulatorProps> = ({ initialParams, onOpenLearn }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(Number(initialParams?.speed ?? 1));
  const [zoom, setZoom] = useState(1);

  const [flowSpeed, setFlowSpeed] = useState(Number(initialParams?.flowSpeed ?? 140));
  const [viscosity, setViscosity] = useState(Number(initialParams?.viscosity ?? 0.18));
  const [density, setDensity] = useState(Number(initialParams?.density ?? 1000));
  const [boundaryMode, setBoundaryMode] = useState<'channel' | 'tank'>('channel');
  const [colorMode, setColorMode] = useState<'velocity' | 'pressure'>('velocity');
  const [showVectors, setShowVectors] = useState(true);
  const [showTrails, setShowTrails] = useState(true);

  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [seriesData, setSeriesData] = useState<TelemetrySeriesPoint[]>([]);

  const particlesRef = useRef<FluidParticle[]>([]);
  const obstaclesRef = useRef<FluidObstacle[]>([
    { id: 'obs-1', shape: 'circle', x: 300, y: 200, r: 36 },
    { id: 'obs-2', shape: 'block', x: 520, y: 250, r: 30 },
  ]);
  const dragObsRef = useRef<string | null>(null);
  const stageSizeRef = useRef({ w: 800, h: 440 });
  const simTimeRef = useRef(0);

  const paramsRef = useRef({
    isPlaying,
    speed,
    zoom,
    flowSpeed,
    viscosity,
    density,
    boundaryMode,
    colorMode,
    showVectors,
    showTrails,
  });

  useEffect(() => {
    paramsRef.current = {
      isPlaying,
      speed,
      zoom,
      flowSpeed,
      viscosity,
      density,
      boundaryMode,
      colorMode,
      showVectors,
      showTrails,
    };
  }, [isPlaying, speed, zoom, flowSpeed, viscosity, density, boundaryMode, colorMode, showVectors, showTrails]);

  const initParticles = useCallback(() => {
    const { w, h } = stageSizeRef.current;
    const count = 420;
    const list: FluidParticle[] = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = 24 + Math.random() * (h - 48);
      list.push({ x, y, px: x, py: y, vx: flowSpeed, vy: (Math.random() - 0.5) * 15, pressure: 0 });
    }
    particlesRef.current = list;
    simTimeRef.current = 0;
    setSeriesData([]);
  }, [flowSpeed]);

  useEffect(() => {
    initParticles();
  }, [initParticles]);

  const stepFluid = useCallback((dt: number) => {
    const { w, h } = stageSizeRef.current;
    const { flowSpeed: targetU, viscosity: visc, density: rho, boundaryMode: bMode } = paramsRef.current;
    const parts = particlesRef.current;
    const obsList = obstaclesRef.current;

    // Coarse Eulerian velocity/density grid for local pressure & viscosity coupling
    const cols = 28;
    const rows = 16;
    const cellW = w / cols;
    const cellH = h / rows;
    const counts = new Float32Array(cols * rows);
    const meanVx = new Float32Array(cols * rows);
    const meanVy = new Float32Array(cols * rows);

    for (const p of parts) {
      const cx = Math.max(0, Math.min(cols - 1, Math.floor(p.x / cellW)));
      const cy = Math.max(0, Math.min(rows - 1, Math.floor(p.y / cellH)));
      const idx = cy * cols + cx;
      counts[idx] += 1;
      meanVx[idx] += p.vx;
      meanVy[idx] += p.vy;
    }
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > 0) {
        meanVx[i] /= counts[i];
        meanVy[i] /= counts[i];
      }
    }

    const densityScale = rho / 1000;
    for (const p of parts) {
      p.px = p.x;
      p.py = p.y;

      const cx = Math.max(0, Math.min(cols - 1, Math.floor(p.x / cellW)));
      const cy = Math.max(0, Math.min(rows - 1, Math.floor(p.y / cellH)));
      const idx = cy * cols + cx;

      // Pressure gradient force from neighboring grid cells
      const cLeft = counts[cy * cols + Math.max(0, cx - 1)];
      const cRight = counts[cy * cols + Math.min(cols - 1, cx + 1)];
      const cUp = counts[Math.max(0, cy - 1) * cols + cx];
      const cDown = counts[Math.min(rows - 1, cy + 1) * cols + cx];

      const pressureForceX = (cLeft - cRight) * 32 * densityScale;
      const pressureForceY = (cUp - cDown) * 32 * densityScale;

      p.pressure = counts[idx] * 0.65 * densityScale;

      // Viscous relaxation toward local neighborhood mean velocity
      const blend = Math.min(0.95, visc * 2.5 * dt * 10);
      p.vx += (meanVx[idx] - p.vx) * blend + pressureForceX * dt;
      p.vy += (meanVy[idx] - p.vy) * blend + pressureForceY * dt;

      if (bMode === 'channel') {
        // Drive inlet stream velocity smoothly
        p.vx += (targetU - p.vx) * (1.4 * dt);
      } else {
        // Closed tank gravity + sloshing
        p.vy += 120 * dt;
        p.vx *= 1 - visc * 0.4 * dt;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Obstacle collisions
      for (const obs of obsList) {
        if (obs.shape === 'circle') {
          const dx = p.x - obs.x;
          const dy = p.y - obs.y;
          const dist = Math.hypot(dx, dy);
          if (dist < obs.r + 3 && dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            p.x = obs.x + nx * (obs.r + 3);
            p.y = obs.y + ny * (obs.r + 3);
            const vn = p.vx * nx + p.vy * ny;
            if (vn < 0) {
              p.vx -= 1.3 * vn * nx;
              p.vy -= 1.3 * vn * ny;
            }
            p.pressure += 2.2 * densityScale;
          }
        } else {
          const half = obs.r;
          const dx = p.x - obs.x;
          const dy = p.y - obs.y;
          if (Math.abs(dx) < half + 3 && Math.abs(dy) < half + 3) {
            const overlapX = half + 3 - Math.abs(dx);
            const overlapY = half + 3 - Math.abs(dy);
            if (overlapX < overlapY) {
              p.x += dx > 0 ? overlapX : -overlapX;
              p.vx *= -0.5;
            } else {
              p.y += dy > 0 ? overlapY : -overlapY;
              p.vy *= -0.5;
            }
            p.pressure += 2.0 * densityScale;
          }
        }
      }

      // Top & bottom interactive boundaries
      if (p.y < 14) {
        p.y = 14;
        p.vy = Math.abs(p.vy) * 0.6;
      } else if (p.y > h - 14) {
        p.y = h - 14;
        p.vy = -Math.abs(p.vy) * 0.6;
      }

      if (bMode === 'channel') {
        if (p.x > w + 8) {
          p.x = 4;
          p.px = 4;
          p.y = 20 + Math.random() * (h - 40);
          p.py = p.y;
          p.vx = targetU * (0.85 + Math.random() * 0.3);
          p.vy = (Math.random() - 0.5) * 12;
        } else if (p.x < 2) {
          p.x = 2;
          p.vx = Math.abs(p.vx);
        }
      } else {
        if (p.x < 14) {
          p.x = 14;
          p.vx = Math.abs(p.vx) * 0.6;
        } else if (p.x > w - 14) {
          p.x = w - 14;
          p.vx = -Math.abs(p.vx) * 0.6;
        }
      }
    }

    simTimeRef.current += dt;
  }, []);

  const sampleTelemetry = useCallback(() => {
    const parts = particlesRef.current;
    const { viscosity: visc, density: rho } = paramsRef.current;
    let sumSpeed = 0;
    let maxP = 0;
    for (const p of parts) {
      const sp = Math.hypot(p.vx, p.vy);
      sumSpeed += sp;
      if (p.pressure > maxP) maxP = p.pressure;
    }
    const meanSpeed = parts.length ? sumSpeed / parts.length : 0;
    const scaledSpeedMs = meanSpeed / 25;
    const reynolds = (rho * scaledSpeedMs * 0.15) / Math.max(0.01, visc);

    setSimTime(simTimeRef.current);
    setMetrics([
      { id: 'v', label: 'Mean Flow Speed', value: scaledSpeedMs.toFixed(2), unit: 'm/s', tone: 'cyan' },
      { id: 're', label: 'Est. Reynolds No.', value: reynolds.toFixed(0), unit: 'Re', tone: 'amber' },
      { id: 'p', label: 'Peak Pressure Proxy', value: maxP.toFixed(2), unit: 'kPa eq.', tone: 'emerald' },
      { id: 'n', label: 'Fluid Particles', value: String(parts.length), unit: 'nodes', tone: 'neutral' },
    ]);
    setSeriesData((prev) => {
      const next = [
        ...prev,
        {
          t: +simTimeRef.current.toFixed(2),
          speed: +scaledSpeedMs.toFixed(2),
          pressure: +maxP.toFixed(2),
        },
      ];
      return next.length > 80 ? next.slice(next.length - 80) : next;
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
    let telemetryAcc = 0;

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

        const pState = paramsRef.current;
        if (pState.isPlaying) {
          stepFluid(dt * pState.speed);
          telemetryAcc += dt;
          if (telemetryAcc >= 0.1) {
            telemetryAcc = 0;
            sampleTelemetry();
          }
        }

        // Background
        if (pState.showTrails) {
          ctx.fillStyle = 'rgba(5, 8, 17, 0.34)';
          ctx.fillRect(0, 0, w, h);
        } else {
          ctx.fillStyle = '#050811';
          ctx.fillRect(0, 0, w, h);
        }

        // Subtle boundary frame
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, w - 20, h - 20);

        // Draw fluid particles
        for (const p of particlesRef.current) {
          const sp = Math.hypot(p.vx, p.vy);
          let color = '#06B6D4';
          if (pState.colorMode === 'velocity') {
            const norm = Math.min(1, sp / 240);
            const r = Math.round(6 + norm * 240);
            const g = Math.round(182 - norm * 40);
            const b = Math.round(212 - norm * 170);
            color = `rgb(${r},${g},${b})`;
          } else {
            const norm = Math.min(1, p.pressure / 5);
            const r = Math.round(30 + norm * 225);
            const g = Math.round(120 + (1 - Math.abs(norm - 0.5) * 2) * 80);
            const b = Math.round(240 - norm * 190);
            color = `rgb(${r},${g},${b})`;
          }

          if (pState.showTrails) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(p.px, p.py);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          } else {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          if (pState.showVectors && sp > 5) {
            ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.vx * 0.09, p.y + p.vy * 0.09);
            ctx.stroke();
          }
        }

        // Draw draggable obstacles
        for (const obs of obstaclesRef.current) {
          ctx.fillStyle = '#0F172A';
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2;
          if (obs.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillRect(obs.x - obs.r, obs.y - obs.r, obs.r * 2, obs.r * 2);
            ctx.strokeRect(obs.x - obs.r, obs.y - obs.r, obs.r * 2, obs.r * 2);
          }
        }
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [sampleTelemetry, stepFluid]);

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toCanvas(e.clientX, e.clientY);
    const hit = obstaclesRef.current.find((o) => Math.hypot(o.x - pt.x, o.y - pt.y) <= o.r + 10);
    if (hit) dragObsRef.current = hit.id;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragObsRef.current) return;
    const pt = toCanvas(e.clientX, e.clientY);
    const target = obstaclesRef.current.find((o) => o.id === dragObsRef.current);
    if (target) {
      target.x = pt.x;
      target.y = pt.y;
    }
  };

  const handlePointerUp = () => {
    dragObsRef.current = null;
  };

  const addObstacle = (shape: 'circle' | 'block') => {
    if (obstaclesRef.current.length >= 6) return;
    obstaclesRef.current.push({
      id: `obs_${Date.now()}`,
      shape,
      x: 200 + Math.random() * 300,
      y: 120 + Math.random() * 180,
      r: 28,
    });
  };

  return (
    <SimulationWorkspace
      simId="fluid"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {
        setIsPlaying(false);
        stepFluid(0.02 * speed);
        sampleTelemetry();
      }}
      onReset={initParticles}
      onClear={() => {
        obstaclesRef.current = [];
        initParticles();
      }}
      speed={speed}
      onSpeedChange={setSpeed}
      zoom={zoom}
      onZoomChange={setZoom}
      simTime={simTime}
      metrics={metrics}
      seriesData={seriesData}
      chartTitle="Flow Speed & Local Pressure Proxy"
      chartSeries={[
        { key: 'speed', label: 'Mean Speed (m/s)', color: '#06B6D4' },
        { key: 'pressure', label: 'Peak Pressure Proxy', color: '#F59E0B' },
      ]}
      currentParams={{ flowSpeed, viscosity, density, boundaryMode, colorMode }}
      hintText="Drag circular or square obstacles anywhere in the flow channel."
      onOpenLearn={onOpenLearn}
      toolbarExtra={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => addObstacle('circle')}
            className="px-2 py-1 rounded-sm border border-slate-700 hover:bg-slate-800 text-[11px] text-slate-200 cursor-pointer"
          >
            + Cylinder
          </button>
          <button
            type="button"
            onClick={() => addObstacle('block')}
            className="px-2 py-1 rounded-sm border border-slate-700 hover:bg-slate-800 text-[11px] text-slate-200 cursor-pointer"
          >
            + Block
          </button>
        </div>
      }
      controlsPanel={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setBoundaryMode('channel')}
              className={`py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                boundaryMode === 'channel'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-[#070B14] text-slate-400 border border-slate-800'
              }`}
            >
              Open Channel
            </button>
            <button
              type="button"
              onClick={() => setBoundaryMode('tank')}
              className={`py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                boundaryMode === 'tank'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-[#070B14] text-slate-400 border border-slate-800'
              }`}
            >
              Closed Tank
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setColorMode('velocity')}
              className={`py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                colorMode === 'velocity'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-[#070B14] text-slate-400 border border-slate-800'
              }`}
            >
              Velocity View
            </button>
            <button
              type="button"
              onClick={() => setColorMode('pressure')}
              className={`py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                colorMode === 'pressure'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-[#070B14] text-slate-400 border border-slate-800'
              }`}
            >
              Pressure View
            </button>
          </div>

          <SliderControl
            label="Inlet Flow Speed"
            value={flowSpeed}
            min={30}
            max={280}
            step={5}
            precision={0}
            unit="px/s"
            onChange={setFlowSpeed}
          />
          <SliderControl
            label="Dynamic Viscosity"
            value={viscosity}
            min={0.02}
            max={0.85}
            step={0.02}
            precision={2}
            unit="Pa·s eq."
            onChange={setViscosity}
          />
          <SliderControl
            label="Fluid Density"
            value={density}
            min={500}
            max={2000}
            step={50}
            precision={0}
            unit="kg/m³"
            onChange={setDensity}
          />

          <ToggleControl
            label="Velocity Vectors"
            checked={showVectors}
            onChange={setShowVectors}
          />
          <ToggleControl
            label="Particle Trails"
            checked={showTrails}
            onChange={setShowTrails}
          />
        </div>
      }
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
      />
    </SimulationWorkspace>
  );
};
