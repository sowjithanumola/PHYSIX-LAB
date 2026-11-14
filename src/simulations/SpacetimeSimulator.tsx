import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimulationWorkspace } from '../components/workspace/SimulationWorkspace';
import { SliderControl, ToggleControl } from '../components/ui/LabControls';
import { TelemetryMetric, TelemetrySeriesPoint } from '../types/physics';

interface SpacetimeSimulatorProps {
  initialParams?: Record<string, unknown>;
  presetId?: string;
  onOpenLearn?: () => void;
}

export const SpacetimeSimulator: React.FC<SpacetimeSimulatorProps> = ({
  initialParams,
  presetId,
  onOpenLearn,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState((initialParams?.preset as string) || presetId || 'black-hole');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);

  const [centralMass, setCentralMass] = useState(Number(initialParams?.centralMass ?? 4.5));
  const [orbitRadius, setOrbitRadius] = useState(Number(initialParams?.orbitRadius ?? 4.8));
  const [showLensing, setShowLensing] = useState(true);
  const [showAccretion, setShowAccretion] = useState(true);

  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);

  const stateRef = useRef({
    preset,
    isPlaying,
    speed,
    centralMass,
    orbitRadius,
    showLensing,
    showAccretion,
  });

  useEffect(() => {
    stateRef.current = {
      preset,
      isPlaying,
      speed,
      centralMass,
      orbitRadius,
      showLensing,
      showAccretion,
    };
  }, [preset, isPlaying, speed, centralMass, orbitRadius, showLensing, showAccretion]);

  const potentialCurve = useMemo<TelemetrySeriesPoint[]>(() => {
    const pts: TelemetrySeriesPoint[] = [];
    for (let r = 1.2; r <= 9.0; r += 0.4) {
      const pot = -centralMass / r;
      const defl = (4 * centralMass) / (r * 3.5);
      pts.push({ t: +r.toFixed(1), potential: +pot.toFixed(2), deflectionDeg: +(defl * 18).toFixed(2) });
    }
    return pts;
  }, [centralMass]);

  const updateMetrics = useCallback(() => {
    const rs = 0.28 * centralMass;
    const escapeV = Math.sqrt((2 * centralMass * 12) / Math.max(1.2, orbitRadius));
    const orbitV = Math.sqrt((centralMass * 12) / Math.max(1.2, orbitRadius));
    const deflectDeg = ((4 * centralMass) / (Math.max(1.5, orbitRadius) * 3.5)) * 18;
    setMetrics([
      { id: 'rs', label: 'Horizon Radius r_s', value: rs.toFixed(2), unit: 'units', tone: 'rose' },
      { id: 'vesc', label: 'Escape Speed at r', value: escapeV.toFixed(2), unit: 'u/s', tone: 'amber' },
      { id: 'vorb', label: 'Circular Orbit Speed', value: orbitV.toFixed(2), unit: 'u/s', tone: 'cyan' },
      { id: 'lens', label: 'Approx. Lensing Bend', value: deflectDeg.toFixed(1), unit: 'deg', tone: 'emerald' },
    ]);
  }, [centralMass, orbitRadius]);

  useEffect(() => {
    updateMetrics();
  }, [updateMetrics]);

  useEffect(() => {
    const container = mountRef.current;
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

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050811');
    scene.fog = new THREE.FogExp2('#050811', 0.025);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    camera.position.set(0, 10.5, 14.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 30;

    scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(8, 12, 6);
    scene.add(keyLight);

    // Deformable spacetime embedding mesh
    const gridGeo = new THREE.PlaneGeometry(18, 18, 56, 56);
    gridGeo.rotateX(-Math.PI / 2);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.48,
    });
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    scene.add(gridMesh);

    // Central compact mass / black hole
    const coreGeo = new THREE.SphereGeometry(1, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x02040a,
      roughness: 0.2,
      metalness: 0.1,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Accretion ring
    const ringGeo = new THREE.RingGeometry(1.35, 2.55, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const accretionRing = new THREE.Mesh(ringGeo, ringMat);
    scene.add(accretionRing);

    // Orbiting test planet
    const planetGeo = new THREE.SphereGeometry(0.32, 24, 24);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.35,
      metalness: 0.4,
      emissive: 0x082f49,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    scene.add(planetMesh);

    // Gravitational lensing photon beams (5 impact parameters)
    const lensingLines: THREE.Line[] = [];
    const rayMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(42 * 3), 3));
      const line = new THREE.Line(geo, rayMat);
      scene.add(line);
      lensingLines.push(line);
    }

    const posAttr = gridGeo.attributes.position as THREE.BufferAttribute;
    let angle = 0;
    let elapsed = 0;
    let frameId = 0;
    let disposed = false;
    let lastTs = performance.now();

    const updateGeometry = (mass: number, orbR: number, showLens: boolean, showAcc: boolean, pMode: string) => {
      // Deform spacetime grid according to -M / sqrt(r^2 + eps)
      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        const x = posAttr.getX(i);
        const z = posAttr.getZ(i);
        const r = Math.hypot(x, z);
        let y = -(mass * 1.15) / Math.sqrt(r * r + 1.1);
        if (pMode === 'binary') {
          const r1 = Math.hypot(x - 2.4, z);
          const r2 = Math.hypot(x + 2.4, z);
          y = -(mass * 0.65) / Math.sqrt(r1 * r1 + 0.9) - (mass * 0.65) / Math.sqrt(r2 * r2 + 0.9);
        }
        posAttr.setY(i, Math.max(-5.5, y));
      }
      posAttr.needsUpdate = true;

      // Update central horizon size & color
      const rs = Math.max(0.35, 0.16 * mass);
      coreMesh.scale.setScalar(rs);
      coreMat.color.setHex(pMode === 'star' ? 0xf59e0b : 0x02040a);
      coreMat.emissive.setHex(pMode === 'star' ? 0xb45309 : 0x000000);
      coreMesh.position.y = -(mass * 1.15) / Math.sqrt(1.1) + rs * 0.45;

      accretionRing.visible = showAcc && pMode !== 'star';
      accretionRing.position.y = coreMesh.position.y;
      accretionRing.scale.setScalar(rs * 1.1);

      // Update orbiting planet on curved surface
      const px = Math.cos(angle) * orbR;
      const pz = Math.sin(angle) * orbR;
      const py = -(mass * 1.15) / Math.sqrt(orbR * orbR + 1.1) + 0.35;
      planetMesh.position.set(px, py, pz);

      // Conceptual photon lensing paths
      const offsets = [-4.2, -2.8, -1.6, 1.6, 2.8, 4.2];
      for (let li = 0; li < lensingLines.length; li++) {
        const line = lensingLines[li];
        line.visible = showLens;
        if (!showLens) continue;
        const b = offsets[li];
        const attr = line.geometry.attributes.position as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        let rx = -8.5;
        let rz = b;
        let vx = 0.42;
        let vz = 0;
        for (let s = 0; s < 42; s++) {
          const r2 = rx * rx + rz * rz + 0.7;
          const r = Math.sqrt(r2);
          // Weak-field inward deflection impulse proportional to GM / r^2
          const pull = (mass * 0.042) / r2;
          vx -= (rx / r) * pull;
          vz -= (rz / r) * pull;
          const spd = Math.hypot(vx, vz) || 1;
          vx = (vx / spd) * 0.42;
          vz = (vz / spd) * 0.42;
          rx += vx;
          rz += vz;
          const ry = -(mass * 1.15) / Math.sqrt(rx * rx + rz * rz + 1.1) + 0.15;
          arr[s * 3] = rx;
          arr[s * 3 + 1] = ry;
          arr[s * 3 + 2] = rz;
        }
        attr.needsUpdate = true;
      }
    };

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
      const dt = Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;

      const st = stateRef.current;
      if (st.isPlaying) {
        const omega = Math.sqrt(st.centralMass / Math.pow(Math.max(1.5, st.orbitRadius), 3)) * 1.9;
        angle += omega * dt * st.speed;
        elapsed += dt * st.speed;
        accretionRing.rotation.z += dt * 0.6;
        setSimTime(elapsed);
      }

      updateGeometry(st.centralMass, st.orbitRadius, st.showLensing, st.showAccretion, st.preset);
      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      gridGeo.dispose();
      gridMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      planetGeo.dispose();
      planetMat.dispose();
      rayMat.dispose();
      lensingLines.forEach((l) => l.geometry.dispose());
      renderer.dispose();
    };
  }, []);

  return (
    <SimulationWorkspace
      simId="spacetime"
      isPlaying={isPlaying}
      onTogglePlay={() => setIsPlaying((p) => !p)}
      onStep={() => {}}
      onReset={() => {
        setCentralMass(4.5);
        setOrbitRadius(4.8);
        setSimTime(0);
      }}
      speed={speed}
      onSpeedChange={setSpeed}
      zoom={zoom}
      onZoomChange={setZoom}
      simTime={simTime}
      metrics={metrics}
      seriesData={potentialCurve}
      chartTitle="Gravitational Potential V(r) & Conceptual Deflection vs Radial Distance"
      chartSeries={[
        { key: 'potential', label: 'Potential V(r)', color: '#06B6D4' },
        { key: 'deflectionDeg', label: 'Deflection (deg)', color: '#F59E0B' },
      ]}
      currentParams={{ preset, centralMass, orbitRadius, showLensing, showAccretion }}
      hintText="Orbit camera by dragging in 3D space; scroll to zoom."
      onOpenLearn={onOpenLearn}
      controlsPanel={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">Compact Object Preset</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="w-full px-2.5 py-2 rounded-md bg-[#070B14] border border-slate-700 text-xs text-slate-100"
            >
              <option value="black-hole">Schwarzschild Black Hole</option>
              <option value="star">Massive Main-Sequence Star</option>
              <option value="binary">Binary Potential Well</option>
            </select>
          </div>

          <SliderControl
            label="Central Mass (M)"
            value={centralMass}
            min={1.0}
            max={9.0}
            step={0.2}
            precision={1}
            unit="M_rel"
            onChange={setCentralMass}
          />
          <SliderControl
            label="Orbital Radius (r)"
            value={orbitRadius}
            min={1.8}
            max={8.0}
            step={0.2}
            precision={1}
            unit="units"
            onChange={setOrbitRadius}
          />
          <ToggleControl
            label="Conceptual Photon Lensing"
            checked={showLensing}
            onChange={setShowLensing}
            description="Show bent null-geodesic light rays"
          />
          <ToggleControl
            label="Accretion Disc"
            checked={showAccretion}
            onChange={setShowAccretion}
          />
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </SimulationWorkspace>
  );
};
