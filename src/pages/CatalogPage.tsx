import React, { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { SIMULATIONS } from '../data/simulations';
import { DifficultyLevel, NavRoute, SimulationCategory } from '../types/physics';
import { SIM_ICONS } from './HomeDashboard';

interface CatalogPageProps {
  initialCategory?: SimulationCategory;
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

export const CatalogPage: React.FC<CatalogPageProps> = ({
  initialCategory = 'All',
  onNavigate,
}) => {
  const [category, setCategory] = useState<SimulationCategory>(initialCategory);
  const [difficulty, setDifficulty] = useState<'All' | DifficultyLevel>('All');
  const [query, setQuery] = useState('');

  React.useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SIMULATIONS.filter((s) => {
      const cOk = category === 'All' || s.category === category;
      const dOk = difficulty === 'All' || s.difficulty === difficulty;
      const qOk =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.engineLabel.toLowerCase().includes(q);
      return cOk && dOk && qOk;
    });
  }, [category, difficulty, query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400">Simulation Catalog</div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            {category === 'All' ? 'All Physics Laboratories' : category}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter labs..."
              className="pl-9 pr-3 py-2 rounded-md bg-[#0A101D] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as 'All' | DifficultyLevel)}
            className="px-3 py-2 rounded-md bg-[#0A101D] border border-slate-800 text-xs text-slate-200"
          >
            <option value="All">All Levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
              category === c
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-[#0A101D] text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((sim) => {
          const Icon = SIM_ICONS[sim.id];
          return (
            <article
              key={sim.id}
              className="rounded-lg border border-slate-800 bg-[#0A101D] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {sim.category} · {sim.difficulty}
                  </span>
                  <Icon className="w-4 h-4 text-cyan-400" />
                </div>
                <h2 className="text-base font-semibold text-slate-100">{sim.title}</h2>
                <p className="text-xs leading-relaxed text-slate-400">{sim.summary}</p>
                <div className="p-2.5 rounded-md bg-[#070B14] border border-slate-800 font-mono text-[11px] text-cyan-300 truncate">
                  {sim.equations[0]?.formula}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate({ view: 'sim', simId: sim.id })}
                className="w-full py-2 px-3 rounded-md bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-xs font-semibold text-slate-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Laboratory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
};
