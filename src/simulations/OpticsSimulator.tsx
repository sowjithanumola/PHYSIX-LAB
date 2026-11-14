import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

type OpticalElementType = 'mirror-plane' | 'mirror-concave' | 'lens-convex' | 'lens-concave' | 'prism';

interface OpticalElement {
  id: string;
  type: OpticalElementType;
  x: number;
  y: number;
  angle: number; // radians
  size: number;
  ior: number; // refractive index
  focalLength: number; // for thin lenses/concave mirror
}

interface LightSource {
  id: string;
  mode: 'single' | 'parallel' | 'fan' | 'white';
  x: number;
  y: number;
  angle: number;
}

interface OpticsSimulatorProps {
  initialParams?: Record<string, unknown>;
  presetId?: string;
  onOpenLearn?: () => void;
}

function createPresetOptics(preset: string): { source: LightSource; elements: OpticalElement[] } {
  if (preset === 'convex-focus') {
    return {
      source: { id: 'src', mode: 'parallel', x: -260, y: 0, angle: 0 },
      elements: [
        { id: 'e1', type: 'lens-convex', x: -20, y: 0, angle: 0, size: 150, ior: 1.52, focalLength: 160 },
        { id: 'e2', type: 'mirror-plane', x: 240, y: 0, angle: -0.35, size: 140, ior: 1.5, focalLength: 120 },
      ],
    };
  }
  if (preset === 'concave-mirror') {
    return {
      source: { id: 'src', mode: 'parallel', x: -220, y: 0, angle: 0 },
      elements: [
        { id: 'e1', type: 'mirror-concave', x: 180, y: 0, angle: 0, size: 180, ior: 1.5, focalLength: 150 },
      ],
    };
  }
  if (preset === 'tir') {
    return {
      source: { id: 'src', mode: 'single', x: -250, y: -30, angle: 0.25 },
      elements: [
        { id: 'e1', type: 'prism', x: -10, y: 10, angle: 0.1, size: 150, ior: 1.75, focalLength: 120 },
      ],
    };
  }
  // Default: prism-dispersion
  return {
    source: { id: 'src', mode: 'white', x: -260, y: 15, angle: -0.04 },
    elements: [
      { id: 'e1', type: 'prism', x: -15, y: 0, angle: 0, size: 145, ior: 1.58, focalLength: 120 },
      { id: 'e2', type: 'mirror-plane', x: 245, y: 70, angle: 0.4, size: 140, ior: 1.5, focalLength: 120 },
    ],
  };
}

export const OpticsSimulator: React.FC<OpticsSimulatorProps> = ({
  initialParams,
  presetId,
  onOpenLearn,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preset, setPreset] = useState((initialParams?.preset as string) || presetId || 'prism-dispersion');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string>('e1');
  const [selectedSnap, setSelectedSnap] = useState<OpticalElement | null>(null);
  const [sourceSnap, setSourceSnap] = useState<LightSource>(() => createPresetOptics(preset).source);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);

  const sourceRef = useRef<LightSource>(createPresetOptics(preset).source);
  const elementsRef = useRef<OpticalElement[]>(createPresetOptics(preset).elements);
  const dragTargetRef = useRef<'src' | string | null>(null);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const loadPreset = useCallback((p: string) => {
    setPreset(p);
    const data = createPresetOptics(p);
    sourceRef.current = data.source;
    elementsRef.current = data.elements;
    setSourceSnap({ ...data.source });
    const first = data.elements[0] || null;
    setSelectedId(first?.id || 'src');
    setSelectedSnap(first ? { ...first } : null);
  }, []);

  useEffect(() => {
    loadPreset(preset);
  }, [loadPreset, preset]);

  const dispersionSeries = useMemo<TelemetrySeriesPoint[]>(() => {
    const baseIor = selectedSnap?.ior || 1.52;
    const wavelengths = [400, 450, 500, 550, 600, 650, 700];
    return wavelengths.map((wl) => {
      // Cauchy approximation n(lambda) = A + B / lambda^2
      const n = baseIor + 0.014 / (wl / 550) ** 2 - 0.014;
      return { t: wl, ior: +n.toFixed(4) };
    });
  }, [selectedSnap?.ior]);

  // Ray-segment intersection helper
  const intersectSegment = (
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    ax: number,
    ay: number,
    bx: number,
    by: number
  ) => {
    const sx = bx - ax;
    const sy = by - ay;
    const denom = dx * sy - dy * sx;
    if (Math.abs(denom) < 1e-6) return null;
    const t = ((ax - ox) * sy - (ay - oy) * sx) / denom;
    const u = ((ax - ox) * dy - (ay - oy) * dx) / denom;
    if (t > 0.5 && u >= 0 && u <= 1) {
      const len = Math.hypot(sx, sy);
      let nx = -sy / len;
      let ny = sx / len;
      if (dx * nx + dy * ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      return { t, u, x: ox + dx * t, y: oy + dy * t, nx, ny };
    }
    return null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;

    const renderScene = () => {
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

        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(zoomRef.current, zoomRef.current);

        // Optical bench grid
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
        ctx.lineWidth = 1;
        for (let x = -480; x <= 480; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, -300);
          ctx.lineTo(x, 300);
          ctx.stroke();
        }
        for (let y = -280; y <= 280; y += 40) {
          ctx.beginPath();
          ctx.moveTo(-480, y);
          ctx.lineTo(480, y);
          ctx.stroke();
        }

        // Build ray segments for all elements
        const src = sourceRef.current;
        const elems = elementsRef.current;

        const initialRays: { ox: number; oy: number; dx: number; dy: number; color: string; wlOffset: number }[] = [];
        if (src.mode === 'single') {
          initialRays.push({
            ox: src.x,
            oy: src.y,
            dx: Math.cos(src.angle),
            dy: Math.sin(src.angle),
            color: '#22D3EE',
            wlOffset: 0,
          });
        } else if (src.mode === 'parallel') {
          const px = -Math.sin(src.angle);
          const py = Math.cos(src.angle);
          for (let i = -2; i <= 2; i++) {
            initialRays.push({
              ox: src.x + px * i * 24,
              oy: src.y + py * i * 24,
              dx: Math.cos(src.angle),
              dy: Math.sin(src.angle),
              color: '#22D3EE',
              wlOffset: 0,
            });
          }
        } else if (src.mode === 'fan') {
          for (let i = -3; i <= 3; i++) {
            const a = src.angle + i * 0.08;
            initialRays.push({
              ox: src.x,
              oy: src.y,
              dx: Math.cos(a),
              dy: Math.sin(a),
              color: '#38BDF8',
              wlOffset: 0,
            });
          }
        } else {
          // White light spectral rays for prism dispersion
          const spectrum = [
            { color: '#EF4444', wl: -0.045 },
            { color: '#F59E0B', wl: -0.022 },
            { color: '#10B981', wl: 0.0 },
            { color: '#06B6D4', wl: 0.028 },
            { color: '#3B82F6', wl: 0.055 },
          ];
          for (const sp of spectrum) {
            initialRays.push({
              ox: src.x,
              oy: src.y,
              dx: Math.cos(src.angle),
              dy: Math.sin(src.angle),
              color: sp.color,
              wlOffset: sp.wl,
            });
          }
        }

        // Precompute element geometry edges
        const elementEdges = elems.map((el) => {
          const cos = Math.cos(el.angle);
          const sin = Math.sin(el.angle);
          const half = el.size / 2;
          if (el.type === 'prism') {
            const hTri = el.size * 0.866;
            const pts = [
              { x: 0, y: -hTri * 0.58 },
              { x: -half, y: hTri * 0.42 },
              { x: half, y: hTri * 0.42 },
            ].map((p) => ({
              x: el.x + p.x * cos - p.y * sin,
              y: el.y + p.x * sin + p.y * cos,
            }));
            return {
              el,
              segments: [
                [pts[0], pts[1]],
                [pts[1], pts[2]],
                [pts[2], pts[0]],
              ],
            };
          }
          // Line element perpendicular to el.angle
          const p1 = { x: el.x - sin * half, y: el.y + cos * half };
          const p2 = { x: el.x + sin * half, y: el.y - cos * half };
          return { el, segments: [[p1, p2]] };
        });

        let totalBounces = 0;
        let lastIncidentDeg = 0;

        // Trace each ray recursively up to 6 bounces
        for (const baseRay of initialRays) {
          let ox = baseRay.ox;
          let oy = baseRay.oy;
          let dx = baseRay.dx;
          let dy = baseRay.dy;
          let insideGlass = false;

          ctx.strokeStyle = baseRay.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox, oy);

          for (let bounce = 0; bounce < 7; bounce++) {
            let bestHit: {
              t: number;
              u: number;
              x: number;
              y: number;
              nx: number;
              ny: number;
              el: OpticalElement;
            } | null = null;

            for (const item of elementEdges) {
              for (const [a, b] of item.segments) {
                const hit = intersectSegment(ox, oy, dx, dy, a.x, a.y, b.x, b.y);
                if (hit && (!bestHit || hit.t < bestHit.t)) {
                  bestHit = { ...hit, el: item.el };
                }
              }
            }

            if (!bestHit) {
              ctx.lineTo(ox + dx * 900, oy + dy * 900);
              break;
            }

            totalBounces++;
            ctx.lineTo(bestHit.x, bestHit.y);
            ox = bestHit.x;
            oy = bestHit.y;

            const el = bestHit.el;
            const cosI = -(dx * bestHit.nx + dy * bestHit.ny);
            lastIncidentDeg = (Math.acos(Math.min(1, Math.max(-1, cosI))) * 180) / Math.PI;

            if (el.type === 'mirror-plane') {
              const dot = dx * bestHit.nx + dy * bestHit.ny;
              dx = dx - 2 * dot * bestHit.nx;
              dy = dy - 2 * dot * bestHit.ny;
            } else if (el.type === 'mirror-concave') {
              // Parabolic concave reflection bending toward focal point
              const offset = (bestHit.u - 0.5) * el.size;
              const bend = -offset / Math.max(40, el.focalLength);
              const cosB = Math.cos(bend);
              const sinB = Math.sin(bend);
              const rnx = bestHit.nx * cosB - bestHit.ny * sinB;
              const rny = bestHit.nx * sinB + bestHit.ny * cosB;
              const dot = dx * rnx + dy * rny;
              dx = dx - 2 * dot * rnx;
              dy = dy - 2 * dot * rny;
            } else if (el.type === 'lens-convex' || el.type === 'lens-concave') {
              // Thin lens deflection: delta_theta = -y_local / f (with IOR scaling)
              const offset = (bestHit.u - 0.5) * el.size;
              const iorScale = (el.ior - 1) / 0.52;
              const fEff = el.focalLength / Math.max(0.2, iorScale);
              const sign = el.type === 'lens-convex' ? -1 : 1;
              const dirSign = dx * Math.cos(el.angle) + dy * Math.sin(el.angle) >= 0 ? 1 : -1;
              const delta = sign * dirSign * Math.atan2(offset, fEff);
              const c = Math.cos(delta);
              const s = Math.sin(delta);
              const ndx = dx * c - dy * s;
              const ndy = dx * s + dy * c;
              const len = Math.hypot(ndx, ndy);
              dx = ndx / len;
              dy = ndy / len;
              ox += dx * 1.5;
              oy += dy * 1.5;
            } else if (el.type === 'prism') {
              const nGlass = el.ior + baseRay.wlOffset;
              const eta = insideGlass ? nGlass / 1.0 : 1.0 / nGlass;
              const k = 1 - eta * eta * (1 - cosI * cosI);
              if (k < 0) {
                // Total Internal Reflection
                const dot = dx * bestHit.nx + dy * bestHit.ny;
                dx = dx - 2 * dot * bestHit.nx;
                dy = dy - 2 * dot * bestHit.ny;
              } else {
                const factor = eta * cosI - Math.sqrt(k);
                dx = eta * dx + factor * bestHit.nx;
                dy = eta * dy + factor * bestHit.ny;
                const len = Math.hypot(dx, dy);
                dx /= len;
                dy /= len;
                insideGlass = !insideGlass;
              }
            }
          }
          ctx.stroke();
        }

        // Draw Optical Elements
        for (const item of elementEdges) {
          const el = item.el;
          const isSel = el.id === selectedId;
          ctx.save();
          if (el.type === 'prism') {
            const [s0, s1, s2] = item.segments;
            ctx.beginPath();
            ctx.moveTo(s0[0].x, s0[0].y);
            ctx.lineTo(s1[0].x, s1[0].y);
            ctx.lineTo(s2[0].x, s2[0].y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
            ctx.fill();
            ctx.strokeStyle = isSel ? '#F8FAFC' : '#38BDF8';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else {
            const [p1, p2] = item.segments[0];
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle =
              el.type.startsWith('mirror')
                ? isSel
                  ? '#F8FAFC'
                  : '#CBD5E1'
                : isSel
                ? '#67E8F9'
                : '#10B981';
            ctx.lineWidth = el.type.startsWith('mirror') ? 4.5 : 6;
            ctx.stroke();
          }
          ctx.restore();
        }

        // Draw Light Source Housing
        ctx.save();
        ctx.translate(src.x, src.y);
        ctx.rotate(src.angle);
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = selectedId === 'src' ? '#F8FAFC' : '#06B6D4';
        ctx.lineWidth = 2;
        ctx.fillRect(-16, -12, 32, 24);
        ctx.strokeRect(-16, -12, 32, 24);
        ctx.fillStyle = '#22D3EE';
        ctx.fillRect(14, -5, 4, 10);
        ctx.restore();

        ctx.restore();

        const activeIor = selectedSnap?.ior || 1.52;
        const critDeg = (Math.asin(Math.min(1, 1 / activeIor)) * 180) / Math.PI;
        setMetrics([
          { id: 'rays', label: 'Active Rays', value: String(initialRays.length), unit: 'beams', tone: 'cyan' },
          { id: 'hits', label: 'Surface Interactions', value: String(totalBounces), unit: 'events', tone: 'neutral' },
          { id: 'crit', label: 'Critical Angle (Glass->Air)', value: critDeg.toFixed(1), unit: 'deg', tone: 'amber' },
          { id: 'inc', label: 'Last Incident Angle', value: lastIncidentDeg.toFixed(1), unit: 'deg', tone: 'emerald' },
        ]);
      }

      animId = requestAnimationFrame(renderScene);
    };

    animId = requestAnimationFrame(renderScene);
    return () => cancelAnimationFrame(animId);
  }, [selectedId, selectedSnap?.ior]);

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
    if (Math.hypot(pt.x - sourceRef.current.x, pt.y - sourceRef.current.y) <= 28) {
      dragTargetRef.current = 'src';
      setSelectedId('src');
      setSelectedSnap(null);
      return;
    }
    const hit = elementsRef.current.find((el) => Math.hypot(el.x - pt.x, el.y - pt.y) <= el.size * 0.5);
    if (hit) {
      dragTargetRef.current = hit.id;
      setSelectedId(hit.id);
      setSelectedSnap({ ...hit });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragTargetRef.current) return;
    const pt = toWorld(e.clientX, e.clientY);
    if (dragTargetRef.current === 'src') {
      sourceRef.current.x = pt.x;
      sourceRef.current.y = pt.y;
      setSourceSnap({ ...sourceRef.current });
    } else {
      const el = elementsRef.current.find((item) => item.id === dragTargetRef.current);
      if (el) {
        el.x = pt.x;
        el.y = pt.y;
        setSelectedSnap({ ...el });
      }
    }
  };

  const addElement = (type: OpticalElementType) => {
    const id = `opt_${Date.now().toString(36)}`;
    const newEl: OpticalElement = {
      id,
      type,
      x: (Math.random() - 0.5) * 140,
      y: (Math.random() - 0.5) * 100,
      angle: 0,
      size: 140,
      ior: 1.55,
      focalLength: 150,
    };
    elementsRef.current.push(newEl);
    setSelectedId(id);
    setSelectedSnap({ ...newEl });
  };

  return (
    <SimulationWorkspace
      simId="optics"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {}}
      onReset={() => loadPreset(preset)}
      onClear={() => {
        elementsRef.current = [];
        setSelectedId('src');
        setSelectedSnap(null);
      }}
      speed={speed}
      onSpeedChange={setSpeed}
      zoom={zoom}
      onZoomChange={setZoom}
      simTime={0}
      metrics={metrics}
      seriesData={dispersionSeries}
      chartTitle="Cauchy Spectral Dispersion Curve (Refractive Index n vs Wavelength nm)"
      chartSeries={[{ key: 'ior', label: 'Refractive Index n(lambda)', color: '#10B981' }]}
      currentParams={{ preset }}
      hintText="Drag the light source or optical components; select an element to rotate or tune refractive index."
      onOpenLearn={onOpenLearn}
      toolbarExtra={
        <div className="flex flex-wrap items-center gap-1">
          {[
            { type: 'mirror-plane', label: '+ Plane Mirror' },
            { type: 'mirror-concave', label: '+ Concave Mirror' },
            { type: 'lens-convex', label: '+ Convex Lens' },
            { type: 'lens-concave', label: '+ Concave Lens' },
            { type: 'prism', label: '+ Prism' },
          ].map((btn) => (
            <button
              key={btn.type}
              type="button"
              onClick={() => addElement(btn.type as OpticalElementType)}
              className="px-2 py-1 rounded-sm border border-slate-800 hover:bg-slate-800 text-[11px] text-slate-200 cursor-pointer"
            >
              {btn.label}
            </button>
          ))}
        </div>
      }
      controlsPanel={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Optical Bench Preset</label>
            <select
              value={preset}
              onChange={(e) => loadPreset(e.target.value)}
              className="w-full px-2.5 py-2 rounded-md bg-[#070B14] border border-slate-700 text-xs text-slate-100"
            >
              <option value="prism-dispersion">Prism Dispersion (White Light)</option>
              <option value="convex-focus">Convex Lens Focal Point</option>
              <option value="concave-mirror">Concave Mirror Convergence</option>
              <option value="tir">Total Internal Reflection</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Light Source Mode</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'white', label: 'White Spectrum' },
                  { id: 'parallel', label: 'Parallel Rays' },
                  { id: 'single', label: 'Single Laser' },
                  { id: 'fan', label: 'Point Fan' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    sourceRef.current.mode = m.id;
                    setSourceSnap({ ...sourceRef.current });
                  }}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium cursor-pointer ${
                    sourceSnap.mode === m.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-[#070B14] text-slate-400 border border-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <SliderControl
            label="Source Beam Angle"
            value={(sourceSnap.angle * 180) / Math.PI}
            min={-60}
            max={60}
            step={1}
            precision={0}
            unit="deg"
            onChange={(deg) => {
              sourceRef.current.angle = (deg * Math.PI) / 180;
              setSourceSnap({ ...sourceRef.current });
            }}
          />
        </div>
      }
      inspectorPanel={
        selectedSnap ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-cyan-300 capitalize">
                {selectedSnap.type.replace('-', ' ')}
              </span>
              <button
                type="button"
                onClick={() => {
                  elementsRef.current = elementsRef.current.filter((e) => e.id !== selectedSnap.id);
                  setSelectedSnap(null);
                  setSelectedId('src');
                }}
                className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                Delete
              </button>
            </div>
            <SliderControl
              label="Rotation Angle"
              value={(selectedSnap.angle * 180) / Math.PI}
              min={-180}
              max={180}
              step={1}
              precision={0}
              unit="deg"
              onChange={(deg) => {
                const target = elementsRef.current.find((e) => e.id === selectedSnap.id);
                if (target) {
                  target.angle = (deg * Math.PI) / 180;
                  setSelectedSnap({ ...target });
                }
              }}
            />
            {(selectedSnap.type === 'prism' || selectedSnap.type.startsWith('lens')) && (
              <SliderControl
                label="Refractive Index (n)"
                value={selectedSnap.ior}
                min={1.1}
                max={2.4}
                step={0.01}
                precision={2}
                onChange={(v) => {
                  const target = elementsRef.current.find((e) => e.id === selectedSnap.id);
                  if (target) {
                    target.ior = v;
                    setSelectedSnap({ ...target });
                  }
                }}
              />
            )}
            {(selectedSnap.type.startsWith('lens') || selectedSnap.type === 'mirror-concave') && (
              <SliderControl
                label="Focal Length (f)"
                value={selectedSnap.focalLength}
                min={60}
                max={320}
                step={5}
                precision={0}
                unit="mm eq."
                onChange={(v) => {
                  const target = elementsRef.current.find((e) => e.id === selectedSnap.id);
                  if (target) {
                    target.focalLength = v;
                    setSelectedSnap({ ...target });
                  }
                }}
              />
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400">Select an optical element on the bench to edit rotation, IOR, or focal length.</div>
        )
      }
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          dragTargetRef.current = null;
        }}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
      />
    </SimulationWorkspace>
  );
};
