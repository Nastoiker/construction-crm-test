import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { TaskList } from '@/widgets/task-list';
import { useTasks, statusLabels, statusSchema } from '@/entities/task';
import { useProfile } from '@/entities/session';
import { Loading, ErrorNotice, Select } from '@/shared/ui';

export function MyTasksPage() {
  const { data: profile } = useProfile();
  const tasks = useTasks(profile!.id);
  const [filter, setFilter] = useState('all');
  if (profile?.role !== 'executor') return <Navigate to="/objects" replace />;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Личная работа</p>
          <h1>Мои задачи</h1>
          <p className="subtitle">Ваши задачи на всех объектах.</p>
        </div>
        <Select
          aria-label="Фильтр по статусу"
          className="w-full sm:w-52"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">Все статусы</option>
          {statusSchema.options.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </Select>
      </div>
      {tasks.isPending ? (
        <Loading />
      ) : tasks.error ? (
        <ErrorNotice error={tasks.error} retry={() => void tasks.refetch()} />
      ) : (
        <TaskList
          tasks={tasks.data.filter(
            (task) => filter === 'all' || task.status === filter,
          )}
        />
      )}
    </>
  );
}
