import { SimulationId, SimulationMeta } from '../types/physics';

export const SIMULATIONS: SimulationMeta[] = [
  {
    id: 'gravity',
    title: 'Gravity and Space Simulator',
    shortTitle: 'Gravity & Orbits',
    category: 'Space & Gravity',
    engineLabel: 'Matter.js N-Body Gravity',
    difficulty: 'Beginner',
    summary:
      'Simulate planetary orbits, multi-body gravitational interactions, stars, moons, and slingshot trajectories with live force vectors and orbital trails.',
    modelNote:
      'Uses Matter.js rigid-body dynamics with zero uniform gravity and pairwise Newtonian inverse-square gravitational forces (with softening epsilon) applied each fixed sub-step.',
    accentHex: '#06B6D4',
    featured: true,
    equations: [
      {
        label: 'Newtonian Gravitation',
        formula: 'F = G * m1 * m2 / (r^2 + eps^2)',
        variables: [
          { symbol: 'G', name: 'Gravitational constant multiplier', unit: 'scaled' },
          { symbol: 'm1, m2', name: 'Body masses', unit: 'M_rel' },
          { symbol: 'r', name: 'Center-to-center separation', unit: 'AU_s' },
        ],
      },
      {
        label: 'Total Mechanical Energy',
        formula: 'E = sum(0.5 * m_i * v_i^2) - sum(G * m_i * m_j / r_ij)',
        variables: [
          { symbol: 'v_i', name: 'Orbital speed', unit: 'km/s eq.' },
          { symbol: 'E', name: 'Conserved system energy', unit: 'J eq.' },
        ],
      },
    ],
    metricsDescription: ['Kinetic Energy', 'Potential Energy', 'Total Energy', 'Selected Speed'],
  },
  {
    id: 'fluid',
    title: 'Fluid Dynamics Lab',
    shortTitle: 'Fluid Dynamics',
    category: 'Fluid Dynamics',
    engineLabel: 'Particle Advection & Pressure Grid',
    difficulty: 'Intermediate',
    summary:
      'Observe continuous fluid flow around draggable obstacles with adjustable viscosity, density, flow velocity, velocity vectors, and pressure coloring.',
    modelNote:
      'Simplified 2D Lagrangian particle advection coupled with an incompressible pressure-repulsion grid and obstacle boundary projection, rather than full 3D Navier-Stokes CFD.',
    accentHex: '#3B82F6',
    featured: true,
    equations: [
      {
        label: 'Reynolds Number Estimate',
        formula: 'Re = (rho * v * L) / mu',
        variables: [
          { symbol: 'rho', name: 'Fluid density', unit: 'kg/m^3' },
          { symbol: 'v', name: 'Characteristic flow speed', unit: 'm/s' },
          { symbol: 'L', name: 'Obstacle diameter', unit: 'm' },
          { symbol: 'mu', name: 'Dynamic viscosity', unit: 'Pa*s' },
        ],
      },
    ],
    metricsDescription: ['Mean Flow Speed', 'Estimated Re', 'Pressure Peak', 'Active Particles'],
  },
  {
    id: 'elements',
    title: 'Element and Material Simulator',
    shortTitle: 'Material Sandbox',
    category: 'Molecular Physics',
    engineLabel: 'Cellular Automata Grid',
    difficulty: 'Beginner',
    summary:
      'Draw falling sand, flowing water, ice, rising steam, buoyant oil, and stone walls while controlling gravity and ambient temperature phase transitions.',
    modelNote:
      'Discrete 2D cellular automata lattice modeling density-ordered displacement and thermal phase thresholds (0 C freeze, 100 C boil).',
    accentHex: '#F59E0B',
    equations: [
      {
        label: 'Phase Transition Thresholds',
        formula: 'T < 0 C (Solid Ice) | 0 C <= T < 100 C (Liquid) | T >= 100 C (Steam)',
        variables: [
          { symbol: 'T', name: 'Ambient temperature', unit: 'deg C' },
          { symbol: 'g', name: 'Downward acceleration', unit: 'm/s^2' },
        ],
      },
    ],
    metricsDescription: ['Solid Cells', 'Liquid Cells', 'Gas Cells', 'Ambient Temp'],
  },
  {
    id: 'electromagnetism',
    title: 'Electromagnetism Lab',
    shortTitle: 'Electromagnetism',
    category: 'Electromagnetism',
    engineLabel: 'Coulomb & Dipole Field Solver',
    difficulty: 'Intermediate',
    summary:
      'Place positive charges, negative charges, and magnetic dipoles to inspect electric field lines, potential maps, and live Lorentz test-particle motion.',
    modelNote:
      'Computes 2D electrostatic superposition and dipole magnetic flux density with RK2 field-line integration and Lorentz force F = q(E + v x B).',
    accentHex: '#06B6D4',
    featured: true,
    equations: [
      {
        label: 'Coulomb Electric Field',
        formula: 'E = sum( k_e * q_i * r_hat / (r^2 + eps^2) )',
        variables: [
          { symbol: 'q_i', name: 'Point charge', unit: 'uC' },
          { symbol: 'E', name: 'Electric field magnitude', unit: 'N/C' },
          { symbol: 'V', name: 'Electrostatic potential', unit: 'V' },
        ],
      },
    ],
    metricsDescription: ['Net Charge', 'Probe |E|', 'Probe Potential', 'Test Particles'],
  },
  {
    id: 'chaos',
    title: 'Chaos Theory Simulator',
    shortTitle: 'Chaos & Pendulums',
    category: 'Mechanics',
    engineLabel: 'RK4 Lagrangian Integrator',
    difficulty: 'Intermediate',
    summary:
      'Explore deterministic chaos in double pendulums, nonlinear single pendulums, and coupled spring-mass systems with dual-trajectory divergence comparison.',
    modelNote:
      'Integrates exact Euler-Lagrange equations of motion using 4th-order Runge-Kutta (RK4) with sub-stepping for high energy stability.',
    accentHex: '#3B82F6',
    featured: true,
    equations: [
      {
        label: 'Sensitivity to Initial Conditions',
        formula: '|delta_theta(t)| ~ |delta_theta(0)| * exp(lambda * t)',
        variables: [
          { symbol: 'theta', name: 'Angular displacement', unit: 'rad' },
          { symbol: 'omega', name: 'Angular velocity', unit: 'rad/s' },
          { symbol: 'lambda', name: 'Lyapunov divergence rate', unit: '1/s' },
        ],
      },
    ],
    metricsDescription: ['Primary Angles', 'Angular Divergence', 'Total Energy', 'Elapsed Time'],
  },
  {
    id: 'optics',
    title: 'Optics and Light Lab',
    shortTitle: 'Optics & Rays',
    category: 'Optics',
    engineLabel: 'Geometric Ray Tracer',
    difficulty: 'Beginner',
    summary:
      'Trace laser beams and spectral white light across mirrors, biconvex and biconcave lenses, and glass prisms with interactive Snell refraction and dispersion.',
    modelNote:
      '2D geometric optics solver applying Law of Reflection, Snell Law, Total Internal Reflection, and Cauchy wavelength dispersion.',
    accentHex: '#10B981',
    equations: [
      {
        label: 'Snell Law of Refraction',
        formula: 'n1 * sin(theta1) = n2(lambda) * sin(theta2)',
        variables: [
          { symbol: 'n', name: 'Refractive index', unit: 'dimensionless' },
          { symbol: 'theta1', name: 'Angle of incidence', unit: 'deg' },
          { symbol: 'theta2', name: 'Angle of refraction', unit: 'deg' },
        ],
      },
    ],
    metricsDescription: ['Active Rays', 'Critical Angle', 'Lens Power', 'Refractive Index'],
  },
  {
    id: 'collision',
    title: 'Collision Lab',
    shortTitle: 'Collision Lab',
    category: 'Mechanics',
    engineLabel: 'Matter.js Rigid Body',
    difficulty: 'Beginner',
    summary:
      'Collide spheres and blocks of configurable mass, velocity, size, and restitution to measure momentum conservation and elastic vs inelastic kinetic energy loss.',
    modelNote:
      'Powered by Matter.js 2D rigid-body impulse solver with configurable zero-drag frictionless mode and live momentum vector overlays.',
    accentHex: '#06B6D4',
    equations: [
      {
        label: 'Linear Momentum & Restitution',
        formula: 'p_total = sum(m_i * v_i),  e = -(v2f - v1f) / (v2i - v1i)',
        variables: [
          { symbol: 'p', name: 'Linear momentum', unit: 'kg*m/s' },
          { symbol: 'e', name: 'Coefficient of restitution', unit: '0 to 1' },
          { symbol: 'KE', name: 'Kinetic energy', unit: 'J' },
        ],
      },
    ],
    metricsDescription: ['Total Momentum', 'Kinetic Energy', 'Collision Count', 'Energy Delta'],
  },
  {
    id: 'spacetime',
    title: 'Space-Time Simulator',
    shortTitle: 'Space-Time 3D',
    category: 'Space & Gravity',
    engineLabel: 'Three.js Metric Embedding',
    difficulty: 'Advanced',
    summary:
      'Visualize gravitational potential curvature on a 3D deformable grid, black hole event horizons, orbital motion, and conceptual photon lensing paths.',
    modelNote:
      'Illustrative 3D embedding well (Flamm-style potential surface) and weak-field deflection approximation (4GM / c^2 b), rather than full tensorial General Relativity.',
    accentHex: '#3B82F6',
    featured: true,
    equations: [
      {
        label: 'Schwarzschild Radius & Light Deflection',
        formula: 'r_s = 2GM / c^2,  delta_phi ~ 4GM / (c^2 * b)',
        variables: [
          { symbol: 'r_s', name: 'Event horizon radius', unit: 'units' },
          { symbol: 'b', name: 'Photon impact parameter', unit: 'units' },
          { symbol: 'M', name: 'Central gravitating mass', unit: 'M_sun eq.' },
        ],
      },
    ],
    metricsDescription: ['Schwarzschild Radius', 'Escape Speed', 'Deflection Angle', 'Orbital Speed'],
  },
  {
    id: 'windtunnel',
    title: 'Wind Tunnel Lab',
    shortTitle: 'Wind Tunnel',
    category: 'Fluid Dynamics',
    engineLabel: 'Potential Flow & Drag Model',
    difficulty: 'Intermediate',
    summary:
      'Test cylinders, airfoils, flat plates, and prisms inside an adjustable airflow tunnel with smoke streamlines, pressure fields, and approximate drag readouts.',
    modelNote:
      'Uses analytical potential-flow superposition combined with wake turbulence modulation and empirical drag/lift coefficients (simplified model, not RANS CFD).',
    accentHex: '#0EA5E9',
    equations: [
      {
        label: 'Aerodynamic Drag Force',
        formula: 'F_d = 0.5 * rho * U^2 * C_d * A',
        variables: [
          { symbol: 'rho', name: 'Air density', unit: 'kg/m^3' },
          { symbol: 'U', name: 'Freestream velocity', unit: 'm/s' },
          { symbol: 'C_d', name: 'Shape drag coefficient', unit: 'approx.' },
        ],
      },
    ],
    metricsDescription: ['Freestream Speed', 'Dynamic Pressure', 'Approx. Cd', 'Est. Drag Force'],
  },
  {
    id: 'molecular',
    title: 'Molecular World',
    shortTitle: 'Molecular World',
    category: 'Molecular Physics',
    engineLabel: 'Velocity-Verlet Lennard-Jones',
    difficulty: 'Intermediate',
    summary:
      'Simulate interacting atoms across solid crystalline lattices, cohesive liquids, and kinetic ideal gases with real-time Maxwell-Boltzmann speed histograms.',
    modelNote:
      '2D Lennard-Jones short-range pair potential with Velocity-Verlet integration and velocity-rescaling thermostat.',
    accentHex: '#F59E0B',
    equations: [
      {
        label: 'Lennard-Jones Pair Potential',
        formula: 'V(r) = 4 * eps * [ (sigma / r)^12 - (sigma / r)^6 ]',
        variables: [
          { symbol: 'eps', name: 'Potential well depth', unit: 'kJ/mol eq.' },
          { symbol: 'sigma', name: 'Finite particle radius', unit: 'nm eq.' },
          { symbol: 'T', name: 'Kinetic temperature', unit: 'K' },
        ],
      },
    ],
    metricsDescription: ['Measured Temp', 'Wall Pressure', 'RMS Speed', 'Phase State'],
  },
  {
    id: 'playground',
    title: 'Physics Playground',
    shortTitle: 'Physics Playground',
    category: 'Mechanics',
    engineLabel: 'Matter.js 2D & Cannon-es 3D',
    difficulty: 'Beginner',
    summary:
      'Build open-ended mechanical contraptions using balls, boxes, ramps, springs, pendulums, and revolute joints in 2D Matter.js or drop structures in 3D Cannon-es.',
    modelNote:
      'Dual-engine sandbox powered by Matter.js for interactive 2D constraints/springs and Cannon-es + Three.js for 3D rigid-body stacking.',
    accentHex: '#10B981',
    featured: true,
    equations: [
      {
        label: 'Hooke Spring & Newton Second Law',
        formula: 'F_net = m * a,  F_spring = -k * x - c * v',
        variables: [
          { symbol: 'k', name: 'Spring stiffness', unit: 'N/m' },
          { symbol: 'mu', name: 'Surface friction', unit: '0 to 1' },
          { symbol: 'e', name: 'Elastic restitution', unit: '0 to 1' },
        ],
      },
    ],
    metricsDescription: ['Active Bodies', 'Constraints', 'Total KE', 'Gravity'],
  },
];

export const SIMULATION_MAP: Record<SimulationId, SimulationMeta> = SIMULATIONS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<SimulationId, SimulationMeta>
);
