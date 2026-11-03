import { Link } from 'react-router-dom';
import { ArrowUpRight, ClipboardList } from 'lucide-react';
import { StatusBadge, type Task } from '@/entities/task';
import { useProfiles } from '@/entities/session';
import { Empty } from '@/shared/ui';

export function TaskList({ tasks }: { tasks: Task[] }) {
  const profiles = useProfiles();
  if (!tasks.length)
    return (
      <Empty
        title="Задач пока нет"
        description="Здесь появятся задачи, доступные вам."
      />
    );
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="hidden grid-cols-[1fr_180px_150px_24px] gap-4 border-b bg-muted/40 px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid">
        <span>Задача</span>
        <span>Исполнитель</span>
        <span>Статус</span>
        <span />
      </div>
      {tasks.map((task) => (
        <Link
          key={task.id}
          to={`/tasks/${task.id}`}
          className="grid items-center gap-3 border-b border-border px-5 py-5 last:border-0 hover:bg-muted/50 focus-visible:outline-primary md:grid-cols-[1fr_180px_150px_24px] md:gap-4 md:px-6"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="rounded-lg bg-muted p-2 text-primary">
              <ClipboardList size={18} />
            </span>
            <span className="truncate font-medium">{task.title}</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {profiles.data?.find((p) => p.id === task.assignee_id)
              ?.display_name ?? 'Исполнитель'}
          </span>
          <span>
            <StatusBadge status={task.status} />
          </span>
          <ArrowUpRight
            className="hidden text-muted-foreground md:block"
            size={18}
          />
        </Link>
      ))}
    </div>
  );
}
