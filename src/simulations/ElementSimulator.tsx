import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

// Material codes
const EMPTY = 0;
const SAND = 1;
const WATER = 2;
const ICE = 3;
const STEAM = 4;
const STONE = 5;
const OIL = 6;
const WOOD = 7;

type BrushMaterial =
  | typeof SAND
  | typeof WATER
  | typeof ICE
  | typeof STEAM
  | typeof STONE
  | typeof OIL
  | typeof WOOD
  | typeof EMPTY;

const MATERIAL_META: { id: BrushMaterial; label: string; color: string }[] = [
  { id: SAND, label: 'Sand', color: '#EAB308' },
  { id: WATER, label: 'Water', color: '#0EA5E9' },
  { id: ICE, label: 'Ice', color: '#BAE6FD' },
  { id: STEAM, label: 'Steam', color: '#CBD5E1' },
  { id: OIL, label: 'Oil', color: '#A16207' },
  { id: WOOD, label: 'Wood', color: '#92400E' },
  { id: STONE, label: 'Stone', color: '#475569' },
  { id: EMPTY, label: 'Eraser', color: '#0F172A' },
];

const GRID_W = 180;
const GRID_H = 110;

interface ElementSimulatorProps {
  initialParams?: Record<string, unknown>;
  onOpenLearn?: () => void;
}

export const ElementSimulator: React.FC<ElementSimulatorProps> = ({ initialParams, onOpenLearn }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(Number(initialParams?.speed ?? 1));
  const [zoom, setZoom] = useState(1);
  const [brush, setBrush] = useState<BrushMaterial>(SAND);
  const [brushSize, setBrushSize] = useState(5);
  const [temperature, setTemperature] = useState(Number(initialParams?.temperature ?? 22));
  const [gravity, setGravity] = useState(Number(initialParams?.gravity ?? 1));
  const [preset, setPreset] = useState('basin');

  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [seriesData, setSeriesData] = useState<TelemetrySeriesPoint[]>([]);

  const gridRef = useRef<Uint8Array>(new Uint8Array(GRID_W * GRID_H));
  const simTimeRef = useRef(0);
  const drawingRef = useRef(false);
  const pointerPosRef = useRef<{ gx: number; gy: number } | null>(null);

  const stateRef = useRef({ isPlaying, speed, temperature, gravity, brush, brushSize });
  useEffect(() => {
    stateRef.current = { isPlaying, speed, temperature, gravity, brush, brushSize };
  }, [isPlaying, speed, temperature, gravity, brush, brushSize]);

  const seedPreset = useCallback((p: string) => {
    const g = new Uint8Array(GRID_W * GRID_H);
    const setCell = (x: number, y: number, m: number) => {
      if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
        g[y * GRID_W + x] = m;
      }
    };

    if (p === 'glacier') {
      setTemperature(-12);
      for (let x = 20; x < 160; x++) {
        setCell(x, 96, STONE);
        setCell(x, 97, STONE);
      }
      for (let y = 24; y < 58; y++) {
        for (let x = 55; x < 125; x++) {
          setCell(x, y, ICE);
        }
      }
      for (let y = 78; y < 96; y++) {
        for (let x = 30; x < 150; x++) {
          setCell(x, y, WATER);
        }
      }
    } else if (p === 'stratified') {
      setTemperature(24);
      for (let x = 35; x < 145; x++) {
        setCell(x, 98, STONE);
        setCell(x, 99, STONE);
      }
      for (let y = 50; y < 98; y++) {
        setCell(35, y, STONE);
        setCell(144, y, STONE);
      }
      for (let y = 68; y < 82; y++) {
        for (let x = 40; x < 140; x++) setCell(x, y, WATER);
      }
      for (let y = 56; y < 66; y++) {
        for (let x = 40; x < 140; x++) setCell(x, y, OIL);
      }
      for (let y = 26; y < 38; y++) {
        for (let x = 70; x < 110; x++) setCell(x, y, SAND);
      }
    } else {
      // Default thermal basin
      setTemperature(22);
      for (let x = 24; x < 156; x++) {
        setCell(x, 96, STONE);
        setCell(x, 97, STONE);
      }
      for (let y = 62; y < 96; y++) {
        setCell(24, y, STONE);
        setCell(155, y, STONE);
      }
      for (let y = 74; y < 96; y++) {
        for (let x = 30; x < 150; x++) setCell(x, y, WATER);
      }
      for (let y = 24; y < 44; y++) {
        for (let x = 70; x < 110; x++) {
          if (Math.random() > 0.2) setCell(x, y, SAND);
        }
      }
    }

    gridRef.current = g;
    simTimeRef.current = 0;
    setSeriesData([]);
    setPreset(p);
  }, []);

  useEffect(() => {
    seedPreset('basin');
  }, [seedPreset]);

  const paintBrush = useCallback((gx: number, gy: number) => {
    const g = gridRef.current;
    const { brush: mat, brushSize: r } = stateRef.current;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
            if (mat === EMPTY || Math.random() > 0.15 || mat === STONE || mat === WOOD || mat === ICE) {
              g[ny * GRID_W + nx] = mat;
            }
          }
        }
      }
    }
  }, []);

  const stepGrid = useCallback(() => {
    const g = gridRef.current;
    const { temperature: temp, gravity: grav } = stateRef.current;
    const fallDir = grav >= 0 ? 1 : -1;

    // Paint continuously while pointer is held
    if (drawingRef.current && pointerPosRef.current) {
      paintBrush(pointerPosRef.current.gx, pointerPosRef.current.gy);
    }

    const swap = (i: number, j: number) => {
      const tmp = g[i];
      g[i] = g[j];
      g[j] = tmp;
    };

    const yStart = fallDir > 0 ? GRID_H - 2 : 1;
    const yEnd = fallDir > 0 ? -1 : GRID_H;
    const yStep = fallDir > 0 ? -1 : 1;

    for (let y = yStart; y !== yEnd; y += yStep) {
      const leftToRight = Math.random() > 0.5;
      for (let ix = 0; ix < GRID_W; ix++) {
        const x = leftToRight ? ix : GRID_W - 1 - ix;
        const idx = y * GRID_W + x;
        const cell = g[idx];
        if (cell === EMPTY || cell === STONE || cell === WOOD) continue;

        // Thermal phase changes
        if (cell === WATER) {
          if (temp <= 0 && Math.random() < Math.min(0.15, (0 - temp) * 0.004)) {
            g[idx] = ICE;
            continue;
          }
          if (temp >= 100 && Math.random() < Math.min(0.2, (temp - 95) * 0.005)) {
            g[idx] = STEAM;
            continue;
          }
        } else if (cell === ICE) {
          if (temp > 2 && Math.random() < Math.min(0.12, (temp - 2) * 0.0025)) {
            g[idx] = WATER;
            continue;
          }
        } else if (cell === STEAM) {
          if (temp < 92 && Math.random() < Math.min(0.08, (92 - temp) * 0.0015)) {
            g[idx] = WATER;
            continue;
          }
        }

        const ny = y + fallDir;
        if (ny < 0 || ny >= GRID_H) continue;
        const belowIdx = ny * GRID_W + x;
        const below = g[belowIdx];

        if (cell === SAND) {
          if (below === EMPTY || below === WATER || below === OIL || below === STEAM) {
            swap(idx, belowIdx);
          } else {
            const dir = Math.random() > 0.5 ? 1 : -1;
            const nx = x + dir;
            if (nx >= 0 && nx < GRID_W) {
              const diag = ny * GRID_W + nx;
              if (g[diag] === EMPTY || g[diag] === WATER || g[diag] === OIL) {
                swap(idx, diag);
              }
            }
          }
        } else if (cell === WATER) {
          if (below === EMPTY || below === OIL || below === STEAM) {
            swap(idx, belowIdx);
          } else {
            const dir = Math.random() > 0.5 ? 1 : -1;
            const nx = x + dir;
            if (nx >= 0 && nx < GRID_W) {
              const diag = ny * GRID_W + nx;
              const side = y * GRID_W + nx;
              if (g[diag] === EMPTY || g[diag] === OIL) swap(idx, diag);
              else if (g[side] === EMPTY || g[side] === OIL) swap(idx, side);
            }
          }
        } else if (cell === OIL) {
          if (below === EMPTY || below === STEAM) {
            swap(idx, belowIdx);
          } else {
            const dir = Math.random() > 0.5 ? 1 : -1;
            const nx = x + dir;
            if (nx >= 0 && nx < GRID_W) {
              const diag = ny * GRID_W + nx;
              const side = y * GRID_W + nx;
              if (g[diag] === EMPTY) swap(idx, diag);
              else if (g[side] === EMPTY) swap(idx, side);
            }
          }
        } else if (cell === ICE) {
          if (below === EMPTY) {
            swap(idx, belowIdx);
          }
        } else if (cell === STEAM) {
          const upY = y - fallDir;
          if (upY >= 0 && upY < GRID_H) {
            const drift = Math.random() > 0.5 ? 1 : -1;
            const tx = Math.max(0, Math.min(GRID_W - 1, x + (Math.random() > 0.5 ? drift : 0)));
            const upIdx = upY * GRID_W + tx;
            if (g[upIdx] === EMPTY || g[upIdx] === WATER || g[upIdx] === OIL) {
              swap(idx, upIdx);
            }
          }
        }
      }
    }

    simTimeRef.current += 0.016;
  }, [paintBrush]);

  const sampleTelemetry = useCallback(() => {
    const g = gridRef.current;
    let solids = 0;
    let liquids = 0;
    let gases = 0;
    for (let i = 0; i < g.length; i++) {
      const c = g[i];
      if (c === SAND || c === ICE || c === STONE || c === WOOD) solids++;
      else if (c === WATER || c === OIL) liquids++;
      else if (c === STEAM) gases++;
    }
    const { temperature: temp, gravity: grav } = stateRef.current;
    setSimTime(simTimeRef.current);
    setMetrics([
      { id: 's', label: 'Solid Cells', value: String(solids), unit: 'cells', tone: 'amber' },
      { id: 'l', label: 'Liquid Cells', value: String(liquids), unit: 'cells', tone: 'cyan' },
      { id: 'g', label: 'Gas Cells', value: String(gases), unit: 'cells', tone: 'neutral' },
      { id: 't', label: 'Ambient Temp / g', value: `${temp}°C · ${grav.toFixed(1)}g`, unit: '', tone: 'emerald' },
    ]);
    setSeriesData((prev) => {
      const next = [...prev, { t: +simTimeRef.current.toFixed(2), solids, liquids, gases }];
      return next.length > 75 ? next.slice(next.length - 75) : next;
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

    if (!offscreenRef.current) {
      const off = document.createElement('canvas');
      off.width = GRID_W;
      off.height = GRID_H;
      offscreenRef.current = off;
    }
    const offCanvas = offscreenRef.current;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;
    const imgData = offCtx.createImageData(GRID_W, GRID_H);

    let animId = 0;
    let acc = 0;
    let telAcc = 0;
    let lastTs = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;

      const s = stateRef.current;
      if (s.isPlaying) {
        acc += dt * s.speed * Math.max(0.4, Math.abs(s.gravity));
        let steps = 0;
        while (acc >= 0.016 && steps < 3) {
          stepGrid();
          acc -= 0.016;
          steps++;
        }
        telAcc += dt;
        if (telAcc >= 0.15) {
          telAcc = 0;
          sampleTelemetry();
        }
      } else if (drawingRef.current && pointerPosRef.current) {
        paintBrush(pointerPosRef.current.gx, pointerPosRef.current.gy);
      }

      // Render cellular grid to offscreen ImageData
      const g = gridRef.current;
      const data = imgData.data;
      for (let i = 0; i < g.length; i++) {
        const p = i * 4;
        const m = g[i];
        if (m === EMPTY) {
          data[p] = 5;
          data[p + 1] = 8;
          data[p + 2] = 17;
          data[p + 3] = 255;
        } else if (m === SAND) {
          data[p] = 234;
          data[p + 1] = 179;
          data[p + 2] = 8;
          data[p + 3] = 255;
        } else if (m === WATER) {
          data[p] = 14;
          data[p + 1] = 165;
          data[p + 2] = 233;
          data[p + 3] = 255;
        } else if (m === ICE) {
          data[p] = 186;
          data[p + 1] = 230;
          data[p + 2] = 253;
          data[p + 3] = 255;
        } else if (m === STEAM) {
          data[p] = 203;
          data[p + 1] = 213;
          data[p + 2] = 225;
          data[p + 3] = 255;
        } else if (m === STONE) {
          data[p] = 71;
          data[p + 1] = 85;
          data[p + 2] = 105;
          data[p + 3] = 255;
        } else if (m === OIL) {
          data[p] = 161;
          data[p + 1] = 98;
          data[p + 2] = 7;
          data[p + 3] = 255;
        } else if (m === WOOD) {
          data[p] = 146;
          data[p + 1] = 64;
          data[p + 2] = 14;
          data[p + 3] = 255;
        }
      }
      offCtx.putImageData(imgData, 0, 0);

      const parent = canvas.parentElement;
      if (parent) {
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offCanvas, 0, 0, w, h);
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [paintBrush, sampleTelemetry, stepGrid]);

  const updatePointerCell = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const gx = Math.floor(((clientX - rect.left) / rect.width) * GRID_W);
    const gy = Math.floor(((clientY - rect.top) / rect.height) * GRID_H);
    pointerPosRef.current = { gx, gy };
  };

  return (
    <SimulationWorkspace
      simId="elements"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {
        setIsPlaying(false);
        stepGrid();
        sampleTelemetry();
      }}
      onReset={() => seedPreset(preset)}
      onClear={() => {
        gridRef.current = new Uint8Array(GRID_W * GRID_H);
        simTimeRef.current = 0;
        setSeriesData([]);
        sampleTelemetry();
      }}
      speed={speed}
      onSpeedChange={setSpeed}
      zoom={zoom}
      onZoomChange={setZoom}
      simTime={simTime}
      metrics={metrics}
      seriesData={seriesData}
      chartTitle="Active Matter Phases Over Time"
      chartSeries={[
        { key: 'solids', label: 'Solids', color: '#F59E0B' },
        { key: 'liquids', label: 'Liquids', color: '#06B6D4' },
        { key: 'gases', label: 'Gas (Steam)', color: '#CBD5E1' },
      ]}
      currentParams={{ preset, temperature, gravity, brushSize }}
      hintText="Click and drag on the canvas to paint or erase materials."
      onOpenLearn={onOpenLearn}
      toolbarExtra={
        <div className="flex flex-wrap items-center gap-1">
          {MATERIAL_META.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setBrush(m.id)}
              className={`px-2 py-1 rounded-sm text-[11px] font-medium flex items-center gap-1.5 cursor-pointer ${
                brush === m.id
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/50'
                  : 'text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-xs border border-slate-600"
                style={{ backgroundColor: m.color }}
              />
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      }
      controlsPanel={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Sandbox Preset</label>
            <select
              value={preset}
              onChange={(e) => seedPreset(e.target.value)}
              className="w-full px-2.5 py-2 rounded-md bg-[#070B14] border border-slate-700 text-xs text-slate-100"
            >
              <option value="basin">Thermal Water Basin</option>
              <option value="glacier">Melting Ice Glacier</option>
              <option value="stratified">Density Stratified Layers</option>
            </select>
          </div>

          <SliderControl
            label="Ambient Temperature"
            value={temperature}
            min={-40}
            max={150}
            step={1}
            precision={0}
            unit="°C"
            tooltip="Below 0 C freezes water into ice; above 100 C boils water into rising steam."
            onChange={setTemperature}
          />
          <SliderControl
            label="Gravity Factor"
            value={gravity}
            min={-1.5}
            max={2.0}
            step={0.1}
            precision={1}
            unit="g"
            onChange={setGravity}
          />
          <SliderControl
            label="Brush Radius"
            value={brushSize}
            min={1}
            max={12}
            step={1}
            precision={0}
            unit="cells"
            onChange={setBrushSize}
          />
        </div>
      }
    >
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          drawingRef.current = true;
          updatePointerCell(e.clientX, e.clientY);
          if (pointerPosRef.current) paintBrush(pointerPosRef.current.gx, pointerPosRef.current.gy);
        }}
        onPointerMove={(e) => updatePointerCell(e.clientX, e.clientY)}
        onPointerUp={() => {
          drawingRef.current = false;
        }}
        onPointerLeave={() => {
          drawingRef.current = false;
        }}
        className="w-full h-full block cursor-crosshair touch-none"
      />
    </SimulationWorkspace>
  );
};
