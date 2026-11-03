import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Pencil, Plus } from 'lucide-react';
import { ObjectForm } from '@/features/manage-object';
import { TaskForm } from '@/features/manage-task';
import { TaskList } from '@/widgets/task-list';
import { useObject } from '@/entities/object';
import { useTasks } from '@/entities/task';
import { useProfile } from '@/entities/session';
import { rpc } from '@/shared/api/client';
import { useAction } from '@/shared/lib/use-action';
import {
  Button,
  Loading,
  ErrorNotice,
  Empty,
  ConfirmDelete,
} from '@/shared/ui';

export function ObjectDetailsPage() {
  const { id = '' } = useParams();
  const { data: profile } = useProfile();
  const object = useObject(id, profile!.id);
  const tasks = useTasks(profile!.id, id);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const remove = useAction(
    async () => {
      await rpc('delete_object', { p_id: id, p_version: object.data!.version });
    },
    () => navigate('/objects'),
  );
  if (object.isPending) return <Loading />;
  if (object.error)
    return (
      <ErrorNotice error={object.error} retry={() => void object.refetch()} />
    );
  if (!object.data)
    return (
      <Empty
        title="Объект недоступен"
        description="Объект удалён или у вас нет доступа."
      />
    );
  return (
    <>
      <Link to="/objects" className="back-link">
        <ArrowLeft size={16} />
        Все объекты
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Карточка объекта</p>
          <h1>{object.data.name}</h1>
          <p className="subtitle flex items-center gap-2">
            <MapPin size={16} className="shrink-0" />
            <span className="min-w-0">{object.data.address}</span>
          </p>
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
              title="Удалить объект?"
              description="Объект и все его задачи исчезнут из рабочих списков. История сохранится в базе. Отменить удаление в интерфейсе нельзя."
              onConfirm={() => remove.mutateAsync()}
            />
          </div>
        )}
      </div>
      {editing && (
        <ObjectForm
          key={object.data.id}
          object={object.data}
          onDone={() => setEditing(false)}
        />
      )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Задачи объекта{' '}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {tasks.data?.length ?? '—'}
          </span>
        </h2>
        {profile?.role === 'manager' && (
          <Button disabled={creating} onClick={() => setCreating(true)}>
            <Plus size={16} />
            Новая задача
          </Button>
        )}
      </div>
      {creating && <TaskForm objectId={id} onDone={() => setCreating(false)} />}
      {tasks.isPending ? (
        <Loading />
      ) : tasks.error ? (
        <ErrorNotice error={tasks.error} retry={() => void tasks.refetch()} />
      ) : (
        <TaskList tasks={tasks.data} />
      )}
    </>
  );
}
