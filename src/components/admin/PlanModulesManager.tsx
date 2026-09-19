import React, { useState } from "react";
import { X, Save, Plus, Boxes, AlertTriangle } from "lucide-react";
import {
  PlanModule,
  PlanModuleType,
  PlanModuleCategory,
  MODULE_CATEGORY_LABELS,
  usePlanModules,
  ensureDefaultModules,
  saveModule,
} from "../../lib/planModules";

const TYPE_LABELS: Record<PlanModuleType, string> = {
  boolean: "On / off",
  limit: "Limit",
  metered: "Metered",
};

const CATEGORIES: PlanModuleCategory[] = [
  "capture",
  "seats",
  "workspaces",
  "credits",
  "channels",
  "integrations",
  "features",
];

const blankModule = (): PlanModule => ({
  id: `module_${Date.now()}`,
  name: "",
  description: "",
  type: "boolean",
  category: "features",
  unit: "",
  defaultValue: false,
});

/**
 * Super Admin: manage the module registry. Every sellable option is a module;
 * plans are composed from modules. New features register their module here
 * as part of the build (see docs/plan-modules.md).
 */
export const PlanModulesManager: React.FC = () => {
  const { modules, loading } = usePlanModules();
  const [editing, setEditing] = useState<PlanModule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const handleSeed = async () => {
    setSaving(true);
    try {
      await ensureDefaultModules();
      setSeeded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (m: PlanModule) => {
    setEditing({ ...m });
    setIsNew(false);
    setError(null);
  };

  const openNew = () => {
    setEditing(blankModule());
    setIsNew(true);
    setError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("Module name is required.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(editing.id)) {
      setError("Module id must be lowercase letters, numbers, and underscores only.");
      return;
    }
    setSaving(true);
    try {
      await saveModule(editing);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 bg-slate-800/80 border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all";

  return (
    <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Boxes className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white">Plan Modules</h3>
            <p className="text-xs text-slate-500">
              Every sellable option is a module. Plans are composed from modules below.
              {seeded && " Registry seeded."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeed}
            disabled={saving}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Seed defaults
          </button>
          <button
            onClick={openNew}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New module
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 py-6 text-center">Loading modules...</p>
      ) : (
        <div className="space-y-5 mt-4">
          {CATEGORIES.map((cat) => {
            const list = modules.filter((m) => m.category === cat);
            if (list.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {MODULE_CATEGORY_LABELS[cat]}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {list.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => openEdit(m)}
                      className="text-left p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-purple-500/40 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white">{m.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 font-semibold">
                          {TYPE_LABELS[m.type]}
                        </span>
                        {m.placeholder && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> In build
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{m.description}</p>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">
                        {m.id} · default: {String(m.defaultValue)}
                        {m.unit ? ` ${m.unit}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white">
                {isNew ? "New module" : `Edit module: ${editing.id}`}
              </h4>
              <button
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Module id
                </label>
                <input
                  className={inputCls}
                  value={editing.id}
                  disabled={!isNew}
                  onChange={(e) => setEditing({ ...editing, id: e.target.value })}
                  placeholder="bookings_app"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Name
                </label>
                <input
                  className={inputCls}
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Bookings app"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Type
                  </label>
                  <select
                    className={inputCls}
                    value={editing.type}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        type: e.target.value as PlanModuleType,
                        defaultValue: e.target.value === "boolean" ? false : 0,
                      })
                    }
                  >
                    <option value="boolean">On / off</option>
                    <option value="limit">Limit</option>
                    <option value="metered">Metered</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    className={inputCls}
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value as PlanModuleCategory })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {MODULE_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Default value
                  </label>
                  {editing.type === "boolean" ? (
                    <select
                      className={inputCls}
                      value={String(editing.defaultValue)}
                      onChange={(e) => setEditing({ ...editing, defaultValue: e.target.value === "true" })}
                    >
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      className={inputCls}
                      value={Number(editing.defaultValue) || 0}
                      onChange={(e) => setEditing({ ...editing, defaultValue: Number(e.target.value) || 0 })}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Unit
                  </label>
                  <input
                    className={inputCls}
                    value={editing.unit}
                    onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                    placeholder="per workspace"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editing.placeholder}
                  onChange={(e) => setEditing({ ...editing, placeholder: e.target.checked })}
                  className="w-4 h-4 accent-purple-500"
                />
                Still in build (shows in admin only)
              </label>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save module"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
