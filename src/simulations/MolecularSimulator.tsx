import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl, ToggleControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

interface Atom {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
}

interface MolecularSimulatorProps {
  initialParams?: Record<string, unknown>;
  presetId?: string;
  onOpenLearn?: () => void;
}

export const MolecularSimulator: React.FC<MolecularSimulatorProps> = ({
  initialParams,
  presetId,
  onOpenLearn,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);

  const [targetTemp, setTargetTemp] = useState(
    Number(initialParams?.targetTemp ?? (presetId === 'phase-transition' ? 180 : 280))
  ); // Kelvin
  const [boxScale, setBoxScale] = useState(Number(initialParams?.boxScale ?? 0.85)); // 0.45..1.0
  const [interactionEps, setInteractionEps] = useState(Number(initialParams?.interactionEps ?? 1.2));
  const [atomCount, setAtomCount] = useState(Number(initialParams?.atomCount ?? 72));
  const [showBonds, setShowBonds] = useState(true);

  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [speedHistogram, setSpeedHistogram] = useState<TelemetrySeriesPoint[]>([]);

  const atomsRef = useRef<Atom[]>([]);
  const wallImpulseRef = useRef(0);
  const simTimeRef = useRef(0);

  const stateRef = useRef({
    isPlaying,
    speed,
    targetTemp,
    boxScale,
    interactionEps,
    atomCount,
    showBonds,
  });

  useEffect(() => {
    stateRef.current = {
      isPlaying,
      speed,
      targetTemp,
      boxScale,
      interactionEps,
      atomCount,
      showBonds,
    };
  }, [isPlaying, speed, targetTemp, boxScale, interactionEps, atomCount, showBonds]);

  const seedAtoms = useCallback((count: number, temp: number) => {
    const list: Atom[] = [];
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = 28;
    const speedScale = Math.sqrt(temp / 120) * 45;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * spacing;
      const y = (row - (cols - 1) / 2) * spacing;
      const a = Math.random() * Math.PI * 2;
      list.push({
        x,
        y,
        vx: Math.cos(a) * speedScale,
        vy: Math.sin(a) * speedScale,
        ax: 0,
        ay: 0,
      });
    }
    atomsRef.current = list;
    wallImpulseRef.current = 0;
    simTimeRef.current = 0;
  }, []);

  useEffect(() => {
    seedAtoms(atomCount, targetTemp);
  }, [atomCount, seedAtoms]);

  const computeForces = useCallback((atoms: Atom[], eps: number) => {
    const sigma = 24;
    const rCut2 = (sigma * 2.4) ** 2;
    for (const a of atoms) {
      a.ax = 0;
      a.ay = 0;
    }
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const a = atoms[i];
        const b = atoms[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const r2 = dx * dx + dy * dy;
        if (r2 < rCut2 && r2 > 36) {
          const invR2 = (sigma * sigma) / r2;
          const invR6 = invR2 * invR2 * invR2;
          const invR12 = invR6 * invR6;
          // Lennard-Jones force magnitude F/r
          const fScalar = (24 * eps * 180 * (2 * invR12 - invR6)) / r2;
          const fx = fScalar * dx;
          const fy = fScalar * dy;
          a.ax -= fx;
          a.ay -= fy;
          b.ax += fx;
          b.ay += fy;
        }
      }
    }
  }, []);

  const stepMolecular = useCallback(
    (dt: number) => {
      const atoms = atomsRef.current;
      const { boxScale: bScale, interactionEps: eps, targetTemp: tTarget } = stateRef.current;
      const halfW = 280 * bScale;
      const halfH = 185 * bScale;
      const sub = 3;
      const h = dt / sub;

      for (let s = 0; s < sub; s++) {
        computeForces(atoms, eps);
        for (const a of atoms) {
          a.vx += 0.5 * a.ax * h;
          a.vy += 0.5 * a.ay * h;
          a.x += a.vx * h;
          a.y += a.vy * h;

          if (a.x < -halfW + 8) {
            a.x = -halfW + 8;
            wallImpulseRef.current += Math.abs(a.vx) * 2;
            a.vx = Math.abs(a.vx);
          } else if (a.x > halfW - 8) {
            a.x = halfW - 8;
            wallImpulseRef.current += Math.abs(a.vx) * 2;
            a.vx = -Math.abs(a.vx);
          }
          if (a.y < -halfH + 8) {
            a.y = -halfH + 8;
            wallImpulseRef.current += Math.abs(a.vy) * 2;
            a.vy = Math.abs(a.vy);
          } else if (a.y > halfH - 8) {
            a.y = halfH - 8;
            wallImpulseRef.current += Math.abs(a.vy) * 2;
            a.vy = -Math.abs(a.vy);
          }
        }
        computeForces(atoms, eps);
        for (const a of atoms) {
          a.vx += 0.5 * a.ax * h;
          a.vy += 0.5 * a.ay * h;
        }

        // Berendsen velocity-rescaling thermostat toward targetTemp
        let keSum = 0;
        for (const a of atoms) keSum += a.vx * a.vx + a.vy * a.vy;
        const avgV2 = atoms.length ? keSum / atoms.length : 1;
        const currentTemp = Math.max(1, avgV2 * 0.045);
        const lambda = Math.sqrt(1 + 0.08 * (tTarget / currentTemp - 1));
        const clampedLambda = Math.max(0.85, Math.min(1.15, lambda));
        for (const a of atoms) {
          a.vx *= clampedLambda;
          a.vy *= clampedLambda;
        }
      }

      simTimeRef.current += dt;
    },
    [computeForces]
  );

  const sampleTelemetry = useCallback(() => {
    const atoms = atomsRef.current;
    let sumV2 = 0;
    const speeds: number[] = [];
    for (const a of atoms) {
      const v2 = a.vx * a.vx + a.vy * a.vy;
      sumV2 += v2;
      speeds.push(Math.sqrt(v2));
    }
    const meanV2 = atoms.length ? sumV2 / atoms.length : 0;
    const rmsSpeed = Math.sqrt(meanV2);
    const measTemp = meanV2 * 0.045;
    const pressure = (wallImpulseRef.current / Math.max(0.2, boxScale)) * 0.025;
    wallImpulseRef.current *= 0.55;

    const phaseLabel =
      measTemp < 75 * interactionEps
        ? 'Solid Lattice'
        : measTemp < 210 * interactionEps
        ? 'Liquid Phase'
        : 'Gas Phase';

    setSimTime(simTimeRef.current);
    setMetrics([
      { id: 'temp', label: 'Measured Temp', value: measTemp.toFixed(0), unit: 'K', tone: 'amber' },
      { id: 'pres', label: 'Wall Pressure Proxy', value: pressure.toFixed(1), unit: 'kPa eq.', tone: 'cyan' },
      { id: 'rms', label: 'RMS Particle Speed', value: rmsSpeed.toFixed(1), unit: 'u/s', tone: 'emerald' },
      { id: 'phase', label: 'Emergent State', value: phaseLabel, unit: '', tone: 'neutral' },
    ]);

    // Build 10-bin speed distribution histogram
    const bins = Array.from({ length: 10 }, (_, idx) => ({ t: (idx + 1) * 20, count: 0 }));
    for (const sp of speeds) {
      const idx = Math.min(9, Math.floor(sp / 20));
      bins[idx].count += 1;
    }
    setSpeedHistogram(bins);
  }, [boxScale, interactionEps]);

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
          stepMolecular(dt * st.speed);
          telAcc += dt;
          if (telAcc >= 0.14) {
            telAcc = 0;
            sampleTelemetry();
          }
        }

        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(zoom, zoom);

        const halfW = 280 * st.boxScale;
        const halfH = 185 * st.boxScale;

        // Chamber walls
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-halfW, -halfH, halfW * 2, halfH * 2);

        const atoms = atomsRef.current;

        // Intermolecular neighbor bonds
        if (st.showBonds) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.lineWidth = 1.2;
          for (let i = 0; i < atoms.length; i++) {
            for (let j = i + 1; j < atoms.length; j++) {
              const dist = Math.hypot(atoms[j].x - atoms[i].x, atoms[j].y - atoms[i].y);
              if (dist < 38) {
                ctx.beginPath();
                ctx.moveTo(atoms[i].x, atoms[i].y);
                ctx.lineTo(atoms[j].x, atoms[j].y);
                ctx.stroke();
              }
            }
          }
        }

        // Draw atoms colored by kinetic speed
        for (const a of atoms) {
          const sp = Math.hypot(a.vx, a.vy);
          const norm = Math.min(1, sp / 170);
          const r = Math.round(14 + norm * 235);
          const g = Math.round(165 + (1 - Math.abs(norm - 0.5) * 2) * 50);
          const b = Math.round(233 - norm * 190);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.beginPath();
          ctx.arc(a.x, a.y, 7.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [sampleTelemetry, stepMolecular, zoom]);

  return (
    <SimulationWorkspace
      simId="molecular"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {
        setIsPlaying(false);
        stepMolecular(0.02 * speed);
        sampleTelemetry();
      }}
      onReset={() => seedAtoms(atomCount, targetTemp)}
      speed={speed}
      onSpeedChange={setSpeed}
      zoom={zoom}
      onZoomChange={setZoom}
      simTime={simTime}
      metrics={metrics}
      seriesData={speedHistogram}
      chartTitle="Instantaneous Molecular Speed Distribution (Maxwell-Boltzmann Histogram Bins)"
      chartSeries={[{ key: 'count', label: 'Atom Count', color: '#F59E0B' }]}
      currentParams={{ targetTemp, boxScale, interactionEps, atomCount, showBonds }}
      hintText="Raise temperature from 30 K (Solid) to 180 K (Liquid) to 480 K (Gas) or compress container volume."
      onOpenLearn={onOpenLearn}
      toolbarExtra={
        <div className="flex items-center gap-1">
          {[
            { label: 'Solid (35 K)', t: 35 },
            { label: 'Liquid (160 K)', t: 160 },
            { label: 'Gas (450 K)', t: 450 },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setTargetTemp(p.t)}
              className={`px-2 py-1 rounded-sm text-[11px] font-medium cursor-pointer ${
                Math.abs(targetTemp - p.t) < 15
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      }
      controlsPanel={
        <div className="space-y-3">
          <SliderControl
            label="Thermostat Temperature"
            value={targetTemp}
            min={20}
            max={600}
            step={5}
            precision={0}
            unit="K"
            onChange={setTargetTemp}
          />
          <SliderControl
            label="Container Volume Scale"
            value={boxScale}
            min={0.45}
            max={1.0}
            step={0.05}
            precision={2}
            unit="x"
            tooltip="Decreasing container size increases density and wall collision pressure."
            onChange={setBoxScale}
          />
          <SliderControl
            label="Lennard-Jones Well (eps)"
            value={interactionEps}
            min={0.1}
            max={2.5}
            step={0.1}
            precision={1}
            unit="kJ/mol eq."
            onChange={setInteractionEps}
          />
          <SliderControl
            label="Particle Count"
            value={atomCount}
            min={24}
            max={110}
            step={4}
            precision={0}
            unit="atoms"
            onChange={setAtomCount}
          />
          <ToggleControl
            label="Intermolecular Bonds"
            checked={showBonds}
            onChange={setShowBonds}
          />
        </div>
      }
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </SimulationWorkspace>
  );
};
