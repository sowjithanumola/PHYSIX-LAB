import React, { useCallback, useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl, ToggleControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

interface BodyVisualMeta {
  id: string;
  bodyId: number;
  name: string;
  kind: 'star' | 'planet' | 'moon';
  radius: number;
  color: string;
  trail: { x: number; y: number }[];
  fx: number;
  fy: number;
}

interface PresetBodySpec {
  id: string;
  name: string;
  kind: 'star' | 'planet' | 'moon';
  x: number;
  y: number;
  vx: number; // px/s
  vy: number; // px/s
  mass: number;
  radius: number;
  color: string;
}

interface GravitySimulatorProps {
  initialParams?: Record<string, unknown>;
  presetId?: string;
  onOpenLearn?: () => void;
}

const SUB_HZ = 120;
const SUB_MS = 1000 / SUB_HZ;

function getPresetSpecs(preset: string): PresetBodySpec[] {
  if (preset === 'binary-stars') {
    return [
      {
        id: 'star-a',
        name: 'Alpha Star',
        kind: 'star',
        x: -95,
        y: 0,
        vx: 0,
        vy: -25.8,
        mass: 420,
        radius: 17,
        color: '#F59E0B',
      },
      {
        id: 'star-b',
        name: 'Beta Star',
        kind: 'star',
        x: 95,
        y: 0,
        vx: 0,
        vy: 25.8,
        mass: 420,
        radius: 15,
        color: '#38BDF8',
      },
      {
        id: 'planet-outer',
        name: 'Circumbinary Planet',
        kind: 'planet',
        x: 0,
        y: -250,
        vx: 50.2,
        vy: 0,
        mass: 1.8,
        radius: 7,
        color: '#10B981',
      },
    ];
  }

  if (preset === 'solar-system') {
    return [
      {
        id: 'sun',
        name: 'Central Sun',
        kind: 'star',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        mass: 1000,
        radius: 22,
        color: '#F59E0B',
      },
      {
        id: 'p1',
        name: 'Inner Rocky',
        kind: 'planet',
        x: 95,
        y: 0,
        vx: 0,
        vy: 56.2,
        mass: 0.6,
        radius: 5.5,
        color: '#94A3B8',
      },
      {
        id: 'p2',
        name: 'Temperate World',
        kind: 'planet',
        x: 0,
        y: -165,
        vx: -42.6,
        vy: 0,
        mass: 2.2,
        radius: 8.5,
        color: '#06B6D4',
      },
      {
        id: 'p3',
        name: 'Gas Giant',
        kind: 'planet',
        x: -245,
        y: 0,
        vx: 0,
        vy: -34.9,
        mass: 14,
        radius: 12.5,
        color: '#3B82F6',
      },
    ];
  }

  if (preset === 'slingshot') {
    return [
      {
        id: 'sun',
        name: 'Primary Star',
        kind: 'star',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        mass: 950,
        radius: 20,
        color: '#F59E0B',
      },
      {
        id: 'giant',
        name: 'Jovian Body',
        kind: 'planet',
        x: 160,
        y: 0,
        vx: 0,
        vy: 42.2,
        mass: 48,
        radius: 13,
        color: '#3B82F6',
      },
      {
        id: 'probe',
        name: 'Flyby Craft',
        kind: 'moon',
        x: -230,
        y: 125,
        vx: 31,
        vy: -13,
        mass: 0.08,
        radius: 5,
        color: '#10B981',
      },
    ];
  }

  // Default: sun-earth-moon (Sun, Planet, and Moon showing gravitational attraction)
  return [
    {
      id: 'sun',
      name: 'Sun',
      kind: 'star',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      mass: 950,
      radius: 22,
      color: '#F59E0B',
    },
    {
      id: 'earth',
      name: 'Planet Terra',
      kind: 'planet',
      x: 180,
      y: 0,
      vx: 0,
      vy: 39.8,
      mass: 16,
      radius: 10,
      color: '#06B6D4',
    },
    {
      id: 'moon',
      name: 'Moon',
      kind: 'moon',
      x: 204,
      y: 0,
      vx: 0,
      vy: 54.0,
      mass: 0.25,
      radius: 4.5,
      color: '#E2E8F0',
    },
  ];
}

export const GravitySimulator: React.FC<GravitySimulatorProps> = ({
  initialParams,
  presetId,
  onOpenLearn,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preset, setPreset] = useState<string>(
    (initialParams?.preset as string) || presetId || 'sun-earth-moon'
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(Number(initialParams?.speed ?? 1));
  const [zoom, setZoom] = useState<number>(1);
  const [gravStrength, setGravStrength] = useState<number>(Number(initialParams?.gravStrength ?? 300));
  const [showTrails, setShowTrails] = useState(true);
  const [showForceVectors, setShowForceVectors] = useState(true);
  const [showVelocityVectors, setShowVelocityVectors] = useState(false);
  const [spawnKind, setSpawnKind] = useState<'planet' | 'moon' | 'star'>('planet');
  const [simTime, setSimTime] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>('earth');
  const [selectedSnap, setSelectedSnap] = useState<{
    id: string;
    name: string;
    mass: number;
    radius: number;
    vx: number;
    vy: number;
  } | null>(null);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [seriesData, setSeriesData] = useState<TelemetrySeriesPoint[]>([]);

  const engineRef = useRef<Matter.Engine | null>(null);
  const metaListRef = useRef<BodyVisualMeta[]>([]);
  const simTimeRef = useRef(0);
  const subAccRef = useRef(0);

  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const zoomRef = useRef(zoom);
  const gRef = useRef(gravStrength);
  const showTrailsRef = useRef(showTrails);
  const showForcesRef = useRef(showForceVectors);
  const showVelRef = useRef(showVelocityVectors);
  const selectedIdRef = useRef(selectedId);

  const dragSpawnRef = useRef<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    active: boolean;
  }>({ startX: 0, startY: 0, curX: 0, curY: 0, active: false });

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    gRef.current = gravStrength;
  }, [gravStrength]);
  useEffect(() => {
    showTrailsRef.current = showTrails;
  }, [showTrails]);
  useEffect(() => {
    showForcesRef.current = showForceVectors;
  }, [showForceVectors]);
  useEffect(() => {
    showVelRef.current = showVelocityVectors;
  }, [showVelocityVectors]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const addBodyToMatterWorld = useCallback(
    (engine: Matter.Engine, spec: PresetBodySpec): BodyVisualMeta => {
      const body = Matter.Bodies.circle(spec.x, spec.y, spec.radius, {
        friction: 0,
        frictionAir: 0,
        frictionStatic: 0,
        restitution: 0.85,
        inertia: Infinity,
      });
      Matter.Body.setMass(body, spec.mass);
      Matter.Body.setVelocity(body, { x: spec.vx / SUB_HZ, y: spec.vy / SUB_HZ });
      Matter.Composite.add(engine.world, body);
      return {
        id: spec.id,
        bodyId: body.id,
        name: spec.name,
        kind: spec.kind,
        radius: spec.radius,
        color: spec.color,
        trail: [],
        fx: 0,
        fy: 0,
      };
    },
    []
  );

  const applyGravitationalForces = useCallback((engine: Matter.Engine, G: number) => {
    const bodies = Matter.Composite.allBodies(engine.world);
    const metas = metaListRef.current;
    const eps2 = 36;

    for (const m of metas) {
      m.fx = 0;
      m.fy = 0;
    }

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const dist2 = dx * dx + dy * dy + eps2;
        const dist = Math.sqrt(dist2);
        const fMag = (G * a.mass * b.mass) / dist2;
        const fx = (fMag * dx) / dist;
        const fy = (fMag * dy) / dist;

        // Scale N -> Matter.js force units for fixed 1/120s sub-step (1e-6)
        Matter.Body.applyForce(a, a.position, { x: fx * 1e-6, y: fy * 1e-6 });
        Matter.Body.applyForce(b, b.position, { x: -fx * 1e-6, y: -fy * 1e-6 });

        const ma = metas.find((m) => m.bodyId === a.id);
        const mb = metas.find((m) => m.bodyId === b.id);
        if (ma) {
          ma.fx += fx;
          ma.fy += fy;
        }
        if (mb) {
          mb.fx -= fx;
          mb.fy -= fy;
        }
      }
    }
  }, []);

  const stepMatterPhysics = useCallback(
    (dtSec: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const G = gRef.current;

      subAccRef.current += dtSec * SUB_HZ;
      let steps = Math.floor(subAccRef.current);
      if (steps > 12) steps = 12;
      subAccRef.current -= steps;

      for (let s = 0; s < steps; s++) {
        applyGravitationalForces(engine, G);
        Matter.Engine.update(engine, SUB_MS);
        simTimeRef.current += 1 / SUB_HZ;
      }

      if (steps > 0) {
        const bodies = Matter.Composite.allBodies(engine.world);
        for (const m of metaListRef.current) {
          const b = bodies.find((x) => x.id === m.bodyId);
          if (b) {
            m.trail.push({ x: b.position.x, y: b.position.y });
            if (m.trail.length > 260) m.trail.shift();
          }
        }
      }
    },
    [applyGravitationalForces]
  );

  const sampleTelemetry = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const bodies = Matter.Composite.allBodies(engine.world);
    const metas = metaListRef.current;
    const G = gRef.current;

    let ke = 0;
    let pe = 0;
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      const vx = a.velocity.x * SUB_HZ;
      const vy = a.velocity.y * SUB_HZ;
      ke += 0.5 * a.mass * (vx * vx + vy * vy);
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        const r = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y) + 6;
        pe -= (G * a.mass * b.mass) / r;
      }
    }
    const totalE = ke + pe;

    const selMeta = metas.find((m) => m.id === selectedIdRef.current) || metas[0] || null;
    const selBody = selMeta ? bodies.find((b) => b.id === selMeta.bodyId) || null : null;

    if (selMeta && selBody) {
      setSelectedSnap({
        id: selMeta.id,
        name: selMeta.name,
        mass: selBody.mass,
        radius: selMeta.radius,
        vx: selBody.velocity.x * SUB_HZ,
        vy: selBody.velocity.y * SUB_HZ,
      });
    } else {
      setSelectedSnap(null);
    }

    setSimTime(simTimeRef.current);

    const selSpeed = selBody ? Math.hypot(selBody.velocity.x * SUB_HZ, selBody.velocity.y * SUB_HZ) : 0;
    const selDist = selBody ? Math.hypot(selBody.position.x, selBody.position.y) : 0;

    setMetrics([
      { id: 'ke', label: 'Kinetic Energy', value: ke.toFixed(0), unit: 'J eq.', tone: 'cyan' },
      { id: 'pe', label: 'Potential Energy', value: pe.toFixed(0), unit: 'J eq.', tone: 'amber' },
      { id: 'tot', label: 'Total Energy', value: totalE.toFixed(0), unit: 'J eq.', tone: 'emerald' },
      {
        id: 'spd',
        label: selMeta ? `${selMeta.name} Speed / Dist` : 'Bodies',
        value: selMeta ? `${selSpeed.toFixed(1)} / ${selDist.toFixed(0)}` : String(bodies.length),
        unit: selMeta ? 'u/s · u' : 'count',
        tone: 'neutral',
      },
    ]);

    setSeriesData((prev) => {
      const next = [
        ...prev,
        {
          t: +simTimeRef.current.toFixed(2),
          ke: +ke.toFixed(1),
          pe: +pe.toFixed(1),
          total: +totalE.toFixed(1),
        },
      ];
      return next.length > 90 ? next.slice(next.length - 90) : next;
    });
  }, []);

  const loadPreset = useCallback(
    (p: string) => {
      setPreset(p);
      const engine = Matter.Engine.create({
        gravity: { x: 0, y: 0, scale: 0 },
      });
      engine.positionIterations = 6;
      engine.velocityIterations = 6;

      const specs = getPresetSpecs(p);
      metaListRef.current = specs.map((sp) => addBodyToMatterWorld(engine, sp));
      engineRef.current = engine;
      simTimeRef.current = 0;
      subAccRef.current = 0;
      setSeriesData([]);
      setSelectedId(specs[1]?.id || specs[0]?.id || null);
      applyGravitationalForces(engine, gRef.current);
      sampleTelemetry();
    },
    [addBodyToMatterWorld, applyGravitationalForces, sampleTelemetry]
  );

  useEffect(() => {
    loadPreset(preset);
  }, [loadPreset, preset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTs = performance.now();
    let telemetryAcc = 0;

    const renderFrame = (now: number) => {
      const rawDt = Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;

      const parent = canvas.parentElement;
      const engine = engineRef.current;
      if (parent && engine) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (isPlayingRef.current) {
          stepMatterPhysics(rawDt * speedRef.current);
          telemetryAcc += rawDt;
          if (telemetryAcc >= 0.08) {
            telemetryAcc = 0;
            sampleTelemetry();
          }
        }

        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const z = zoomRef.current;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(z, z);

        // Polar coordinate reference grid
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
        ctx.lineWidth = 1 / z;
        for (const r of [80, 160, 240, 320]) {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(-420, 0);
        ctx.lineTo(420, 0);
        ctx.moveTo(0, -420);
        ctx.lineTo(0, 420);
        ctx.stroke();

        const bodies = Matter.Composite.allBodies(engine.world);
        const metas = metaListRef.current;

        // Orbital trails
        if (showTrailsRef.current) {
          for (const m of metas) {
            if (m.trail.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(m.trail[0].x, m.trail[0].y);
            for (let i = 1; i < m.trail.length; i++) {
              ctx.lineTo(m.trail[i].x, m.trail[i].y);
            }
            ctx.strokeStyle = `${m.color}66`;
            ctx.lineWidth = 1.4 / z;
            ctx.stroke();
          }
        }

        // Force & velocity vectors
        for (const m of metas) {
          const b = bodies.find((x) => x.id === m.bodyId);
          if (!b) continue;

          if (showForcesRef.current) {
            const ax = m.fx / Math.max(0.05, b.mass);
            const ay = m.fy / Math.max(0.05, b.mass);
            const aMag = Math.hypot(ax, ay);
            if (aMag > 0.05) {
              const scale = Math.min(48, aMag * 1.4);
              const vx = (ax / aMag) * scale;
              const vy = (ay / aMag) * scale;
              ctx.strokeStyle = '#F59E0B';
              ctx.lineWidth = 1.6 / z;
              ctx.beginPath();
              ctx.moveTo(b.position.x, b.position.y);
              ctx.lineTo(b.position.x + vx, b.position.y + vy);
              ctx.stroke();
            }
          }

          if (showVelRef.current) {
            const vx = b.velocity.x * SUB_HZ;
            const vy = b.velocity.y * SUB_HZ;
            ctx.strokeStyle = '#10B981';
            ctx.lineWidth = 1.5 / z;
            ctx.beginPath();
            ctx.moveTo(b.position.x, b.position.y);
            ctx.lineTo(b.position.x + vx * 0.9, b.position.y + vy * 0.9);
            ctx.stroke();
          }
        }

        // Celestial bodies
        for (const m of metas) {
          const b = bodies.find((x) => x.id === m.bodyId);
          if (!b) continue;
          const x = b.position.x;
          const y = b.position.y;

          if (m.kind === 'star') {
            const grad = ctx.createRadialGradient(x, y, m.radius * 0.2, x, y, m.radius * 2.2);
            grad.addColorStop(0, `${m.color}66`);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, m.radius * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = m.color;
          ctx.beginPath();
          ctx.arc(x, y, m.radius, 0, Math.PI * 2);
          ctx.fill();

          if (m.id === selectedIdRef.current) {
            ctx.strokeStyle = '#67E8F9';
            ctx.lineWidth = 2 / z;
            ctx.beginPath();
            ctx.arc(x, y, m.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.fillStyle = '#CBD5E1';
          ctx.font = `${11 / z}px "JetBrains Mono", monospace`;
          ctx.fillText(m.name, x + m.radius + 5, y + 4);
        }

        // Slingshot spawn preview
        if (dragSpawnRef.current.active) {
          const d = dragSpawnRef.current;
          ctx.strokeStyle = '#06B6D4';
          ctx.setLineDash([4 / z, 4 / z]);
          ctx.lineWidth = 1.5 / z;
          ctx.beginPath();
          ctx.moveTo(d.startX, d.startY);
          ctx.lineTo(d.curX, d.curY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#06B6D4';
          ctx.beginPath();
          ctx.arc(
            d.startX,
            d.startY,
            spawnKind === 'star' ? 14 : spawnKind === 'planet' ? 8 : 4.5,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [sampleTelemetry, spawnKind, stepMatterPhysics]);

  const toWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - rect.width / 2) / zoomRef.current,
      y: (clientY - rect.top - rect.height / 2) / zoomRef.current,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    const pt = toWorld(e.clientX, e.clientY);
    const bodies = Matter.Composite.allBodies(engine.world);

    for (const m of metaListRef.current) {
      const b = bodies.find((x) => x.id === m.bodyId);
      if (b && Math.hypot(b.position.x - pt.x, b.position.y - pt.y) <= Math.max(m.radius + 8, 14)) {
        setSelectedId(m.id);
        setSelectedSnap({
          id: m.id,
          name: m.name,
          mass: b.mass,
          radius: m.radius,
          vx: b.velocity.x * SUB_HZ,
          vy: b.velocity.y * SUB_HZ,
        });
        return;
      }
    }

    dragSpawnRef.current = { startX: pt.x, startY: pt.y, curX: pt.x, curY: pt.y, active: true };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragSpawnRef.current.active) return;
    const pt = toWorld(e.clientX, e.clientY);
    dragSpawnRef.current.curX = pt.x;
    dragSpawnRef.current.curY = pt.y;
  };

  const handlePointerUp = () => {
    const d = dragSpawnRef.current;
    const engine = engineRef.current;
    if (!d.active || !engine) return;
    d.active = false;
    if (metaListRef.current.length >= 32) return;

    const vx = (d.startX - d.curX) * 0.45;
    const vy = (d.startY - d.curY) * 0.45;
    const defaults =
      spawnKind === 'star'
        ? { mass: 750, radius: 18, color: '#F59E0B', label: 'Star' }
        : spawnKind === 'planet'
        ? { mass: 12, radius: 8.5, color: '#06B6D4', label: 'Planet' }
        : { mass: 0.4, radius: 4.5, color: '#E2E8F0', label: 'Moon' };

    const newMeta = addBodyToMatterWorld(engine, {
      id: `body_${Date.now().toString(36)}`,
      name: `${defaults.label} ${metaListRef.current.length + 1}`,
      kind: spawnKind,
      x: d.startX,
      y: d.startY,
      vx,
      vy,
      mass: defaults.mass,
      radius: defaults.radius,
      color: defaults.color,
    });
    metaListRef.current.push(newMeta);
    setSelectedId(newMeta.id);
    sampleTelemetry();
  };

  const updateSelectedBody = (patch: { mass?: number; radius?: number; vx?: number; vy?: number }) => {
    const engine = engineRef.current;
    if (!selectedId || !engine) return;
    const m = metaListRef.current.find((item) => item.id === selectedId);
    if (!m) return;
    const b = Matter.Composite.allBodies(engine.world).find((x) => x.id === m.bodyId);
    if (!b) return;

    if (patch.mass !== undefined) Matter.Body.setMass(b, patch.mass);
    if (patch.radius !== undefined) m.radius = patch.radius;
    if (patch.vx !== undefined || patch.vy !== undefined) {
      const nvx = patch.vx !== undefined ? patch.vx : b.velocity.x * SUB_HZ;
      const nvy = patch.vy !== undefined ? patch.vy : b.velocity.y * SUB_HZ;
      Matter.Body.setVelocity(b, { x: nvx / SUB_HZ, y: nvy / SUB_HZ });
    }
    sampleTelemetry();
  };

  const removeSelectedBody = () => {
    const engine = engineRef.current;
    if (!selectedId || !engine) return;
    const m = metaListRef.current.find((item) => item.id === selectedId);
    if (!m) return;
    const b = Matter.Composite.allBodies(engine.world).find((x) => x.id === m.bodyId);
    if (b) Matter.Composite.remove(engine.world, b);
    metaListRef.current = metaListRef.current.filter((item) => item.id !== selectedId);
    setSelectedId(metaListRef.current[0]?.id || null);
    sampleTelemetry();
  };

  return (
    <SimulationWorkspace
      simId="gravity"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {
        setIsPlaying(false);
        stepMatterPhysics(0.02 * speed);
        sampleTelemetry();
      }}
      onReset={() => loadPreset(preset)}
      onClear={() => {
        if (engineRef.current) {
          Matter.Composite.clear(engineRef.current.world, false);
        }
        metaListRef.current = [];
        simTimeRef.current = 0;
        setSeriesData([]);
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
      chartTitle="System Energy Conservation (KE / PE / Total)"
      chartSeries={[
        { key: 'ke', label: 'Kinetic Energy', color: '#06B6D4' },
        { key: 'pe', label: 'Potential Energy', color: '#F59E0B' },
        { key: 'total', label: 'Total Energy', color: '#10B981' },
      ]}
      currentParams={{ preset, gravStrength, speed }}
      currentObjects={metaListRef.current.map((m) => ({
        name: m.name,
        kind: m.kind,
        radius: m.radius,
      }))}
      hintText="Click a body to inspect, or click and drag on empty space to launch a new body."
      onOpenLearn={onOpenLearn}
      toolbarExtra={
        <div className="flex items-center gap-1">
          {(['star', 'planet', 'moon'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSpawnKind(k)}
              className={`px-2 py-1 rounded-sm text-[11px] font-medium capitalize cursor-pointer ${
                spawnKind === k
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Add {k}
            </button>
          ))}
        </div>
      }
      controlsPanel={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Orbital Preset</label>
            <select
              value={preset}
              onChange={(e) => loadPreset(e.target.value)}
              className="w-full px-2.5 py-2 rounded-md bg-[#070B14] border border-slate-700 text-xs text-slate-100"
            >
              <option value="sun-earth-moon">Sun, Planet &amp; Moon</option>
              <option value="binary-stars">Binary Star System</option>
              <option value="solar-system">Multi-Planet Solar System</option>
              <option value="slingshot">Gravitational Slingshot</option>
            </select>
          </div>

          <SliderControl
            label="Gravitational Constant G"
            value={gravStrength}
            min={50}
            max={800}
            step={10}
            precision={0}
            unit="scaled"
            tooltip="Controls overall attractive force between all massive bodies."
            onChange={setGravStrength}
          />

          <ToggleControl
            label="Orbital Trails"
            checked={showTrails}
            onChange={setShowTrails}
            description="Render historical trajectory paths"
          />
          <ToggleControl
            label="Gravity Force Vectors"
            checked={showForceVectors}
            onChange={setShowForceVectors}
            description="Amber arrows pointing along net acceleration"
          />
          <ToggleControl
            label="Velocity Vectors"
            checked={showVelocityVectors}
            onChange={setShowVelocityVectors}
            description="Emerald tangent velocity vectors"
          />
        </div>
      }
      inspectorPanel={
        selectedSnap ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-cyan-300">{selectedSnap.name}</span>
              <button
                type="button"
                onClick={removeSelectedBody}
                className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                Remove
              </button>
            </div>
            <SliderControl
              label="Mass"
              value={selectedSnap.mass}
              min={0.1}
              max={1500}
              step={0.5}
              precision={1}
              unit="M_rel"
              onChange={(v) => updateSelectedBody({ mass: v })}
            />
            <SliderControl
              label="Radius"
              value={selectedSnap.radius}
              min={3}
              max={32}
              step={0.5}
              precision={1}
              unit="px"
              onChange={(v) => updateSelectedBody({ radius: v })}
            />
            <SliderControl
              label="Velocity X"
              value={selectedSnap.vx}
              min={-90}
              max={90}
              step={0.5}
              precision={1}
              unit="u/s"
              onChange={(v) => updateSelectedBody({ vx: v })}
            />
            <SliderControl
              label="Velocity Y"
              value={selectedSnap.vy}
              min={-90}
              max={90}
              step={0.5}
              precision={1}
              unit="u/s"
              onChange={(v) => updateSelectedBody({ vy: v })}
            />
          </div>
        ) : (
          <div className="text-xs text-slate-400">
            Select a celestial body on the canvas to edit its mass or velocity.
          </div>
        )
      }
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full block cursor-crosshair touch-none"
      />
    </SimulationWorkspace>
  );
};
