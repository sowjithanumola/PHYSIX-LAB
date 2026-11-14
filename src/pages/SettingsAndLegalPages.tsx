import React, { useState } from 'react';
import { Trash2, Check } from 'lucide-react';
import { AppSettings, NavRoute } from '../types/physics';
import { ToggleControl } from '../components/ui/LabControls';
import { clearAllSavedExperiments, saveSettings } from '../utils/experimentStorage';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onNavigate: (route: NavRoute) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  onNavigate,
}) => {
  const [cleared, setCleared] = useState(false);

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    saveSettings(next);
    onUpdateSettings(next);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <div className="text-xs font-mono text-cyan-400">Laboratory Preferences</div>
        <h1 className="text-2xl font-bold text-slate-100 mt-1">Settings</h1>
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#0A101D] p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">Measurement Notation</label>
          <div className="grid grid-cols-2 gap-2">
            {(['SI', 'Scaled'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => update({ unitSystem: mode })}
                className={`py-2 px-3 rounded-md text-xs font-medium cursor-pointer ${
                  settings.unitSystem === mode
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-[#070B14] text-slate-400 border border-slate-800'
                }`}
              >
                {mode === 'SI' ? 'SI Units (m, kg, s, K)' : 'Dimensionless Scaled Units'}
              </button>
            ))}
          </div>
        </div>

        <ToggleControl
          label="Show Scientific Model Notes"
          checked={settings.showModelNotes}
          onChange={(v) => update({ showModelNotes: v })}
          description="Display numerical solver notes and approximation disclosures in workspaces"
        />
        <ToggleControl
          label="High-DPI Canvas Rendering"
          checked={settings.highDpiCanvas}
          onChange={(v) => update({ highDpiCanvas: v })}
          description="Render 2D and 3D canvases at native Retina/HiDPI pixel density"
        />
        <ToggleControl
          label="Reduced UI Motion"
          checked={settings.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
          description="Minimize interface transition animations"
        />
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#0A101D] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">Local Storage Management</h2>
        <p className="text-xs text-slate-400">
          All saved experiments and recently opened simulations are stored locally in your browser
          using localStorage. Nothing is transmitted to external servers.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              clearAllSavedExperiments();
              setCleared(true);
            }}
            className="px-3.5 py-2 rounded-md border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Saved Experiments &amp; History</span>
          </button>
          {cleared && (
            <span className="text-xs text-emerald-300 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Local experiment data cleared
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#0A101D] p-5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">Legal &amp; Documentation</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate({ view: 'privacy' })}
            className="text-cyan-400 hover:underline cursor-pointer"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ view: 'terms' })}
            className="text-cyan-400 hover:underline cursor-pointer"
          >
            Terms and Conditions
          </button>
        </div>
      </div>
    </div>
  );
};

export const PrivacyPolicyPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
    <div className="text-xs font-mono text-cyan-400">Legal Documentation</div>
    <h1 className="text-2xl font-bold text-slate-100">Privacy Policy</h1>
    <div className="rounded-lg border border-slate-800 bg-[#0A101D] p-6 space-y-4 text-sm text-slate-300 leading-relaxed">
      <p>
        PHYSIX LAB executes physics calculations, rendering, and educational exercises locally
        within your web browser. The platform does not require user accounts, authentication, or
        paid external APIs.
      </p>
      <h2 className="text-base font-semibold text-slate-100">1. Local Browser Storage</h2>
      <p>
        Saved experiments, lab notes, simulation preferences, and recently opened simulator lists
        are stored strictly in your browser localStorage. You can export configurations as JSON
        files or clear all local records at any time from the Settings page.
      </p>
      <h2 className="text-base font-semibold text-slate-100">2. Shareable URLs</h2>
      <p>
        When you generate a shareable experiment link, your chosen parameters are encoded directly
        into the URL query string. No experiment data is uploaded to or stored on a remote server.
      </p>
      <h2 className="text-base font-semibold text-slate-100">3. Third-Party Assets</h2>
      <p>
        Font stylesheets are loaded cleanly for typography rendering. No behavioral tracking
        cookies or advertising telemetry scripts are used by PHYSIX LAB.
      </p>
    </div>
    <button
      type="button"
      onClick={onBack}
      className="px-4 py-2 rounded-md border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
    >
      Back to Home
    </button>
  </div>
);

export const TermsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
    <div className="text-xs font-mono text-cyan-400">Legal Documentation</div>
    <h1 className="text-2xl font-bold text-slate-100">Terms and Conditions</h1>
    <div className="rounded-lg border border-slate-800 bg-[#0A101D] p-6 space-y-4 text-sm text-slate-300 leading-relaxed">
      <p>
        PHYSIX LAB is provided as an interactive educational and conceptual scientific visualization
        platform running locally in your browser.
      </p>
      <h2 className="text-base font-semibold text-slate-100">1. Scientific Model Scope</h2>
      <p>
        Simulations use real mathematical integrators and rigid-body physics engines, including
        Velocity-Verlet, RK4 Lagrangian integration, Matter.js, and Cannon-es. Simplified models
        such as 2D fluid advection, potential-flow wind tunnel approximations, cellular automata,
        and conceptual spacetime embedding diagrams are explicitly labeled and are not substitutes
        for certified aerospace, structural, or full general-relativistic engineering solvers.
      </p>
      <h2 className="text-base font-semibold text-slate-100">2. Permitted Use</h2>
      <p>
        You may create, export, share, and use simulation configurations and screenshots for
        learning, classroom demonstrations, and personal experimentation.
      </p>
      <h2 className="text-base font-semibold text-slate-100">3. No Warranty</h2>
      <p>
        The software is provided as-is without warranties of any kind. Users are responsible for
        verifying quantitative calculations before applying them to physical hardware or safety-critical
        designs.
      </p>
    </div>
    <button
      type="button"
      onClick={() => onBack()}
      className="px-4 py-2 rounded-md border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
    >
      Back to Home
    </button>
  </div>
);
