import { cn } from '@/shared/lib/utils';
import { statusLabels, type TaskStatus } from './model';
const colors: Record<TaskStatus, string> = {
  new: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-50 text-blue-700',
  review: 'bg-amber-50 text-amber-800',
  accepted: 'bg-emerald-50 text-emerald-800',
  rework: 'bg-rose-50 text-rose-700',
};
export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        colors[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}
