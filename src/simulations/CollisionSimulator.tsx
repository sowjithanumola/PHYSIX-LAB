import React, { useCallback, useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl, ToggleControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

interface CollisionBodyMeta {
  id: number;
  label: string;
  shape: 'circle' | 'box';
  color: string;
  radius: number;
  mass: number;
}

interface CollisionSimulatorProps {
  initialParams?: Record<string, unknown>;
  presetId?: string;
  onOpenLearn?: () => void;
}

export const CollisionSimulator: React.FC<CollisionSimulatorProps> = ({
  initialParams,
  presetId,
  onOpenLearn,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preset, setPreset] = useState((initialParams?.preset as string) || presetId || 'elastic-head-on');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [restitution, setRestitution] = useState(Number(initialParams?.restitution ?? 1.0));
  const [gravityY, setGravityY] = useState(Number(initialParams?.gravityY ?? 0));
  const [showMomentumVectors, setShowMomentumVectors] = useState(true);
  const [spawnShape, setSpawnShape] = useState<'circle' | 'box'>('circle');
  const [spawnMass, setSpawnMass] = useState(4);
  const [spawnRadius, setSpawnRadius] = useState(24);
  const [selectedBodyId, setSelectedBodyId] = useState<number | null>(null);
  const [selectedSnap, setSelectedSnap] = useState<{
    id: number;
    label: string;
    mass: number;
    vx: number;
    vy: number;
  } | null>(null);

  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [seriesData, setSeriesData] = useState<TelemetrySeriesPoint[]>([]);

  const engineRef = useRef<Matter.Engine | null>(null);
  const metaMapRef = useRef<Map<number, CollisionBodyMeta>>(new Map());
  const collisionCountRef = useRef(0);
  const initialKeRef = useRef<number | null>(null);
  const simTimeRef = useRef(0);
  const dragLaunchRef = useRef<{ sx: number; sy: number; cx: number; cy: number; active: boolean }>({
    sx: 0,
    sy: 0,
    cx: 0,
    cy: 0,
    active: false,
  });

  const stateRef = useRef({
    isPlaying,
    speed,
    zoom,
    restitution,
    gravityY,
    showMomentumVectors,
    selectedBodyId,
  });

  useEffect(() => {
    stateRef.current = {
      isPlaying,
      speed,
      zoom,
      restitution,
      gravityY,
      showMomentumVectors,
      selectedBodyId,
    };
  }, [isPlaying, speed, zoom, restitution, gravityY, showMomentumVectors, selectedBodyId]);

  const buildWorld = useCallback(
    (p: string, rest: number) => {
      const engine = Matter.Engine.create({
        gravity: { x: 0, y: gravityY, scale: 0.001 },
      });
      engine.positionIterations = 10;
      engine.velocityIterations = 10;

      const metaMap = new Map<number, CollisionBodyMeta>();

      // Containment walls around [-360..360] x [-210..210]
      const wallOpts: Matter.IChamferableBodyDefinition = {
        isStatic: true,
        restitution: rest,
        friction: 0,
        frictionStatic: 0,
      };
      Matter.Composite.add(engine.world, [
        Matter.Bodies.rectangle(0, -220, 760, 24, wallOpts),
        Matter.Bodies.rectangle(0, 220, 760, 24, wallOpts),
        Matter.Bodies.rectangle(-380, 0, 24, 464, wallOpts),
        Matter.Bodies.rectangle(380, 0, 24, 464, wallOpts),
      ]);

      const addBall = (
        label: string,
        x: number,
        y: number,
        vx: number,
        vy: number,
        mass: number,
        radius: number,
        color: string,
        shape: 'circle' | 'box' = 'circle'
      ) => {
        const opts: Matter.IChamferableBodyDefinition = {
          restitution: rest,
          friction: 0,
          frictionAir: 0,
          frictionStatic: 0,
          inertia: Infinity,
        };
        const body =
          shape === 'circle'
            ? Matter.Bodies.circle(x, y, radius, opts)
            : Matter.Bodies.rectangle(x, y, radius * 1.8, radius * 1.8, opts);
        Matter.Body.setMass(body, mass);
        Matter.Body.setVelocity(body, { x: vx, y: vy });
        Matter.Composite.add(engine.world, body);
        metaMap.set(body.id, { id: body.id, label, shape, color, radius, mass });
        return body;
      };

      if (p === 'mass-ratio') {
        addBall('Heavy Mass (12 kg)', -210, 0, 4.5, 0, 12, 34, '#F59E0B');
        addBall('Light Mass (2 kg)', 60, 0, 0, 0, 2, 16, '#06B6D4');
      } else if (p === 'multi-scatter') {
        addBall('Projectile', -240, 0, 6.2, 0.2, 5, 22, '#06B6D4');
        addBall('Target A', 40, -28, 0, 0, 4, 20, '#3B82F6');
        addBall('Target B', 40, 28, 0, 0, 4, 20, '#10B981');
        addBall('Target C', 95, 0, 0, 0, 6, 24, '#F59E0B');
      } else {
        // elastic-head-on
        addBall('Mass A (4 kg)', -180, 0, 4.8, 0, 4, 24, '#06B6D4');
        addBall('Mass B (4 kg)', 110, 0, -1.6, 0, 4, 24, '#F59E0B');
      }

      Matter.Events.on(engine, 'collisionStart', (evt) => {
        for (const pair of evt.pairs) {
          if (!pair.bodyA.isStatic && !pair.bodyB.isStatic) {
            collisionCountRef.current += 1;
          }
        }
      });

      engineRef.current = engine;
      metaMapRef.current = metaMap;
      collisionCountRef.current = 0;
      initialKeRef.current = null;
      simTimeRef.current = 0;
      setSeriesData([]);
    },
    [gravityY]
  );

  useEffect(() => {
    buildWorld(preset, restitution);
  }, [buildWorld, preset]);

  // Propagate restitution & gravity changes live
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.gravity.y = gravityY;
    for (const body of Matter.Composite.allBodies(engine.world)) {
      body.restitution = restitution;
    }
  }, [restitution, gravityY]);

  const sampleTelemetry = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const dynamicBodies = Matter.Composite.allBodies(engine.world).filter((b) => !b.isStatic);
    let px = 0;
    let py = 0;
    let ke = 0;
    for (const b of dynamicBodies) {
      px += b.mass * b.velocity.x;
      py += b.mass * b.velocity.y;
      ke += 0.5 * b.mass * (b.velocity.x ** 2 + b.velocity.y ** 2);
    }
    if (initialKeRef.current === null && dynamicBodies.length > 0) {
      initialKeRef.current = ke;
    }
    const pMag = Math.hypot(px, py);
    const keDelta = initialKeRef.current !== null ? ke - initialKeRef.current : 0;

    setSimTime(simTimeRef.current);
    setMetrics([
      { id: 'mom', label: 'Total Momentum |p|', value: pMag.toFixed(2), unit: 'kg·m/s', tone: 'cyan' },
      { id: 'ke', label: 'Total Kinetic Energy', value: ke.toFixed(2), unit: 'J', tone: 'emerald' },
      { id: 'col', label: 'Body Collisions', value: String(collisionCountRef.current), unit: 'impacts', tone: 'amber' },
      { id: 'dke', label: 'KE Delta vs Start', value: keDelta.toFixed(2), unit: 'J', tone: 'neutral' },
    ]);

    setSeriesData((prev) => {
      const next = [
        ...prev,
        {
          t: +simTimeRef.current.toFixed(2),
          momentum: +pMag.toFixed(2),
          ke: +ke.toFixed(2),
        },
      ];
      return next.length > 85 ? next.slice(next.length - 85) : next;
    });

    if (stateRef.current.selectedBodyId !== null) {
      const sel = dynamicBodies.find((b) => b.id === stateRef.current.selectedBodyId);
      const meta = sel ? metaMapRef.current.get(sel.id) : null;
      if (sel && meta) {
        setSelectedSnap({
          id: sel.id,
          label: meta.label,
          mass: sel.mass,
          vx: sel.velocity.x,
          vy: sel.velocity.y,
        });
      }
    }
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
      const dt = Math.min((now - lastTs) / 1000, 0.033);
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

        const st = stateRef.current;
        if (st.isPlaying) {
          Matter.Engine.update(engine, 16.667 * st.speed);
          simTimeRef.current += dt * st.speed;
          telAcc += dt;
          if (telAcc >= 0.08) {
            telAcc = 0;
            sampleTelemetry();
          }
        }

        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(st.zoom, st.zoom);

        // Arena border
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 3;
        ctx.strokeRect(-368, -208, 736, 416);

        const bodies = Matter.Composite.allBodies(engine.world);
        for (const b of bodies) {
          if (b.isStatic) continue;
          const meta = metaMapRef.current.get(b.id);
          const color = meta?.color || '#06B6D4';

          ctx.save();
          ctx.translate(b.position.x, b.position.y);
          ctx.rotate(b.angle);
          ctx.fillStyle = color;
          ctx.strokeStyle = b.id === st.selectedBodyId ? '#F8FAFC' : '#0F172A';
          ctx.lineWidth = 2;

          if (!meta || meta.shape === 'circle') {
            const r = meta?.radius || 20;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            const side = meta.radius * 1.8;
            ctx.fillRect(-side / 2, -side / 2, side, side);
            ctx.strokeRect(-side / 2, -side / 2, side, side);
          }
          ctx.restore();

          if (st.showMomentumVectors) {
            const px = b.mass * b.velocity.x * 2.5;
            const py = b.mass * b.velocity.y * 2.5;
            if (Math.hypot(px, py) > 2) {
              ctx.strokeStyle = '#34D399';
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.moveTo(b.position.x, b.position.y);
              ctx.lineTo(b.position.x + px, b.position.y + py);
              ctx.stroke();
            }
          }
        }

        if (dragLaunchRef.current.active) {
          const d = dragLaunchRef.current;
          ctx.strokeStyle = '#06B6D4';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(d.sx, d.sy);
          ctx.lineTo(d.cx, d.cy);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [sampleTelemetry]);

  const toWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - rect.width / 2) / zoom,
      y: (clientY - rect.top - rect.height / 2) / zoom,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    const pt = toWorld(e.clientX, e.clientY);
    const bodies = Matter.Composite.allBodies(engine.world).filter((b) => !b.isStatic);
    const hit = bodies.find((b) => Math.hypot(b.position.x - pt.x, b.position.y - pt.y) <= 32);
    if (hit) {
      setSelectedBodyId(hit.id);
      const meta = metaMapRef.current.get(hit.id);
      setSelectedSnap({
        id: hit.id,
        label: meta?.label || `Body #${hit.id}`,
        mass: hit.mass,
        vx: hit.velocity.x,
        vy: hit.velocity.y,
      });
      return;
    }
    dragLaunchRef.current = { sx: pt.x, sy: pt.y, cx: pt.x, cy: pt.y, active: true };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragLaunchRef.current.active) return;
    const pt = toWorld(e.clientX, e.clientY);
    dragLaunchRef.current.cx = pt.x;
    dragLaunchRef.current.cy = pt.y;
  };

  const handlePointerUp = () => {
    const d = dragLaunchRef.current;
    const engine = engineRef.current;
    if (!d.active || !engine) return;
    d.active = false;
    const vx = (d.sx - d.cx) * 0.06;
    const vy = (d.sy - d.cy) * 0.06;
    const opts: Matter.IChamferableBodyDefinition = {
      restitution,
      friction: 0,
      frictionAir: 0,
      frictionStatic: 0,
      inertia: Infinity,
    };
    const body =
      spawnShape === 'circle'
        ? Matter.Bodies.circle(d.sx, d.sy, spawnRadius, opts)
        : Matter.Bodies.rectangle(d.sx, d.sy, spawnRadius * 1.8, spawnRadius * 1.8, opts);
    Matter.Body.setMass(body, spawnMass);
    Matter.Body.setVelocity(body, { x: vx, y: vy });
    Matter.Composite.add(engine.world, body);
    metaMapRef.current.set(body.id, {
      id: body.id,
      label: `Body ${metaMapRef.current.size + 1}`,
      shape: spawnShape,
      color: spawnShape === 'circle' ? '#06B6D4' : '#3B82F6',
      radius: spawnRadius,
      mass: spawnMass,
    });
    setSelectedBodyId(body.id);
    sampleTelemetry();
  };

  return (
    <SimulationWorkspace
      simId="collision"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {
        setIsPlaying(false);
        if (engineRef.current) {
          Matter.Engine.update(engineRef.current, 16.667 * speed);
          simTimeRef.current += 0.0167 * speed;
          sampleTelemetry();
        }
      }}
      onReset={() => buildWorld(preset, restitution)}
      onClear={() => {
        if (!engineRef.current) return;
        const bodies = Matter.Composite.allBodies(engineRef.current.world).filter((b) => !b.isStatic);
        for (const b of bodies) Matter.Composite.remove(engineRef.current.world, b);
        metaMapRef.current.clear();
        collisionCountRef.current = 0;
        initialKeRef.current = null;
        setSelectedBodyId(null);
        setSelectedSnap(null);
        sampleTelemetry();
      }}
      speed={speed}
      onSpeedChange={setSpeed}
      zoom={zoom}
      onZoomChange={setZoom}
      simTime={simTime}
      metrics={metrics}
      seriesData={seriesData}
      chartTitle="Total Momentum |p| vs Total Kinetic Energy (J)"
      chartSeries={[
        { key: 'momentum', label: 'Total Momentum', color: '#06B6D4' },
        { key: 'ke', label: 'Kinetic Energy', color: '#10B981' },
      ]}
      currentParams={{ preset, restitution, gravityY }}
      hintText="Click a body to inspect velocity/mass, or drag on empty space to launch a new object."
      onOpenLearn={onOpenLearn}
      toolbarExtra={
        <div className="flex items-center gap-1">
          {(['circle', 'box'] as const).map((sh) => (
            <button
              key={sh}
              type="button"
              onClick={() => setSpawnShape(sh)}
              className={`px-2 py-1 rounded-sm text-[11px] font-medium capitalize cursor-pointer ${
                spawnShape === sh
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              Launch {sh}
            </button>
          ))}
        </div>
      }
      controlsPanel={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Collision Preset</label>
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                buildWorld(e.target.value, restitution);
              }}
              className="w-full px-2.5 py-2 rounded-md bg-[#070B14] border border-slate-700 text-xs text-slate-100"
            >
              <option value="elastic-head-on">Head-On Equal Mass</option>
              <option value="mass-ratio">Heavy vs Light Mass (6:1)</option>
              <option value="multi-scatter">Multi-Body Scatter</option>
            </select>
          </div>

          <SliderControl
            label="Restitution (Elasticity e)"
            value={restitution}
            min={0}
            max={1}
            step={0.05}
            precision={2}
            tooltip="1.0 = Elastic collision (conserves KE); 0.0 = Perfectly inelastic."
            onChange={setRestitution}
          />
          <SliderControl
            label="Vertical Gravity"
            value={gravityY}
            min={0}
            max={1.5}
            step={0.1}
            precision={1}
            unit="g eq."
            onChange={setGravityY}
          />
          <SliderControl
            label="New Object Mass"
            value={spawnMass}
            min={1}
            max={20}
            step={0.5}
            precision={1}
            unit="kg"
            onChange={setSpawnMass}
          />
          <SliderControl
            label="New Object Size"
            value={spawnRadius}
            min={10}
            max={44}
            step={2}
            precision={0}
            unit="px"
            onChange={setSpawnRadius}
          />
          <ToggleControl
            label="Momentum Vectors"
            checked={showMomentumVectors}
            onChange={setShowMomentumVectors}
          />
        </div>
      }
      inspectorPanel={
        selectedSnap ? (
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-cyan-300">{selectedSnap.label}</div>
            <SliderControl
              label="Mass"
              value={selectedSnap.mass}
              min={1}
              max={25}
              step={0.5}
              precision={1}
              unit="kg"
              onChange={(v) => {
                const body = engineRef.current?.world.bodies.find((b) => b.id === selectedSnap.id);
                if (body) {
                  Matter.Body.setMass(body, v);
                  setSelectedSnap({ ...selectedSnap, mass: v });
                }
              }}
            />
            <SliderControl
              label="Velocity X"
              value={selectedSnap.vx}
              min={-12}
              max={12}
              step={0.2}
              precision={1}
              unit="m/s eq."
              onChange={(v) => {
                const body = engineRef.current?.world.bodies.find((b) => b.id === selectedSnap.id);
                if (body) {
                  Matter.Body.setVelocity(body, { x: v, y: body.velocity.y });
                  setSelectedSnap({ ...selectedSnap, vx: v });
                }
              }}
            />
          </div>
        ) : (
          <div className="text-xs text-slate-400">Click any moving object to inspect or adjust its mass and velocity.</div>
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
