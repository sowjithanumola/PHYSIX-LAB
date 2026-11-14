import React, { useMemo, useState } from 'react';
import { BookOpen, Play, CheckCircle2, XCircle } from 'lucide-react';
import { LEARN_MODULES } from '../data/learnContent';
import { DifficultyLevel, NavRoute } from '../types/physics';

interface LearnPhysicsPageProps {
  onNavigate: (route: NavRoute) => void;
}

export const LearnPhysicsPage: React.FC<LearnPhysicsPageProps> = ({ onNavigate }) => {
  const [difficulty, setDifficulty] = useState<'All' | DifficultyLevel>('All');
  const [selectedId, setSelectedId] = useState<string>(LEARN_MODULES[0].id);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const filteredModules = useMemo(() => {
    return LEARN_MODULES.filter((m) => difficulty === 'All' || m.difficulty === difficulty);
  }, [difficulty]);

  const activeModule = useMemo(() => {
    return filteredModules.find((m) => m.id === selectedId) || filteredModules[0] || LEARN_MODULES[0];
  }, [filteredModules, selectedId]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400">Interactive Curriculum</div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">Learn Physics</h1>
          <p className="text-xs text-slate-400 mt-1">
            Explore equations, physical variables, guided laboratory steps, and concept quizzes.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setDifficulty(lvl)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                difficulty === lvl
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-[#0A101D] text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Topic List */}
        <aside className="lg:col-span-4 space-y-2">
          {filteredModules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => setSelectedId(mod.id)}
              className={`w-full p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                activeModule.id === mod.id
                  ? 'border-cyan-500/50 bg-[#0D1628]'
                  : 'border-slate-800 bg-[#0A101D] hover:border-slate-700'
              }`}
            >
              <div className="text-[11px] text-slate-400">
                {mod.category} · {mod.difficulty}
              </div>
              <div className="text-sm font-semibold text-slate-100 mt-1">{mod.title}</div>
            </button>
          ))}
        </aside>

        {/* Active Lesson Content */}
        <main className="lg:col-span-8 rounded-lg border border-slate-800 bg-[#0A101D] p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="text-xs text-cyan-400 font-mono">
                {activeModule.category} · {activeModule.difficulty}
              </div>
              <h2 className="text-xl font-bold text-slate-100 mt-1">{activeModule.title}</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                onNavigate({
                  view: 'sim',
                  simId: activeModule.simId,
                  presetId: activeModule.presetId,
                })
              }
              className="px-3.5 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Launch Guided Lab</span>
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Physical Principle
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{activeModule.overview}</p>
          </div>

          <div className="p-4 rounded-md bg-[#070B14] border border-slate-800 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Governing Formula &amp; Variables
            </div>
            <div className="font-mono text-sm text-cyan-300 overflow-x-auto">
              {activeModule.formula}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
              {activeModule.variables.map((v) => (
                <div key={v.symbol} className="text-xs text-slate-300">
                  <span className="font-mono text-amber-300">{v.symbol}</span>: {v.description}{' '}
                  <span className="text-slate-500">({v.unit})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Guided Experiment Steps
              </h3>
              <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
                {activeModule.guidedSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Real-World Applications
              </h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                {activeModule.realWorldApplications.map((app, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{app}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Interactive Concept Quiz */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Concept Verification Quiz
            </h3>
            {activeModule.quiz.map((q) => {
              const picked = answers[q.id];
              const answered = picked !== undefined;
              const isCorrect = picked === q.correctIndex;
              return (
                <div
                  key={q.id}
                  className="p-4 rounded-md bg-[#070B14] border border-slate-800 space-y-3"
                >
                  <div className="text-sm font-medium text-slate-100">{q.prompt}</div>
                  <div className="grid grid-cols-1 gap-2">
                    {q.options.map((opt, idx) => {
                      const selected = picked === idx;
                      const correctOpt = idx === q.correctIndex;
                      let style = 'border-slate-800 bg-[#0A101D] text-slate-300 hover:border-slate-600';
                      if (answered) {
                        if (correctOpt) style = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200';
                        else if (selected) style = 'border-rose-500/60 bg-rose-500/15 text-rose-200';
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                          className={`px-3 py-2 rounded-md border text-left text-xs transition-colors cursor-pointer ${style}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {answered && (
                    <div
                      className={`text-xs flex items-start gap-2 pt-1 ${
                        isCorrect ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                      )}
                      <span>{q.explanation}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};
