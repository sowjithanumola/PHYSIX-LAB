import React, { useCallback, useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as CANNON from 'cannon-es';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

type SandboxTool = 'drag' | 'ball' | 'box' | 'platform' | 'ramp' | 'pendulum' | 'spring-pair';

interface BodyVisualMeta {
  color: string;
  label: string;
  shape: 'circle' | 'rect';
  w?: number;
  h?: number;
  r?: number;
}

interface PlaygroundSimulatorProps {
  initialParams?: Record<string, unknown>;
  onOpenLearn?: () => void;
}

export const PlaygroundSimulator: React.FC<PlaygroundSimulatorProps> = ({
  initialParams,
  onOpenLearn,
}) => {
  const canvas2DRef = useRef<HTMLCanvasElement>(null);
  const mount3DRef = useRef<HTMLDivElement>(null);

  const [engineMode, setEngineMode] = useState<'2d' | '3d'>('2d');
  const [preset, setPreset] = useState<string>((initialParams?.preset as string) || 'contraption');
  const [tool, setTool] = useState<SandboxTool>('drag');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);

  const [gravityY, setGravityY] = useState(Number(initialParams?.gravityY ?? 1.0));
  const [friction, setFriction] = useState(Number(initialParams?.friction ?? 0.25));
  const [restitution, setRestitution] = useState(Number(initialParams?.restitution ?? 0.65));

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSnap, setSelectedSnap] = useState<{
    id: number;
    label: string;
    mass: number;
    restitution: number;
    friction: number;
    isStatic: boolean;
  } | null>(null);

  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [seriesData, setSeriesData] = useState<TelemetrySeriesPoint[]>([]);

  // 2D Matter.js refs
  const matterEngineRef = useRef<Matter.Engine | null>(null);
  const metaMapRef = useRef<Map<number, BodyVisualMeta>>(new Map());
  const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null);
  const simTimeRef = useRef(0);

  // 3D Cannon-es spawn handler ref
  const spawn3DBoxRef = useRef<((kind: 'box' | 'sphere') => void) | null>(null);
  const reset3DRef = useRef<(() => void) | null>(null);

  const stateRef = useRef({ isPlaying, speed, gravityY, friction, restitution, tool, selectedId });
  useEffect(() => {
    stateRef.current = { isPlaying, speed, gravityY, friction, restitution, tool, selectedId };
  }, [isPlaying, speed, gravityY, friction, restitution, tool, selectedId]);

  const build2DWorld = useCallback(
    (p: string) => {
      const engine = Matter.Engine.create({
        gravity: { x: 0, y: gravityY, scale: 0.001 },
      });
      const metaMap = new Map<number, BodyVisualMeta>();

      const addBody = (body: Matter.Body, meta: BodyVisualMeta) => {
        Matter.Composite.add(engine.world, body);
        metaMap.set(body.id, meta);
        return body;
      };

      // Floor and side bounds
      addBody(
        Matter.Bodies.rectangle(0, 200, 740, 26, { isStatic: true, friction: 0.6, restitution: 0.4 }),
        { color: '#1E293B', label: 'Lab Floor', shape: 'rect', w: 740, h: 26 }
      );
      addBody(
        Matter.Bodies.rectangle(-360, 0, 22, 420, { isStatic: true }),
        { color: '#1E293B', label: 'Left Wall', shape: 'rect', w: 22, h: 420 }
      );
      addBody(
        Matter.Bodies.rectangle(360, 0, 22, 420, { isStatic: true }),
        { color: '#1E293B', label: 'Right Wall', shape: 'rect', w: 22, h: 420 }
      );

      if (p === 'cradle') {
        for (let i = 0; i < 5; i++) {
          const x = -80 + i * 40;
          const bob = addBody(
            Matter.Bodies.circle(i === 0 ? x - 95 : x, i === 0 ? -30 : 40, 20, {
              restitution: 0.99,
              friction: 0,
              frictionAir: 0.0005,
              slop: 0.01,
              inertia: Infinity,
            }),
            { color: '#06B6D4', label: `Pendulum Bob ${i + 1}`, shape: 'circle', r: 20 }
          );
          const rod = Matter.Constraint.create({
            pointA: { x, y: -120 },
            bodyB: bob,
            length: 160,
            stiffness: 1,
          });
          Matter.Composite.add(engine.world, rod);
        }
      } else if (p === 'dominoes') {
        for (let i = 0; i < 8; i++) {
          addBody(
            Matter.Bodies.rectangle(-140 + i * 38, 145, 14, 84, {
              friction: 0.5,
              restitution: 0.2,
            }),
            { color: '#3B82F6', label: `Domino ${i + 1}`, shape: 'rect', w: 14, h: 84 }
          );
        }
        const striker = addBody(
          Matter.Bodies.circle(-260, -20, 22, { restitution: 0.85, friction: 0.1 }),
          { color: '#F59E0B', label: 'Striker Sphere', shape: 'circle', r: 22 }
        );
        const pivot = Matter.Constraint.create({
          pointA: { x: -195, y: -140 },
          bodyB: striker,
          length: 135,
          stiffness: 1,
        });
        Matter.Composite.add(engine.world, pivot);
      } else {
        // Default contraption: ramps + spring bridge + blocks + ball
        addBody(
          Matter.Bodies.rectangle(-170, -40, 210, 14, { isStatic: true, angle: 0.28, friction: 0.1 }),
          { color: '#334155', label: 'Upper Ramp', shape: 'rect', w: 210, h: 14 }
        );
        addBody(
          Matter.Bodies.rectangle(95, 55, 210, 14, { isStatic: true, angle: -0.22, friction: 0.15 }),
          { color: '#334155', label: 'Lower Ramp', shape: 'rect', w: 210, h: 14 }
        );
        addBody(
          Matter.Bodies.circle(-240, -135, 19, { restitution: 0.78, friction: 0.1 }),
          { color: '#06B6D4', label: 'Lead Sphere', shape: 'circle', r: 19 }
        );
        const boxA = addBody(
          Matter.Bodies.rectangle(-30, 130, 38, 38, { restitution: 0.4, friction: 0.4 }),
          { color: '#10B981', label: 'Spring Block', shape: 'rect', w: 38, h: 38 }
        );
        const spring = Matter.Constraint.create({
          pointA: { x: -30, y: 15 },
          bodyB: boxA,
          length: 95,
          stiffness: 0.08,
          damping: 0.02,
        });
        Matter.Composite.add(engine.world, spring);

        addBody(
          Matter.Bodies.rectangle(215, 165, 36, 36, { restitution: 0.5 }),
          { color: '#F59E0B', label: 'Target Crate', shape: 'rect', w: 36, h: 36 }
        );
      }

      matterEngineRef.current = engine;
      metaMapRef.current = metaMap;
      simTimeRef.current = 0;
      setSeriesData([]);
      setSelectedId(null);
      setSelectedSnap(null);
    },
    [gravityY]
  );

  useEffect(() => {
    if (engineMode === '2d') {
      build2DWorld(preset);
    }
  }, [build2DWorld, engineMode, preset]);

  useEffect(() => {
    if (matterEngineRef.current) {
      matterEngineRef.current.gravity.y = gravityY;
    }
  }, [gravityY]);

  const sample2DTelemetry = useCallback(() => {
    const engine = matterEngineRef.current;
    if (!engine) return;
    const bodies = Matter.Composite.allBodies(engine.world);
    const dynamic = bodies.filter((b) => !b.isStatic);
    const constraints = Matter.Composite.allConstraints(engine.world);
    let totalKe = 0;
    for (const b of dynamic) {
      totalKe += 0.5 * b.mass * (b.velocity.x ** 2 + b.velocity.y ** 2);
    }
    setSimTime(simTimeRef.current);
    setMetrics([
      { id: 'bod', label: 'Dynamic Bodies', value: String(dynamic.length), unit: 'objects', tone: 'cyan' },
      { id: 'con', label: 'Joints / Springs', value: String(constraints.length), unit: 'links', tone: 'amber' },
      { id: 'ke', label: 'Total Kinetic Energy', value: totalKe.toFixed(1), unit: 'J eq.', tone: 'emerald' },
      { id: 'g', label: 'Gravity', value: gravityY.toFixed(2), unit: 'g', tone: 'neutral' },
    ]);
    setSeriesData((prev) => {
      const next = [...prev, { t: +simTimeRef.current.toFixed(2), ke: +totalKe.toFixed(1) }];
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
  }, [gravityY]);

  // 2D Matter.js loop & mouse interaction
  useEffect(() => {
    if (engineMode !== '2d') return;
    const canvas = canvas2DRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mouse = Matter.Mouse.create(canvas);
    mouse.pixelRatio = 1;
    let animId = 0;
    let lastTs = performance.now();
    let telAcc = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - lastTs) / 1000, 0.033);
      lastTs = now;

      const parent = canvas.parentElement;
      const engine = matterEngineRef.current;
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
          if (telAcc >= 0.1) {
            telAcc = 0;
            sample2DTelemetry();
          }
        }

        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(zoom, zoom);

        // Background grid
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
        ctx.lineWidth = 1;
        for (let gx = -360; gx <= 360; gx += 40) {
          ctx.beginPath();
          ctx.moveTo(gx, -220);
          ctx.lineTo(gx, 220);
          ctx.stroke();
        }
        for (let gy = -200; gy <= 200; gy += 40) {
          ctx.beginPath();
          ctx.moveTo(-360, gy);
          ctx.lineTo(360, gy);
          ctx.stroke();
        }

        // Draw constraints (springs & pendulums)
        for (const c of Matter.Composite.allConstraints(engine.world)) {
          if (c.label === 'Mouse Constraint') continue;
          const pA = Matter.Constraint.pointAWorld(c);
          const pB = Matter.Constraint.pointBWorld(c);
          ctx.strokeStyle = (c.stiffness || 1) < 0.5 ? '#F59E0B' : '#94A3B8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();

          ctx.fillStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.arc(pA.x, pA.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw bodies
        for (const b of Matter.Composite.allBodies(engine.world)) {
          const meta = metaMapRef.current.get(b.id);
          ctx.save();
          ctx.translate(b.position.x, b.position.y);
          ctx.rotate(b.angle);
          ctx.fillStyle = meta?.color || '#38BDF8';
          ctx.strokeStyle = b.id === st.selectedId ? '#F8FAFC' : '#0F172A';
          ctx.lineWidth = b.id === st.selectedId ? 2.5 : 1.5;

          if (meta?.shape === 'circle' && meta.r) {
            ctx.beginPath();
            ctx.arc(0, 0, meta.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(meta.r, 0);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.stroke();
          } else {
            const bw = meta?.w || 40;
            const bh = meta?.h || 40;
            ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
            ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
          }
          ctx.restore();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [engineMode, sample2DTelemetry, zoom]);

  // 3D Cannon-es + Three.js mode
  useEffect(() => {
    if (engineMode !== '3d') return;
    const container = mount3DRef.current;
    if (!container) return;

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 420;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = !isSoftwareGl;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050811');
    scene.fog = new THREE.FogExp2('#050811', 0.03);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(7, 5.5, 8);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;

    scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.7));
    const dir = new THREE.DirectionalLight(0xfff4e6, 2);
    dir.position.set(6, 10, 5);
    dir.castShadow = !isSoftwareGl;
    scene.add(dir);

    const grid = new THREE.GridHelper(16, 16, 0x1e293b, 0x0f172a);
    scene.add(grid);

    const tableMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.4 })
    );
    tableMesh.position.y = -0.2;
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.81 * stateRef.current.gravityY, 0),
    });
    const floorBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(5, 0.2, 5)),
      position: new CANNON.Vec3(0, -0.2, 0),
    });
    world.addBody(floorBody);

    const entries: { mesh: THREE.Mesh; body: CANNON.Body }[] = [];
    const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const sphGeo = new THREE.SphereGeometry(0.45, 24, 24);

    const spawn3D = (kind: 'box' | 'sphere', x = 0, y = 4, z = 0) => {
      const mat = new THREE.MeshStandardMaterial({
        color: kind === 'box' ? 0x3b82f6 : 0x06b6d4,
        metalness: 0.45,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(kind === 'box' ? boxGeo : sphGeo, mat);
      mesh.castShadow = true;
      scene.add(mesh);

      const body = new CANNON.Body({
        mass: 2,
        shape: kind === 'box' ? new CANNON.Box(new CANNON.Vec3(0.4, 0.4, 0.4)) : new CANNON.Sphere(0.45),
        position: new CANNON.Vec3(x, y, z),
      });
      world.addBody(body);
      entries.push({ mesh, body });
    };

    const seed3D = () => {
      while (entries.length) {
        const e = entries.pop();
        if (e) {
          scene.remove(e.mesh);
          world.removeBody(e.body);
          (e.mesh.material as THREE.Material).dispose();
        }
      }
      for (let i = 0; i < 4; i++) {
        spawn3D('box', -0.45, 0.5 + i * 0.85, 0);
        spawn3D('box', 0.45, 0.5 + i * 0.85, 0);
      }
      spawn3D('sphere', 0, 5.2, 0.15);
    };
    seed3D();

    spawn3DBoxRef.current = (kind) =>
      spawn3D(kind, (Math.random() - 0.5) * 2.5, 4.5, (Math.random() - 0.5) * 2.5);
    reset3DRef.current = seed3D;

    let frameId = 0;
    let disposed = false;
    let lastTs = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) frameId = window.setTimeout(poll, 5);
        else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTs) / 1000, 0.04);
      lastTs = now;

      if (stateRef.current.isPlaying) {
        world.gravity.set(0, -9.81 * stateRef.current.gravityY, 0);
        world.step(1 / 60, dt * stateRef.current.speed, 3);
        let totalKe = 0;
        for (const e of entries) {
          e.mesh.position.set(e.body.position.x, e.body.position.y, e.body.position.z);
          e.mesh.quaternion.set(
            e.body.quaternion.x,
            e.body.quaternion.y,
            e.body.quaternion.z,
            e.body.quaternion.w
          );
          totalKe += 0.5 * e.body.mass * e.body.velocity.lengthSquared();
        }
        setMetrics([
          { id: 'b3', label: '3D Rigid Bodies', value: String(entries.length), unit: 'objects', tone: 'cyan' },
          { id: 'eng', label: '3D Engine', value: 'Cannon-es', unit: 'active', tone: 'amber' },
          { id: 'ke3', label: 'Total Kinetic Energy', value: totalKe.toFixed(1), unit: 'J', tone: 'emerald' },
          { id: 'g3', label: 'Gravity Scale', value: stateRef.current.gravityY.toFixed(2), unit: 'g', tone: 'neutral' },
        ]);
      }

      controls.update();
      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      boxGeo.dispose();
      sphGeo.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, [engineMode]);

  const toWorld2D = (clientX: number, clientY: number) => {
    const rect = canvas2DRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - rect.width / 2) / zoom,
      y: (clientY - rect.top - rect.height / 2) / zoom,
    };
  };

  const draggingBodyRef = useRef<Matter.Body | null>(null);

  const handle2DPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = matterEngineRef.current;
    if (!engine) return;
    const pt = toWorld2D(e.clientX, e.clientY);

    if (tool === 'drag') {
      const hit = Matter.Query.point(Matter.Composite.allBodies(engine.world), pt)[0];
      if (hit) {
        setSelectedId(hit.id);
        const meta = metaMapRef.current.get(hit.id);
        setSelectedSnap({
          id: hit.id,
          label: meta?.label || `Object #${hit.id}`,
          mass: hit.mass,
          restitution: hit.restitution,
          friction: hit.friction,
          isStatic: hit.isStatic,
        });
        if (!hit.isStatic) {
          draggingBodyRef.current = hit;
        }
      }
      return;
    }

    const add = (b: Matter.Body, meta: BodyVisualMeta) => {
      Matter.Composite.add(engine.world, b);
      metaMapRef.current.set(b.id, meta);
      setSelectedId(b.id);
      setTool('drag');
      sample2DTelemetry();
    };

    if (tool === 'ball') {
      add(Matter.Bodies.circle(pt.x, pt.y, 20, { restitution, friction }), {
        color: '#06B6D4',
        label: 'Ball',
        shape: 'circle',
        r: 20,
      });
    } else if (tool === 'box') {
      add(Matter.Bodies.rectangle(pt.x, pt.y, 40, 40, { restitution, friction }), {
        color: '#3B82F6',
        label: 'Box',
        shape: 'rect',
        w: 40,
        h: 40,
      });
    } else if (tool === 'platform') {
      add(Matter.Bodies.rectangle(pt.x, pt.y, 160, 14, { isStatic: true, friction }), {
        color: '#334155',
        label: 'Platform',
        shape: 'rect',
        w: 160,
        h: 14,
      });
    } else if (tool === 'ramp') {
      add(Matter.Bodies.rectangle(pt.x, pt.y, 180, 14, { isStatic: true, angle: 0.3, friction }), {
        color: '#475569',
        label: 'Tilted Ramp',
        shape: 'rect',
        w: 180,
        h: 14,
      });
    } else if (tool === 'pendulum') {
      const bob = Matter.Bodies.circle(pt.x + 65, pt.y + 85, 18, { restitution, friction: 0.02 });
      const rope = Matter.Constraint.create({
        pointA: { x: pt.x, y: pt.y },
        bodyB: bob,
        length: 110,
        stiffness: 1,
      });
      Matter.Composite.add(engine.world, [bob, rope]);
      metaMapRef.current.set(bob.id, { color: '#F59E0B', label: 'Pendulum Bob', shape: 'circle', r: 18 });
      setTool('drag');
    } else if (tool === 'spring-pair') {
      const b1 = Matter.Bodies.rectangle(pt.x, pt.y + 80, 34, 34, { restitution, friction });
      const sp = Matter.Constraint.create({
        pointA: { x: pt.x, y: pt.y },
        bodyB: b1,
        length: 80,
        stiffness: 0.07,
        damping: 0.02,
      });
      Matter.Composite.add(engine.world, [b1, sp]);
      metaMapRef.current.set(b1.id, { color: '#10B981', label: 'Spring Mass', shape: 'rect', w: 34, h: 34 });
      setTool('drag');
    }
  };

  const handle2DPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingBodyRef.current) return;
    const pt = toWorld2D(e.clientX, e.clientY);
    Matter.Body.setPosition(draggingBodyRef.current, pt);
    Matter.Body.setVelocity(draggingBodyRef.current, { x: 0, y: 0 });
  };

  return (
    <SimulationWorkspace
      simId="playground"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {
        setIsPlaying(false);
        if (engineMode === '2d' && matterEngineRef.current) {
          Matter.Engine.update(matterEngineRef.current, 16.667 * speed);
          simTimeRef.current += 0.0167 * speed;
          sample2DTelemetry();
        }
      }}
      onReset={() => (engineMode === '2d' ? build2DWorld(preset) : reset3DRef.current?.())}
      onClear={() => {
        if (engineMode === '2d' && matterEngineRef.current) {
          const bodies = Matter.Composite.allBodies(matterEngineRef.current.world).filter((b) => !b.isStatic);
          for (const b of bodies) Matter.Composite.remove(matterEngineRef.current.world, b);
          for (const c of Matter.Composite.allConstraints(matterEngineRef.current.world)) {
            Matter.Composite.remove(matterEngineRef.current.world, c);
          }
          sample2DTelemetry();
        } else {
          reset3DRef.current?.();
        }
      }}
      speed={speed}
      onSpeedChange={setSpeed}
      zoom={zoom}
      onZoomChange={setZoom}
      simTime={simTime}
      metrics={metrics}
      seriesData={seriesData}
      chartTitle="Sandbox Total Kinetic Energy Over Time"
      chartSeries={[{ key: 'ke', label: 'Kinetic Energy', color: '#10B981' }]}
      currentParams={{ engineMode, preset, gravityY, friction, restitution }}
      hintText={
        engineMode === '2d'
          ? 'Select a shape tool above and click the canvas to spawn, or use Select / Drag to move objects.'
          : 'Orbit camera in 3D space and drop boxes or spheres using the toolbar buttons.'
      }
      onOpenLearn={onOpenLearn}
      toolbarExtra={
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex items-center border border-slate-700 rounded-sm overflow-hidden mr-1">
            <button
              type="button"
              onClick={() => setEngineMode('2d')}
              className={`px-2 py-1 text-[11px] font-medium cursor-pointer ${
                engineMode === '2d' ? 'bg-cyan-500/25 text-cyan-200' : 'text-slate-400'
              }`}
            >
              2D Matter.js
            </button>
            <button
              type="button"
              onClick={() => setEngineMode('3d')}
              className={`px-2 py-1 text-[11px] font-medium cursor-pointer ${
                engineMode === '3d' ? 'bg-cyan-500/25 text-cyan-200' : 'text-slate-400'
              }`}
            >
              3D Cannon-es
            </button>
          </div>

          {engineMode === '2d' ? (
            (
              [
                { id: 'drag', label: 'Select / Drag' },
                { id: 'ball', label: '+ Ball' },
                { id: 'box', label: '+ Box' },
                { id: 'platform', label: '+ Platform' },
                { id: 'ramp', label: '+ Ramp' },
                { id: 'pendulum', label: '+ Pendulum' },
                { id: 'spring-pair', label: '+ Spring' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                className={`px-2 py-1 rounded-sm text-[11px] font-medium cursor-pointer ${
                  tool === t.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))
          ) : (
            <>
              <button
                type="button"
                onClick={() => spawn3DBoxRef.current?.('box')}
                className="px-2 py-1 rounded-sm border border-slate-700 hover:bg-slate-800 text-[11px] text-slate-200 cursor-pointer"
              >
                + Drop 3D Box
              </button>
              <button
                type="button"
                onClick={() => spawn3DBoxRef.current?.('sphere')}
                className="px-2 py-1 rounded-sm border border-slate-700 hover:bg-slate-800 text-[11px] text-slate-200 cursor-pointer"
              >
                + Drop 3D Sphere
              </button>
            </>
          )}
        </div>
      }
      controlsPanel={
        <div className="space-y-3">
          {engineMode === '2d' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Sandbox Preset</label>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="w-full px-2.5 py-2 rounded-md bg-[#070B14] border border-slate-700 text-xs text-slate-100"
              >
                <option value="contraption">Ramp & Spring Contraption</option>
                <option value="cradle">Newton Cradle Pendulums</option>
                <option value="dominoes">Pendulum Domino Chain</option>
              </select>
            </div>
          )}

          <SliderControl
            label="Gravity Scale"
            value={gravityY}
            min={-1}
            max={2.5}
            step={0.1}
            precision={1}
            unit="g"
            onChange={setGravityY}
          />
          <SliderControl
            label="Default Friction"
            value={friction}
            min={0}
            max={1}
            step={0.05}
            precision={2}
            onChange={setFriction}
          />
          <SliderControl
            label="Default Elasticity"
            value={restitution}
            min={0}
            max={1}
            step={0.05}
            precision={2}
            onChange={setRestitution}
          />
        </div>
      }
      inspectorPanel={
        selectedSnap && engineMode === '2d' ? (
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-cyan-300">{selectedSnap.label}</div>
            {!selectedSnap.isStatic && (
              <SliderControl
                label="Mass"
                value={selectedSnap.mass}
                min={0.5}
                max={30}
                step={0.5}
                precision={1}
                unit="kg"
                onChange={(v) => {
                  const b = matterEngineRef.current?.world.bodies.find((x) => x.id === selectedSnap.id);
                  if (b) {
                    Matter.Body.setMass(b, v);
                    setSelectedSnap({ ...selectedSnap, mass: v });
                  }
                }}
              />
            )}
            <SliderControl
              label="Elasticity"
              value={selectedSnap.restitution}
              min={0}
              max={1}
              step={0.05}
              precision={2}
              onChange={(v) => {
                const b = matterEngineRef.current?.world.bodies.find((x) => x.id === selectedSnap.id);
                if (b) {
                  b.restitution = v;
                  setSelectedSnap({ ...selectedSnap, restitution: v });
                }
              }}
            />
            <SliderControl
              label="Friction"
              value={selectedSnap.friction}
              min={0}
              max={1}
              step={0.05}
              precision={2}
              onChange={(v) => {
                const b = matterEngineRef.current?.world.bodies.find((x) => x.id === selectedSnap.id);
                if (b) {
                  b.friction = v;
                  setSelectedSnap({ ...selectedSnap, friction: v });
                }
              }}
            />
          </div>
        ) : (
          <div className="text-xs text-slate-400">
            Click a body in 2D mode to edit its physical properties.
          </div>
        )
      }
    >
      {engineMode === '2d' ? (
        <canvas
          ref={canvas2DRef}
          onPointerDown={handle2DPointerDown}
          onPointerMove={handle2DPointerMove}
          onPointerUp={() => {
            draggingBodyRef.current = null;
          }}
          className="w-full h-full block cursor-crosshair touch-none"
        />
      ) : (
        <div ref={mount3DRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      )}
    </SimulationWorkspace>
  );
};
