import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { ObjectForm } from '@/features/manage-object';
import { useObjects } from '@/entities/object';
import { useTasks } from '@/entities/task';
import { useProfile } from '@/entities/session';
import { Button, Input, Loading, ErrorNotice, Empty } from '@/shared/ui';

export function ObjectsPage() {
  const { data: profile } = useProfile();
  const objects = useObjects(profile!.id);
  const tasks = useTasks(profile!.id);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = objects.data?.filter((object) =>
    `${object.name} ${object.address}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Объекты</h1>
          <p className="subtitle">
            {profile?.role === 'manager'
              ? 'Строительные объекты и задачи по ним'
              : 'Объекты, на которых вам назначены задачи'}
          </p>
        </div>
        {profile?.role === 'manager' && (
          <Button onClick={() => setCreating(true)} disabled={creating}>
            <Plus size={17} />
            Новый объект
          </Button>
        )}
      </div>
      {creating && <ObjectForm onDone={() => setCreating(false)} />}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:w-[360px]">
          <Search
            className="absolute left-3 top-3 text-muted-foreground"
            size={18}
          />
          <Input
            aria-label="Поиск объектов"
            placeholder="Название или адрес объекта"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="bg-white pl-10"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Объектов:{' '}
          <span className="font-medium text-foreground">
            {filtered?.length ?? '—'}
          </span>
        </p>
      </div>
      {tasks.error && (
        <ErrorNotice error={tasks.error} retry={() => void tasks.refetch()} />
      )}
      {objects.isPending ? (
        <Loading />
      ) : objects.error ? (
        <ErrorNotice
          error={objects.error}
          retry={() => void objects.refetch()}
        />
      ) : !filtered?.length ? (
        <Empty
          title={search ? 'Ничего не найдено' : 'Объектов пока нет'}
          description={
            search
              ? 'Попробуйте изменить запрос.'
              : 'Создайте объект или дождитесь назначения задачи.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_90px_110px_120px_20px] items-center gap-5 border-b bg-muted/60 px-6 py-3 text-xs text-muted-foreground lg:grid">
            <span>Объект</span>
            <span>Адрес</span>
            <span>Всего задач</span>
            <span>В работе</span>
            <span>На проверке</span>
            <span />
          </div>
          {filtered.map((object) => {
            const ownTasks = tasks.data?.filter(
              (task) => task.object_id === object.id,
            );
            const working = ownTasks?.filter(
              (task) => task.status === 'in_progress',
            ).length;
            const review = ownTasks?.filter(
              (task) => task.status === 'review',
            ).length;
            return (
              <Link
                key={object.id}
                to={`/objects/${object.id}`}
                className="grid items-center gap-3 border-b px-5 py-5 text-sm last:border-0 hover:bg-[#f8f7ff] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_90px_110px_120px_20px] lg:gap-5 lg:px-6"
              >
                <h2 className="break-words font-semibold text-foreground">
                  {object.name}
                </h2>
                <span className="text-sm leading-6 text-muted-foreground">
                  {object.address}
                </span>
                <span className="text-muted-foreground">
                  <span className="mr-2 lg:hidden">Задач:</span>
                  {ownTasks?.length ?? '—'}
                </span>
                <span className="hidden lg:block">{working ?? '—'}</span>
                <span className="hidden lg:block">
                  {review ? (
                    <span className="rounded bg-amber-50 px-2 py-1 text-amber-800">
                      {review}
                    </span>
                  ) : (
                    (review ?? '—')
                  )}
                </span>
                <ChevronRight
                  size={17}
                  className="hidden text-muted-foreground lg:block"
                />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
