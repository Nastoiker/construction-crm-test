import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock3, Pencil } from 'lucide-react';
import { TaskForm } from '@/features/manage-task';
import { TaskActions } from '@/features/transition-task';
import {
  useTask,
  useTaskHistory,
  StatusBadge,
  statusLabels,
} from '@/entities/task';
import { useProfile, useProfiles } from '@/entities/session';
import { useObject } from '@/entities/object';
import { rpc } from '@/shared/api/client';
import { formatDate } from '@/shared/lib/utils';
import { useAction } from '@/shared/lib/use-action';
import {
  Button,
  Loading,
  ErrorNotice,
  Empty,
  ConfirmDelete,
} from '@/shared/ui';

export function TaskDetailsPage() {
  const { id = '' } = useParams();
  const { data: profile } = useProfile();
  const task = useTask(id, profile!.id);
  const object = useObject(task.data?.object_id ?? '', profile!.id);
  const history = useTaskHistory(id, profile!.id);
  const profiles = useProfiles();
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const remove = useAction(
    async () => {
      await rpc('delete_task', { p_id: id, p_version: task.data!.version });
    },
    () => navigate(`/objects/${task.data!.object_id}`),
  );
  const name = (userId: string) =>
    profiles.data?.find((p) => p.id === userId)?.display_name ??
    'Участник команды';
  if (task.isPending) return <Loading />;
  if (task.error)
    return <ErrorNotice error={task.error} retry={() => void task.refetch()} />;
  if (!task.data)
    return (
      <Empty
        title="Задача недоступна"
        description="Задача удалена, переназначена или у вас нет доступа."
      />
    );
  const current = task.data;
  return (
    <>
      <Link to={`/objects/${current.object_id}`} className="back-link">
        <ArrowLeft size={16} />К объекту
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Карточка задачи</p>
          <h1>{current.title}</h1>
          <div className="mt-4">
            <StatusBadge status={current.status} />
          </div>
        </div>
        {profile?.role === 'manager' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={editing}
              onClick={() => setEditing(true)}
            >
              <Pencil size={16} />
              Редактировать
            </Button>
            <ConfirmDelete
              title="Удалить задачу?"
              description="Задача исчезнет из рабочих списков. История изменений сохранится в базе."
              onConfirm={() => remove.mutateAsync()}
            />
          </div>
        )}
      </div>
      {editing && (
        <TaskForm
          key={current.id}
          task={current}
          objectId={current.object_id}
          onDone={() => setEditing(false)}
        />
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
        <section className="panel space-y-6">
          <div>
            <h2 className="section-title">Описание задачи</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
              {current.description || 'Описание не добавлено.'}
            </p>
          </div>
          <dl className="grid gap-5 border-y py-5 sm:grid-cols-2">
            <div>
              <dt className="meta-label">Объект</dt>
              <dd className="mt-1 text-sm">
                <Link
                  className="text-primary hover:underline"
                  to={`/objects/${current.object_id}`}
                >
                  {object.data?.name ?? 'Открыть объект'}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="meta-label">Исполнитель</dt>
              <dd className="mt-1 text-sm font-medium">
                {name(current.assignee_id)}
              </dd>
            </div>
            <div>
              <dt className="meta-label">Постановщик</dt>
              <dd className="mt-1 text-sm font-medium">
                {name(current.author_id)}
              </dd>
            </div>
            <div>
              <dt className="meta-label">Создана</dt>
              <dd className="mt-1 text-sm">{formatDate(current.created_at)}</dd>
            </div>
          </dl>
          {profiles.error && (
            <ErrorNotice
              error={profiles.error}
              retry={() => void profiles.refetch()}
            />
          )}
          <TaskActions task={current} profile={profile!} />
        </section>
        <section className="panel">
          <h2 className="section-title flex items-center gap-2">
            <Clock3 size={18} />
            История задачи
          </h2>
          <p className="mb-6 mt-2 text-xs text-muted-foreground">
            Все изменения статуса в хронологическом порядке
          </p>
          {history.isPending ? (
            <Loading />
          ) : history.error ? (
            <ErrorNotice
              error={history.error}
              retry={() => void history.refetch()}
            />
          ) : (
            <ol className="space-y-6">
              {history.data.map((entry) => (
                <li
                  key={entry.id}
                  className="relative border-l-2 border-border pl-5"
                >
                  <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-sm font-medium">
                    {entry.from_status
                      ? `${statusLabels[entry.from_status]} → `
                      : 'Создана → '}
                    {statusLabels[entry.to_status]}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {name(entry.actor_id)} ·{' '}
                    <time dateTime={entry.created_at}>
                      {formatDate(entry.created_at)}
                    </time>
                  </p>
                  {entry.comment && (
                    <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-sm leading-6">
                      {entry.comment}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
