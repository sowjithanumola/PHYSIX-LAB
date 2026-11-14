import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as CANNON from 'cannon-es';
import { Play, Pause, Plus, RotateCcw } from 'lucide-react';

interface DynamicSphereEntry {
  mesh: THREE.Mesh;
  body: CANNON.Body;
}

export const Featured3DPreview: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [gravityVal, setGravityVal] = useState(-9.81);
  const [activeBodies, setActiveBodies] = useState(5);

  const pausedRef = useRef(paused);
  const gravityRef = useRef(gravityVal);
  const spawnFnRef = useRef<(() => void) | null>(null);
  const resetFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    gravityRef.current = gravityVal;
  }, [gravityVal]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 560;
    const height = container.clientHeight || 360;

    // Detect software WebGL cleanly via renderer string
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
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070B14');
    scene.fog = new THREE.FogExp2('#070B14', 0.032);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(6.4, 4.4, 7.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 1.35, 0);
    controls.minDistance = 4.2;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI * 0.48;

    // 3-point laboratory lighting rig
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.7);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.1);
    keyLight.position.set(5, 9, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.2);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    // Procedural dial/scale texture for lab platform
    const dialCanvas = document.createElement('canvas');
    dialCanvas.width = 512;
    dialCanvas.height = 512;
    const dctx = dialCanvas.getContext('2d');
    if (dctx) {
      dctx.fillStyle = '#0F172A';
      dctx.fillRect(0, 0, 512, 512);
      dctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      dctx.lineWidth = 2;
      for (const r of [80, 140, 200, 236]) {
        dctx.beginPath();
        dctx.arc(256, 256, r, 0, Math.PI * 2);
        dctx.stroke();
      }
      for (let i = 0; i < 36; i++) {
        const ang = (i / 36) * Math.PI * 2;
        const inner = i % 3 === 0 ? 198 : 214;
        dctx.beginPath();
        dctx.moveTo(256 + Math.cos(ang) * inner, 256 + Math.sin(ang) * inner);
        dctx.lineTo(256 + Math.cos(ang) * 236, 256 + Math.sin(ang) * 236);
        dctx.stroke();
      }
    }
    const dialTex = new THREE.CanvasTexture(dialCanvas);
    dialTex.colorSpace = THREE.SRGBColorSpace;
    dialTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Composite multi-part 3D laboratory apparatus (THREE.Group)
    const rigGroup = new THREE.Group();
    const darkAnodizedMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.72,
      roughness: 0.42,
    });
    const brushedAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.22,
    });
    const dialSurfaceMat = new THREE.MeshStandardMaterial({
      map: dialTex,
      metalness: 0.35,
      roughness: 0.55,
    });
    const cyanAccentMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.4,
      roughness: 0.3,
      emissive: 0x083344,
      emissiveIntensity: 0.45,
    });

    // Part 1: Stepped octagonal/circular base plate
    const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.8, 0.28, 48), darkAnodizedMat);
    basePlinth.position.y = 0.14;
    basePlinth.receiveShadow = true;
    rigGroup.add(basePlinth);

    // Part 2: Calibrated platform surface disc
    const platformDisc = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 0.08, 48), dialSurfaceMat);
    platformDisc.position.y = 0.32;
    platformDisc.receiveShadow = true;
    rigGroup.add(platformDisc);

    // Part 3: Brushed perimeter collar ring
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(3.26, 0.07, 16, 64), brushedAlloyMat);
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = 0.36;
    rigGroup.add(collarRing);

    // Part 4-7: 4 Structural stanchion pillars + upper gantry ring
    const gantryRadius = 2.6;
    const gantryHeight = 3.6;
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, gantryHeight, 16), brushedAlloyMat);
      pillar.position.set(Math.cos(ang) * gantryRadius, 0.36 + gantryHeight / 2, Math.sin(ang) * gantryRadius);
      pillar.castShadow = true;
      rigGroup.add(pillar);

      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 16), darkAnodizedMat);
      foot.position.set(Math.cos(ang) * gantryRadius, 0.42, Math.sin(ang) * gantryRadius);
      rigGroup.add(foot);
    }

    // Part 8: Upper gantry crown ring
    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(gantryRadius, 0.08, 16, 64), darkAnodizedMat);
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.y = 0.36 + gantryHeight;
    rigGroup.add(crownRing);

    // Part 9: Cross-bar beam for cradle suspension
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.18), brushedAlloyMat);
    crossBeam.position.set(0, 3.96, 0);
    rigGroup.add(crossBeam);

    // Part 10: Glowing laser alignment ring inset
    const alignmentRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.02, 12, 48), cyanAccentMat);
    alignmentRing.rotation.x = Math.PI / 2;
    alignmentRing.position.y = 0.37;
    rigGroup.add(alignmentRing);

    scene.add(rigGroup);

    // Grounded subtle floor plane
    const floorGrid = new THREE.GridHelper(28, 28, 0x1e293b, 0x0f172a);
    floorGrid.position.y = 0.005;
    scene.add(floorGrid);

    // Cannon-es 3D Physics World
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, gravityRef.current, 0),
    });
    world.broadphase = new CANNON.SAPBroadphase(world);
    const sphereMat = new CANNON.Material('sphere');
    const groundMat = new CANNON.Material('ground');
    world.addContactMaterial(
      new CANNON.ContactMaterial(sphereMat, groundMat, {
        friction: 0.25,
        restitution: 0.82,
      })
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(sphereMat, sphereMat, {
        friction: 0.1,
        restitution: 0.92,
      })
    );

    const floorBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: groundMat,
      shape: new CANNON.Cylinder(3.25, 3.25, 0.4, 24),
      position: new CANNON.Vec3(0, 0.16, 0),
    });
    world.addBody(floorBody);

    // Invisible perimeter containment rim in Cannon-es so balls bounce inside the testbed
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const wall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        material: groundMat,
        shape: new CANNON.Box(new CANNON.Vec3(0.7, 0.5, 0.1)),
        position: new CANNON.Vec3(Math.cos(ang) * 3.15, 0.75, Math.sin(ang) * 3.15),
      });
      wall.quaternion.setFromEuler(0, -ang + Math.PI / 2, 0);
      world.addBody(wall);
    }

    // Dynamic Cannon-es spheres + metallic PBR visuals
    const sphereGeo = new THREE.SphereGeometry(0.34, 28, 28);
    const palette = [0x06b6d4, 0x3b82f6, 0xf59e0b, 0x10b981, 0xe2e8f0];
    const spheres: DynamicSphereEntry[] = [];

    const createSphere = (x: number, y: number, z: number, vx = 0, vz = 0) => {
      if (spheres.length >= 16) {
        const oldest = spheres.shift();
        if (oldest) {
          scene.remove(oldest.mesh);
          world.removeBody(oldest.body);
          (oldest.mesh.material as THREE.Material).dispose();
        }
      }
      const color = palette[spheres.length % palette.length];
      const mat = new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.85,
        roughness: 0.18,
        clearcoat: 0.6,
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const body = new CANNON.Body({
        mass: 1.5,
        material: sphereMat,
        shape: new CANNON.Sphere(0.34),
        position: new CANNON.Vec3(x, y, z),
        velocity: new CANNON.Vec3(vx, 0, vz),
      });
      world.addBody(body);
      spheres.push({ mesh, body });
      setActiveBodies(spheres.length);
    };

    const seedInitialSpheres = () => {
      while (spheres.length > 0) {
        const entry = spheres.pop();
        if (entry) {
          scene.remove(entry.mesh);
          world.removeBody(entry.body);
          (entry.mesh.material as THREE.Material).dispose();
        }
      }
      createSphere(-1.4, 2.5, 0.1, 2.2, 0.4);
      createSphere(1.2, 2.2, -0.4, -1.8, 0.9);
      createSphere(0.1, 3.1, 1.1, 0.3, -1.9);
      createSphere(-0.4, 1.4, -1.2, 1.1, 1.4);
      createSphere(0.5, 0.8, 0.0, -0.5, 0.2);
    };

    seedInitialSpheres();

    spawnFnRef.current = () => {
      const ang = Math.random() * Math.PI * 2;
      createSphere(
        Math.cos(ang) * 0.9,
        3.3,
        Math.sin(ang) * 0.9,
        (Math.random() - 0.5) * 3.2,
        (Math.random() - 0.5) * 3.2
      );
    };

    resetFnRef.current = () => {
      seedInitialSpheres();
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!pausedRef.current) {
        world.gravity.set(0, gravityRef.current, 0);
        world.step(1 / 60, dt, 3);
        for (const s of spheres) {
          if (s.body.position.y < -2) {
            s.body.position.set(0, 2.8, 0);
            s.body.velocity.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
          }
          s.mesh.position.set(s.body.position.x, s.body.position.y, s.body.position.z);
          s.mesh.quaternion.set(
            s.body.quaternion.x,
            s.body.quaternion.y,
            s.body.quaternion.z,
            s.body.quaternion.w
          );
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 560;
      const h = container.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      sphereGeo.dispose();
      dialTex.dispose();
      darkAnodizedMat.dispose();
      brushedAlloyMat.dispose();
      dialSurfaceMat.dispose();
      cyanAccentMat.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative rounded-lg border border-slate-800 bg-[#070B14] overflow-hidden flex flex-col">
      <div className="px-3.5 py-2.5 border-b border-slate-800 bg-[#0A101D] flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-mono text-cyan-400">3D Cannon-es + Three.js Preview</div>
          <div className="text-xs font-medium text-slate-200">Rigid-Body Containment Arena</div>
        </div>
        <span className="text-[11px] font-mono tabular-nums text-slate-400">
          {activeBodies} spheres
        </span>
      </div>

      <div ref={mountRef} className="w-full h-[300px] sm:h-[340px] cursor-grab active:cursor-grabbing" />

      {/* Bottom compact control bar (zero viewport center occlusion) */}
      <div className="px-3 py-2 border-t border-slate-800 bg-[#0A101D] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 flex items-center gap-1.5 cursor-pointer"
          >
            {paused ? <Play className="w-3.5 h-3.5 text-cyan-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </button>
          <button
            type="button"
            onClick={() => spawnFnRef.current?.()}
            className="px-2.5 py-1.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-medium text-cyan-200 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Drop Sphere</span>
          </button>
          <button
            type="button"
            onClick={() => resetFnRef.current?.()}
            className="p-1.5 rounded-md border border-slate-800 hover:bg-slate-800 text-slate-300 cursor-pointer"
            title="Reset 3D arena"
            aria-label="Reset 3D arena"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Gravity</span>
          <input
            type="range"
            min={-20}
            max={-1}
            step={0.5}
            value={gravityVal}
            onChange={(e) => setGravityVal(parseFloat(e.target.value))}
            className="lab-slider w-20"
            aria-label="3D preview gravity"
          />
          <span className="font-mono tabular-nums text-cyan-300 w-14 text-right">
            {gravityVal.toFixed(1)} m/s²
          </span>
        </div>
      </div>
    </div>
  );
};
