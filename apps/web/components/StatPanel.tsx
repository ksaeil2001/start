import { ReactNode } from 'react';

export function StatPanel({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
