import { LearnModule } from '../types/physics';

export const LEARN_MODULES: LearnModule[] = [
  {
    id: 'learn-orbital-mechanics',
    title: 'Orbital Mechanics and Inverse-Square Gravity',
    category: 'Space & Gravity',
    difficulty: 'Beginner',
    simId: 'gravity',
    presetId: 'sun-earth-moon',
    overview:
      'Orbits occur when a body moves forward fast enough that its curved path falls around a central mass rather than colliding into it. Gravitational attraction scales inversely with the square of separation distance.',
    formula: 'F = G * m1 * m2 / r^2,   v_circ = sqrt(G * M / r)',
    variables: [
      { symbol: 'F', description: 'Gravitational force magnitude', unit: 'N (scaled)' },
      { symbol: 'G', description: 'Universal gravitational constant', unit: 'm^3 kg^-1 s^-2' },
      { symbol: 'M', description: 'Central body mass', unit: 'kg (scaled)' },
      { symbol: 'r', description: 'Distance between centers of mass', unit: 'm (scaled)' },
    ],
    guidedSteps: [
      'Open the Gravity and Space Simulator with the Sun-Earth-Moon preset.',
      'Select the orbiting planet and increase its tangential velocity by 25% to observe an elliptical transfer orbit.',
      'Enable Force Vectors to verify that the gravitational acceleration vector always points toward the barycenter.',
      'Observe the Total Mechanical Energy trace in Live Science Data: kinetic energy rises at periapsis while potential energy drops.',
    ],
    realWorldApplications: [
      'Geostationary communications satellites and GPS constellation station-keeping',
      'Interplanetary Hohmann transfer orbits and gravity-assist flybys',
      'Exoplanet radial-velocity and astrometric detection',
    ],
    quiz: [
      {
        id: 'q-orb-1',
        prompt: 'If the distance between two planets doubles while their masses stay constant, what happens to the gravitational force between them?',
        options: [
          'It decreases to one-quarter of the original force',
          'It decreases to one-half of the original force',
          'It doubles',
          'It stays unchanged',
        ],
        correctIndex: 0,
        explanation: 'Because gravity follows an inverse-square law (1 / r^2), doubling r divides the force by 2^2 = 4.',
      },
      {
        id: 'q-orb-2',
        prompt: 'At the closest approach (periapsis) of an elliptical orbit, how does the orbiting body move?',
        options: [
          'At its slowest speed and highest potential energy',
          'At its fastest speed and lowest potential energy',
          'At constant speed throughout the orbit',
          'Directly away from the star at zero acceleration',
        ],
        correctIndex: 1,
        explanation: 'Conservation of energy and angular momentum require maximum kinetic energy (highest speed) when potential energy is lowest at minimum radius.',
      },
    ],
  },
  {
    id: 'learn-collisions-momentum',
    title: 'Conservation of Momentum and Restitution',
    category: 'Mechanics',
    difficulty: 'Beginner',
    simId: 'collision',
    presetId: 'elastic-head-on',
    overview:
      'In any isolated collision without external net forces, total linear momentum is conserved. However, kinetic energy is only conserved in perfectly elastic collisions (e = 1); inelastic collisions convert part of kinetic energy into heat and deformation.',
    formula: 'm1*v1 + m2*v2 = m1*v1_f + m2*v2_f',
    variables: [
      { symbol: 'p', description: 'Linear momentum vector (m * v)', unit: 'kg*m/s' },
      { symbol: 'e', description: 'Coefficient of restitution', unit: '0 to 1' },
      { symbol: 'KE', description: 'Translational kinetic energy (0.5 * m * v^2)', unit: 'J' },
    ],
    guidedSteps: [
      'Launch Collision Lab with the Head-On Elastic preset (restitution e = 1.0).',
      'Watch two equal masses collide: the moving mass stops and transfers 100% of its momentum to the stationary mass.',
      'Lower restitution to e = 0.2 (inelastic) and reset the trial.',
      'Compare the Total Momentum line (conserved across impact) against the Kinetic Energy curve (drops sharply at impact).',
    ],
    realWorldApplications: [
      'Automotive crumple zones designed to absorb kinetic energy in inelastic impacts',
      'Billiard ball dynamics and particle accelerator scattering measurements',
      'Spacecraft docking shock-absorption mechanisms',
    ],
    quiz: [
      {
        id: 'q-col-1',
        prompt: 'Which quantity is conserved in BOTH elastic and inelastic collisions inside an isolated system?',
        options: [
          'Total kinetic energy',
          'Total linear momentum',
          'Individual object speed',
          'Temperature',
        ],
        correctIndex: 1,
        explanation: 'Internal collision forces cancel in equal-and-opposite Newton third-law pairs, preserving total linear momentum regardless of elasticity.',
      },
    ],
  },
  {
    id: 'learn-snells-optics',
    title: 'Snell Law, Critical Angle, and Dispersion',
    category: 'Optics',
    difficulty: 'Beginner',
    simId: 'optics',
    presetId: 'prism-dispersion',
    overview:
      'Light changes speed when entering a transparent medium of refractive index n = c / v, causing the wavefront to bend toward or away from the surface normal. Because glass bends shorter blue wavelengths slightly more than red wavelengths, white light separates into a spectrum.',
    formula: 'n1 * sin(theta1) = n2 * sin(theta2),   theta_c = arcsin(n2 / n1)',
    variables: [
      { symbol: 'n1, n2', description: 'Refractive indices of incident and transmitting media', unit: 'dimensionless' },
      { symbol: 'theta1', description: 'Angle from surface normal (incident)', unit: 'deg' },
      { symbol: 'theta_c', description: 'Total internal reflection threshold', unit: 'deg' },
    ],
    guidedSteps: [
      'Launch Optics and Light Lab with the Prism Dispersion preset.',
      'Adjust the prism refractive index slider from 1.33 (water-like) up to 2.0 (dense flint glass) and watch the rainbow fan widen.',
      'Switch to the Total Internal Reflection preset and rotate the ray angle past the critical angle to see 100% reflection.',
    ],
    realWorldApplications: [
      'Fiber-optic internet cables relying on total internal reflection',
      'Camera telephoto lenses and corrective eyeglasses',
      'Spectrometers analyzing starlight chemical composition',
    ],
    quiz: [
      {
        id: 'q-opt-1',
        prompt: 'When does Total Internal Reflection occur?',
        options: [
          'When light moves from a lower-index medium to a higher-index medium',
          'When light strikes a higher-to-lower index boundary beyond the critical angle',
          'Only in vacuum',
          'When refractive index equals zero',
        ],
        correctIndex: 1,
        explanation: 'Total internal reflection requires n1 > n2 and an angle of incidence exceeding arcsin(n2 / n1).',
      },
    ],
  },
  {
    id: 'learn-electromagnetism',
    title: 'Electric Fields, Superposition, and Lorentz Motion',
    category: 'Electromagnetism',
    difficulty: 'Intermediate',
    simId: 'electromagnetism',
    presetId: 'dipole',
    overview:
      'Every electric charge alters the space around it by creating a vector electric field E. The net field at any point is the linear vector sum of fields from all charges. Moving charges in magnetic fields experience a perpendicular Lorentz force.',
    formula: 'E = k_e * q / r^2,   F = q * (E + v x B)',
    variables: [
      { symbol: 'q', description: 'Electric charge magnitude', unit: 'uC' },
      { symbol: 'E', description: 'Electric field vector', unit: 'N/C' },
      { symbol: 'B', description: 'Magnetic flux density', unit: 'T (scaled)' },
    ],
    guidedSteps: [
      'Open Electromagnetism Lab in Dipole preset mode.',
      'Drag the negative charge closer to the positive charge and inspect the electric field lines and potential heatmap.',
      'Switch to Test Particle mode and launch a positive probe charge to observe curved acceleration trajectories.',
    ],
    realWorldApplications: [
      'Particle accelerators and mass spectrometers separating isotopes by charge-to-mass ratio',
      'Capacitors, electrostatic precipitators, and touch-screen capacitive sensing',
      'Magnetic confinement in fusion plasma research',
    ],
    quiz: [
      {
        id: 'q-em-1',
        prompt: 'By convention, electric field lines point in which direction?',
        options: [
          'From negative charges toward positive charges',
          'Away from positive charges and toward negative charges',
          'Always in closed circles around stationary point charges',
          'Parallel to equipotential surfaces',
        ],
        correctIndex: 1,
        explanation: 'Field lines trace the force on a positive test charge, pointing outward from +q and inward toward -q, perpendicular to equipotentials.',
      },
    ],
  },
  {
    id: 'learn-chaos-pendulum',
    title: 'Deterministic Chaos in Double Pendulums',
    category: 'Mechanics',
    difficulty: 'Intermediate',
    simId: 'chaos',
    presetId: 'double-butterfly',
    overview:
      'A double pendulum obeys completely deterministic Newtonian equations with zero randomness, yet tiny differences in starting angle grow exponentially over time, making long-term prediction practically impossible.',
    formula: '|delta_theta(t)| ~ |delta_theta(0)| * exp(lambda * t)',
    variables: [
      { symbol: 'theta1, theta2', description: 'Upper and lower arm angles', unit: 'rad' },
      { symbol: 'lambda', description: 'Largest Lyapunov exponent', unit: '1/s' },
      { symbol: 'L1, L2', description: 'Pendulum rod lengths', unit: 'm' },
    ],
    guidedSteps: [
      'Open Chaos Theory Simulator with Compare Perturbed Twin enabled (0.001 rad offset).',
      'Press Play and observe how the cyan and amber pendulums track identically for the first few seconds.',
      'Watch the Angular Divergence graph climb exponentially as the trajectories split onto completely different paths.',
      'Lower initial angle below 0.25 rad to observe nearly periodic, non-chaotic motion at low energy.',
    ],
    realWorldApplications: [
      'Atmospheric weather forecasting limits and ensemble modeling',
      'Three-body orbital instability in asteroid belts',
      'Turbulent mixing and nonlinear electrical oscillators',
    ],
    quiz: [
      {
        id: 'q-chaos-1',
        prompt: 'Why is a double pendulum called deterministically chaotic?',
        options: [
          'Because random noise is added at every timestep',
          'Because exact equations produce exponential sensitivity to tiny initial differences',
          'Because energy is never conserved in mechanics',
          'Because gravity fluctuates randomly',
        ],
        correctIndex: 1,
        explanation: 'Deterministic chaos arises from nonlinear coupling without any randomness: tiny initial perturbations amplify exponentially.',
      },
    ],
  },
  {
    id: 'learn-fluid-aerodynamics',
    title: 'Bernoulli Principle, Drag, and Reynolds Number',
    category: 'Fluid Dynamics',
    difficulty: 'Intermediate',
    simId: 'windtunnel',
    presetId: 'airfoil',
    overview:
      'Aerodynamic drag depends on fluid density, object frontal area, shape drag coefficient, and the square of flow speed. Streamlined profiles delay flow separation and reduce pressure drag dramatically compared to blunt flat plates.',
    formula: 'F_d = 0.5 * rho * U^2 * C_d * A,   Re = rho * U * L / mu',
    variables: [
      { symbol: 'U', description: 'Freestream airflow speed', unit: 'm/s' },
      { symbol: 'C_d', description: 'Drag coefficient', unit: 'dimensionless' },
      { symbol: 'Re', description: 'Reynolds number (inertial vs viscous ratio)', unit: 'dimensionless' },
    ],
    guidedSteps: [
      'Open Wind Tunnel Lab and select the Flat Plate shape at 20 m/s.',
      'Record the approximate drag force and observe the wide low-pressure wake behind the plate.',
      'Switch to the Streamlined Airfoil and note the sharp reduction in Cd and smoother streamlines.',
      'Increase the Angle of Attack past 15 degrees to visualize flow separation and stall behavior.',
    ],
    realWorldApplications: [
      'Aircraft wing lift-to-drag optimization',
      'High-speed train and electric vehicle aerodynamic body shaping',
      'Wind turbine blade pitch control',
    ],
    quiz: [
      {
        id: 'q-fluid-1',
        prompt: 'If airflow speed U doubles, by what factor does aerodynamic drag force increase (assuming constant Cd)?',
        options: ['2x', '4x', '8x', 'It stays constant'],
        correctIndex: 1,
        explanation: 'Drag scales with U^2, so doubling speed quadruples dynamic pressure and drag force.',
      },
    ],
  },
  {
    id: 'learn-molecular-phases',
    title: 'Kinetic Molecular Theory and Phase States',
    category: 'Molecular Physics',
    difficulty: 'Intermediate',
    simId: 'molecular',
    presetId: 'phase-transition',
    overview:
      'Temperature is proportional to the average translational kinetic energy of atoms. When thermal energy is low compared to Lennard-Jones interatomic attraction, particles lock into a solid lattice; raising temperature melts the lattice into a liquid and then vaporizes it into a gas.',
    formula: 'KE_avg = (d / 2) * k_B * T,   V_LJ(r) = 4*eps*((sigma/r)^12 - (sigma/r)^6)',
    variables: [
      { symbol: 'T', description: 'Absolute temperature', unit: 'K' },
      { symbol: 'eps', description: 'Intermolecular well depth', unit: 'scaled energy' },
      { symbol: 'v_rms', description: 'Root-mean-square molecular speed', unit: 'm/s eq.' },
    ],
    guidedSteps: [
      'Launch Molecular World at 40 K to observe an ordered vibrating solid crystal.',
      'Raise Temperature to 180 K so particles overcome rigid lattice sites while staying cohesive as a liquid.',
      'Raise Temperature to 500 K and watch the Maxwell-Boltzmann speed histogram broaden as particles fill the container as a gas.',
    ],
    realWorldApplications: [
      'Cryogenic liquefaction of natural gas and rocket propellants',
      'Materials engineering and crystal annealing processes',
      'Thermodynamic heat engines and refrigeration cycles',
    ],
    quiz: [
      {
        id: 'q-mol-1',
        prompt: 'What physical quantity directly increases when you raise the temperature of a monatomic ideal gas?',
        options: [
          'Particle mass',
          'Average kinetic energy per molecule',
          'Particle radius',
          'Gravitational constant',
        ],
        correctIndex: 1,
        explanation: 'Temperature measures average microscopic kinetic energy; faster particle speeds produce higher wall collision pressure.',
      },
    ],
  },
  {
    id: 'learn-spacetime-curvature',
    title: 'Gravitational Potential Wells and Conceptual Lensing',
    category: 'Space & Gravity',
    difficulty: 'Advanced',
    simId: 'spacetime',
    presetId: 'black-hole',
    overview:
      'In General Relativity, mass-energy curves four-dimensional spacetime, and free-falling objects and light rays follow geodesics. A 3D potential embedding surface helps visualize how proximity to compact masses steepens curvature and bends passing light.',
    formula: 'r_s = 2GM / c^2,   delta_phi ~ 4GM / (c^2 * b)',
    variables: [
      { symbol: 'r_s', description: 'Schwarzschild event horizon radius', unit: 'scaled' },
      { symbol: 'b', description: 'Closest-approach impact parameter', unit: 'scaled' },
      { symbol: 'delta_phi', description: 'Weak-field light deflection angle', unit: 'rad' },
    ],
    guidedSteps: [
      'Launch Space-Time Simulator with the Black Hole preset.',
      'Increase Central Mass and observe the Schwarzschild horizon sphere expand as the spacetime grid deepens.',
      'Emit Photon Beams at varying impact parameters to see rays passing closer to the mass deflect more strongly.',
      'Review the model note distinguishing this 3D potential surface from full 4D tensorial General Relativity.',
    ],
    realWorldApplications: [
      'Gravitational lensing arcs used by astronomers to map dark matter halos',
      'Event Horizon Telescope imaging of supermassive black hole shadows',
      'Relativistic clock corrections required for GPS satellite accuracy',
    ],
    quiz: [
      {
        id: 'q-st-1',
        prompt: 'Why does a photon passing near a massive star bend even though a photon has zero rest mass?',
        options: [
          'Because light follows null geodesics through curved spacetime',
          'Because photons carry electric charge',
          'Because air resistance slows the photon down',
          'Because photons have infinite rest mass',
        ],
        correctIndex: 0,
        explanation: 'Spacetime geometry governs the paths of all particles and light rays; light follows curved null geodesics.',
      },
    ],
  },
];
