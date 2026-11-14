import React, { useMemo, useState } from 'react';
import {
  Search,
  ArrowRight,
  Clock,
  FlaskConical,
  BookOpen,
  Wrench,
  Orbit,
  Waves,
  Zap,
  Sparkles,
  Eye,
  Compass,
  Wind,
  Atom,
  Blocks,
  Activity,
} from 'lucide-react';
import { SIMULATIONS, SIMULATION_MAP } from '../data/simulations';
import { NavRoute, SimulationCategory, SimulationId } from '../types/physics';
import { Featured3DPreview } from '../components/three/Featured3DPreview';
import { getRecentSimulations, loadSavedExperiments } from '../utils/experimentStorage';

interface HomeDashboardProps {
  onNavigate: (route: NavRoute) => void;
}

const CATEGORIES: SimulationCategory[] = [
  'All',
  'Space & Gravity',
  'Fluid Dynamics',
  'Electromagnetism',
  'Mechanics',
  'Optics',
  'Molecular Physics',
];

export const SIM_ICONS: Record<SimulationId, React.ComponentType<{ className?: string }>> = {
  gravity: Orbit,
  fluid: Waves,
  elements: Sparkles,
  electromagnetism: Zap,
  chaos: Activity,
  optics: Eye,
  collision: Blocks,
  spacetime: Compass,
  windtunnel: Wind,
  molecular: Atom,
  playground: Wrench,
};

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SimulationCategory>('All');

  const recentSims = useMemo(() => getRecentSimulations(), []);
  const savedCount = useMemo(() => loadSavedExperiments().length, []);

  const filteredSimulations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SIMULATIONS.filter((sim) => {
      const catMatch = activeCategory === 'All' || sim.category === activeCategory;
      const textMatch =
        !q ||
        sim.title.toLowerCase().includes(q) ||
        sim.summary.toLowerCase().includes(q) ||
        sim.category.toLowerCase().includes(q) ||
        sim.engineLabel.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [activeCategory, searchQuery]);

  const featuredSimulations = useMemo(() => SIMULATIONS.filter((s) => s.featured), []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-10">
      {/* Hero Section: Two-column balanced split with Featured 3D Physics Preview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between rounded-lg border border-slate-800 bg-[#0A101D] p-6 sm:p-7">
          <div className="space-y-4">
            <div className="text-xs font-mono text-cyan-400 tracking-wide">
              Browser Physics Laboratory · Local Client Execution
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 leading-tight text-balance">
              Build, test, and inspect real-time physical systems.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              Run interactive simulations across orbital mechanics, fluid channels, electromagnetism,
              geometric optics, chaotic pendulums, molecular dynamics, and rigid-body sandboxes with
              live telemetry graphs.
            </p>
          </div>

          <div className="pt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate({ view: 'sim', simId: 'gravity' })}
                className="px-4 py-2.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FlaskConical className="w-4 h-4" />
                <span>Launch Gravity Simulator</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate({ view: 'builder' })}
                className="px-4 py-2.5 rounded-md border border-slate-700 hover:border-slate-500 bg-[#070B14] text-slate-200 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Wrench className="w-4 h-4 text-cyan-400" />
                <span>Open Experiment Builder</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate({ view: 'learn' })}
                className="px-3.5 py-2.5 rounded-md border border-slate-800 hover:border-slate-600 text-slate-300 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span>Learn Physics</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400">
              <span>11 Interactive Simulators</span>
              <span aria-hidden="true">·</span>
              <span>Three.js, Matter.js &amp; Cannon-es</span>
              <span aria-hidden="true">·</span>
              <span>{savedCount} Saved Experiments</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6">
          <Featured3DPreview />
        </div>
      </section>

      {/* Recently Opened Experiments */}
      {recentSims.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Recently Opened Laboratories</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentSims.slice(0, 3).map((rec) => {
              const meta = SIMULATION_MAP[rec.simId];
              if (!meta) return null;
              const Icon = SIM_ICONS[meta.id];
              return (
                <button
                  key={rec.simId}
                  type="button"
                  onClick={() => onNavigate({ view: 'sim', simId: meta.id })}
                  className="p-3.5 rounded-lg border border-slate-800 bg-[#0A101D] hover:border-cyan-500/40 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-[#070B14] border border-slate-800 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-100 truncate">{meta.title}</div>
                      <div className="text-xs text-slate-400 truncate">
                        {meta.category} · {meta.engineLabel}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Search & Category Explorer */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Simulation Directory</h2>
            <p className="text-xs text-slate-400">
              Filter by scientific discipline or search by solver, law, or phenomenon.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search simulations..."
              className="w-full pl-9 pr-3 py-2 rounded-md bg-[#0A101D] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-[#0A101D] text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Simulation Cards Grid */}
        {filteredSimulations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSimulations.map((sim) => {
              const Icon = SIM_ICONS[sim.id];
              return (
                <article
                  key={sim.id}
                  className="rounded-lg border border-slate-800 bg-[#0A101D] hover:border-slate-700 p-5 flex flex-col justify-between gap-4 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-slate-400">
                        <span>{sim.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{sim.difficulty}</span>
                      </div>
                      <div className="w-8 h-8 rounded-md bg-[#070B14] border border-slate-800 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-cyan-400" />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-slate-100">{sim.title}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{sim.summary}</p>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 pt-1">
                      Engine: <span className="text-slate-300">{sim.engineLabel}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 truncate">
                      {sim.metricsDescription.slice(0, 2).join(' · ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate({ view: 'sim', simId: sim.id })}
                      className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-xs font-medium text-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>Launch</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-[#0A101D] p-8 text-center space-y-2">
            <div className="text-sm font-medium text-slate-200">No simulations match your filter</div>
            <p className="text-xs text-slate-400">
              Try clearing the search term or switching back to All categories.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
              }}
              className="mt-2 px-3 py-1.5 rounded-md border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>

      {/* Featured Quick Launch Strip */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Featured Experiment Environments</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {featuredSimulations.map((sim) => {
            const Icon = SIM_ICONS[sim.id];
            return (
              <button
                key={sim.id}
                type="button"
                onClick={() => onNavigate({ view: 'sim', simId: sim.id })}
                className="p-3 rounded-md border border-slate-800 bg-[#0A101D] hover:border-cyan-500/40 text-left space-y-2 transition-colors cursor-pointer"
              >
                <Icon className="w-4 h-4 text-cyan-400" />
                <div className="text-xs font-medium text-slate-100 truncate">{sim.shortTitle}</div>
                <div className="text-[11px] text-slate-500 truncate">{sim.category}</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
