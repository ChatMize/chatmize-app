/**
 * Panel listing the variables defined by question blocks in the current
 * flow. Picking one inserts its {{variable}} tag at the cursor.
 */
export interface FlowVariable {
  name: string;
  type: string;
  prompt: string;
}

export default function VariablePickerPanel({
  variables,
  onPick,
}: {
  variables: FlowVariable[];
  onPick: (tagText: string) => void;
}) {
  return (
    <span className="block w-[300px] max-w-[calc(100vw-3rem)] rounded-2xl border border-white/15 bg-slate-900 p-2 shadow-2xl">
      <span className="block px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Flow variables
      </span>
      {variables.length === 0 ? (
        <span className="block px-2.5 py-3 text-[11px] text-slate-500 leading-snug">
          No variables yet. Add an Ask block to a step to collect one.
        </span>
      ) : (
        <span className="block max-h-56 overflow-y-auto">
          {variables.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => onPick(`{{${v.name}}}`)}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-white/5 transition-colors cursor-pointer"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[11px] text-violet-300">
                  {`{{${v.name}}}`}
                </span>
                <span className="block truncate text-[10px] text-slate-500">
                  {v.prompt || v.type}
                </span>
              </span>
              <span className="shrink-0 text-[9px] font-bold uppercase text-slate-500 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                {v.type}
              </span>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
