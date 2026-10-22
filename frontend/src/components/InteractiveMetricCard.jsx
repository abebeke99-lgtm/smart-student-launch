import { ArrowUpRight } from 'lucide-react';
import { useUiText } from '../hooks/useUiText';

const toneClasses = {
  cyan: 'bg-blue-50 text-blue-700 ring-blue-100 focus-visible:ring-blue-300',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100 focus-visible:ring-emerald-300',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100 focus-visible:ring-amber-300',
  rose: 'bg-purple-50 text-purple-700 ring-purple-100 focus-visible:ring-purple-300',
};

const InteractiveMetricCard = ({ label, value, icon: Icon, tone = 'cyan', hint = 'View details', onClick }) => {
  const t = useUiText();
  return (
  <button
    type="button"
    onClick={onClick}
    className="group relative flex min-h-36 w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left text-slate-900 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 active:translate-y-0"
  >
    <span className="absolute -right-6 -top-8 h-28 w-28 rounded-full border border-white/15 transition-transform duration-300 group-hover:scale-125" aria-hidden="true" />
    <span className="relative flex w-full items-start justify-between gap-3">
    <span className="text-sm font-semibold text-slate-600">{label}</span>
    {Icon ? <span className={`rounded-xl p-2 ring-1 ${toneClasses[tone] || toneClasses.cyan}`}><Icon className="h-5 w-5" aria-hidden="true" /></span> : null}
    </span>
    <span className="relative flex w-full items-end justify-between gap-3">
      <span className="text-3xl font-bold tabular-nums text-slate-900">{value}</span>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
        {t(hint)}<ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
      </span>
    </span>
  </button>
  );
};

export default InteractiveMetricCard;