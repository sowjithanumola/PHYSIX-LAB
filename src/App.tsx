import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import {
  Home,
  LayoutGrid,
  Orbit,
  Waves,
  Zap,
  Cog,
  Eye,
  Atom,
  Wrench,
  Bookmark,
  BookOpen,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import { BrandLogo } from './components/BrandLogo';
import { AppSettings, NavRoute, SavedExperiment, SimulationCategory, SimulationId } from './types/physics';
import {
  decodeSharedExperimentFromUrl,
  loadSavedExperiments,
  loadSettings,
  recordRecentSimulation,
} from './utils/experimentStorage';
import { HomeDashboard } from './pages/HomeDashboard';
import { CatalogPage } from './pages/CatalogPage';
import { ExperimentBuilderPage } from './pages/ExperimentBuilderPage';
import { SavedExperimentsPage } from './pages/SavedExperimentsPage';
import { LearnPhysicsPage } from './pages/LearnPhysicsPage';
import { PrivacyPolicyPage, SettingsPage, TermsPage } from './pages/SettingsAndLegalPages';

import { GravitySimulator } from './simulations/GravitySimulator';
import { FluidSimulator } from './simulations/FluidSimulator';
import { ElementSimulator } from './simulations/ElementSimulator';
import { ElectromagnetismSimulator } from './simulations/ElectromagnetismSimulator';
import { ChaosSimulator } from './simulations/ChaosSimulator';
import { OpticsSimulator } from './simulations/OpticsSimulator';
import { CollisionSimulator } from './simulations/CollisionSimulator';
import { SpacetimeSimulator } from './simulations/SpacetimeSimulator';
import { WindTunnelSimulator } from './simulations/WindTunnelSimulator';
import { MolecularSimulator } from './simulations/MolecularSimulator';
import { PlaygroundSimulator } from './simulations/PlaygroundSimulator';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class SimulationErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Simulation error occurred.' };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Handled gracefully in boundary UI
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-lg mx-auto my-12 rounded-lg border border-rose-500/30 bg-[#0A101D] text-center space-y-3">
          <h2 className="text-base font-semibold text-rose-300">Simulation Viewport Recovery</h2>
          <p className="text-xs text-slate-400">{this.state.message}</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, message: '' });
              this.props.onReset();
            }}
            className="px-4 py-2 rounded-md bg-cyan-500 text-slate-950 text-xs font-semibold cursor-pointer"
          >
            Return to Home Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: NavRoute;
  match: (r: NavRoute) => boolean;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    route: { view: 'home' },
    match: (r) => r.view === 'home',
  },
  {
    id: 'all',
    label: 'All Simulations',
    icon: LayoutGrid,
    route: { view: 'catalog', category: 'All' },
    match: (r) => r.view === 'catalog' && r.category === 'All',
  },
  {
    id: 'space',
    label: 'Space and Gravity',
    icon: Orbit,
    route: { view: 'catalog', category: 'Space & Gravity' },
    match: (r) => r.view === 'catalog' && r.category === 'Space & Gravity',
  },
  {
    id: 'fluid',
    label: 'Fluid Dynamics',
    icon: Waves,
    route: { view: 'catalog', category: 'Fluid Dynamics' },
    match: (r) => r.view === 'catalog' && r.category === 'Fluid Dynamics',
  },
  {
    id: 'em',
    label: 'Electromagnetism',
    icon: Zap,
    route: { view: 'catalog', category: 'Electromagnetism' },
    match: (r) => r.view === 'catalog' && r.category === 'Electromagnetism',
  },
  {
    id: 'mech',
    label: 'Mechanics',
    icon: Cog,
    route: { view: 'catalog', category: 'Mechanics' },
    match: (r) => r.view === 'catalog' && r.category === 'Mechanics',
  },
  {
    id: 'optics',
    label: 'Optics',
    icon: Eye,
    route: { view: 'catalog', category: 'Optics' },
    match: (r) => r.view === 'catalog' && r.category === 'Optics',
  },
  {
    id: 'mol',
    label: 'Molecular Physics',
    icon: Atom,
    route: { view: 'catalog', category: 'Molecular Physics' },
    match: (r) => r.view === 'catalog' && r.category === 'Molecular Physics',
  },
  {
    id: 'builder',
    label: 'Experiment Builder',
    icon: Wrench,
    route: { view: 'builder' },
    match: (r) => r.view === 'builder',
  },
  {
    id: 'saved',
    label: 'Saved Experiments',
    icon: Bookmark,
    route: { view: 'saved' },
    match: (r) => r.view === 'saved',
  },
  {
    id: 'learn',
    label: 'Learn Physics',
    icon: BookOpen,
    route: { view: 'learn' },
    match: (r) => r.view === 'learn',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    route: { view: 'settings' },
    match: (r) => r.view === 'settings',
  },
];

export default function App() {
  const [route, setRoute] = useState<NavRoute>({ view: 'home' });
  const [customParams, setCustomParams] = useState<Record<string, unknown> | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  // Decode shared URL on startup if present
  useEffect(() => {
    const shared = decodeSharedExperimentFromUrl();
    if (shared && shared.simId) {
      setCustomParams(shared.params);
      setRoute({ view: 'sim', simId: shared.simId });
      recordRecentSimulation(shared.simId);
    }
  }, []);

  const navigateTo = (next: NavRoute, paramsOverride?: Record<string, unknown>) => {
    setCustomParams(paramsOverride);
    setRoute(next);
    setMobileMenuOpen(false);
    if (next.view === 'sim') {
      recordRecentSimulation(next.simId);
      if (next.experimentId && !paramsOverride) {
        const found = loadSavedExperiments().find((e) => e.id === next.experimentId);
        if (found) setCustomParams(found.params);
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleOpenSaved = (exp: SavedExperiment) => {
    navigateTo({ view: 'sim', simId: exp.simId, experimentId: exp.id }, exp.params);
  };

  const handleLaunchCustom = (simId: SimulationId, params: Record<string, unknown>) => {
    navigateTo({ view: 'sim', simId }, params);
  };

  const renderSimulator = (simId: SimulationId, presetId?: string) => {
    const onOpenLearn = () => navigateTo({ view: 'learn' });
    switch (simId) {
      case 'gravity':
        return <GravitySimulator initialParams={customParams} presetId={presetId} onOpenLearn={onOpenLearn} />;
      case 'fluid':
        return <FluidSimulator initialParams={customParams} onOpenLearn={onOpenLearn} />;
      case 'elements':
        return <ElementSimulator initialParams={customParams} onOpenLearn={onOpenLearn} />;
      case 'electromagnetism':
        return (
          <ElectromagnetismSimulator initialParams={customParams} presetId={presetId} onOpenLearn={onOpenLearn} />
        );
      case 'chaos':
        return <ChaosSimulator initialParams={customParams} presetId={presetId} onOpenLearn={onOpenLearn} />;
      case 'optics':
        return <OpticsSimulator initialParams={customParams} presetId={presetId} onOpenLearn={onOpenLearn} />;
      case 'collision':
        return <CollisionSimulator initialParams={customParams} presetId={presetId} onOpenLearn={onOpenLearn} />;
      case 'spacetime':
        return <SpacetimeSimulator initialParams={customParams} presetId={presetId} onOpenLearn={onOpenLearn} />;
      case 'windtunnel':
        return <WindTunnelSimulator initialParams={customParams} presetId={presetId} onOpenLearn={onOpenLearn} />;
      case 'molecular':
        return <MolecularSimulator initialParams={customParams} presetId={presetId} onOpenLearn={onOpenLearn} />;
      case 'playground':
        return <PlaygroundSimulator initialParams={customParams} onOpenLearn={onOpenLearn} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070B14] text-slate-100">
      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 h-14 border-b border-slate-800 bg-[#0A101D] px-3 sm:px-5 flex items-center justify-between gap-4">
        {/* Zone 1: Brand & Sidebar Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 rounded-md text-slate-300 hover:bg-slate-800 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="hidden lg:inline-flex p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
          <BrandLogo onClick={() => navigateTo({ view: 'home' })} />
        </div>

        {/* Zone 2: Concise single-line text links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <button
            type="button"
            onClick={() => navigateTo({ view: 'home' })}
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => navigateTo({ view: 'catalog', category: 'All' })}
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Simulations
          </button>
          <button
            type="button"
            onClick={() => navigateTo({ view: 'saved' })}
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Saved
          </button>
          <button
            type="button"
            onClick={() => navigateTo({ view: 'learn' })}
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Learn Physics
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => navigateTo({ view: 'builder' })}
            className="px-3.5 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            New Experiment
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`hidden lg:flex flex-col shrink-0 border-r border-slate-800 bg-[#090F1C] transition-all duration-150 ${
            sidebarCollapsed ? 'w-14' : 'w-60'
          }`}
        >
          <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto" aria-label="Primary sidebar">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.match(route);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.route)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {!sidebarCollapsed && (
            <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigateTo({ view: 'privacy' })}
                className="hover:text-slate-300 cursor-pointer"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => navigateTo({ view: 'terms' })}
                className="hover:text-slate-300 cursor-pointer"
              >
                Terms
              </button>
            </div>
          )}
        </aside>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative z-50 w-64 max-w-[80vw] bg-[#090F1C] border-r border-slate-800 p-3 flex flex-col justify-between overflow-y-auto">
              <nav className="space-y-1">
                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = item.match(route);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateTo(item.route)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-medium cursor-pointer ${
                        active
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="pt-4 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => navigateTo({ view: 'privacy' })}
                  className="hover:text-slate-200 cursor-pointer"
                >
                  Privacy Policy
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ view: 'terms' })}
                  className="hover:text-slate-200 cursor-pointer"
                >
                  Terms
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main View Area */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1">
            {route.view === 'home' && <HomeDashboard onNavigate={navigateTo} />}
            {route.view === 'catalog' && (
              <CatalogPage initialCategory={route.category} onNavigate={navigateTo} />
            )}
            {route.view === 'sim' && (
              <SimulationErrorBoundary onReset={() => navigateTo({ view: 'home' })}>
                {renderSimulator(route.simId, route.presetId)}
              </SimulationErrorBoundary>
            )}
            {route.view === 'builder' && (
              <ExperimentBuilderPage
                onNavigate={navigateTo}
                onLaunchCustom={handleLaunchCustom}
              />
            )}
            {route.view === 'saved' && (
              <SavedExperimentsPage onNavigate={navigateTo} onOpenSaved={handleOpenSaved} />
            )}
            {route.view === 'learn' && <LearnPhysicsPage onNavigate={navigateTo} />}
            {route.view === 'settings' && (
              <SettingsPage
                settings={settings}
                onUpdateSettings={setSettings}
                onNavigate={navigateTo}
              />
            )}
            {route.view === 'privacy' && (
              <PrivacyPolicyPage onBack={() => navigateTo({ view: 'home' })} />
            )}
            {route.view === 'terms' && (
              <TermsPage onBack={() => navigateTo({ view: 'home' })} />
            )}
          </div>

          {/* Quiet Footer on non-simulator pages */}
          {route.view !== 'sim' && (
            <footer className="border-t border-slate-800/80 bg-[#070B14] px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
              <span>PHYSIX LAB · Browser Physics Simulation Platform</span>
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => navigateTo({ view: 'learn' })}
                  className="hover:text-slate-300 cursor-pointer"
                >
                  Learn Physics
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ view: 'privacy' })}
                  className="hover:text-slate-300 cursor-pointer"
                >
                  Privacy Policy
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ view: 'terms' })}
                  className="hover:text-slate-300 cursor-pointer"
                >
                  Terms and Conditions
                </button>
              </div>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}
