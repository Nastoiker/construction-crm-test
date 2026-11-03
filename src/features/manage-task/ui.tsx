import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Task } from '@/entities/task';
import { useProfiles } from '@/entities/session';
import { rpc } from '@/shared/api/client';
import { useAction } from '@/shared/lib/use-action';
import { isVersionConflict } from '@/shared/lib/utils';
import {
  Button,
  Field,
  Input,
  Textarea,
  Select,
  ErrorNotice,
  Loading,
} from '@/shared/ui';

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Введите название')
    .max(150, 'Не более 150 символов'),
  description: z.string().max(5000, 'Не более 5000 символов'),
  assignee_id: z.uuid('Выберите исполнителя'),
});
type Values = z.infer<typeof schema>;
export function TaskForm({
  task,
  objectId,
  onDone,
}: {
  task?: Task;
  objectId: string;
  onDone: () => void;
}) {
  const [editVersion] = useState(task?.version ?? 1);
  const profiles = useProfiles();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: task ?? { title: '', description: '', assignee_id: '' },
  });
  const mutation = useAction(async (values: Values) => {
    const args = {
      p_title: values.title,
      p_description: values.description,
      p_assignee_id: values.assignee_id,
    };
    await rpc(
      task ? 'update_task' : 'create_task',
      task
        ? { ...args, p_id: task.id, p_version: editVersion }
        : { ...args, p_object_id: objectId },
    );
  }, onDone);
  if (profiles.isPending) return <Loading />;
  if (profiles.error)
    return (
      <ErrorNotice
        error={profiles.error}
        retry={() => void profiles.refetch()}
      />
    );
  return (
    <form
      className="panel mb-6 space-y-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <h2 className="font-semibold">
        {task ? 'Редактирование задачи' : 'Новая задача'}
      </h2>
      <Field
        label="Название задачи"
        htmlFor="task-title"
        error={errors.title?.message}
      >
        <Input
          id="task-title"
          maxLength={150}
          aria-invalid={!!errors.title}
          {...register('title')}
        />
      </Field>
      <Field
        label="Описание"
        htmlFor="task-description"
        error={errors.description?.message}
      >
        <Textarea
          id="task-description"
          maxLength={5000}
          {...register('description')}
        />
      </Field>
      <Field
        label="Исполнитель"
        htmlFor="task-assignee"
        error={errors.assignee_id?.message}
      >
        <Select
          id="task-assignee"
          aria-invalid={!!errors.assignee_id}
          {...register('assignee_id')}
        >
          <option value="">Выберите исполнителя</option>
          {profiles.data
            .filter((p) => p.role === 'executor')
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
        </Select>
      </Field>
      {mutation.error && <ErrorNotice error={mutation.error} />}
      {isVersionConflict(mutation.error) && (
        <p className="text-sm text-muted-foreground">
          Ваши правки сохранены в форме. Скопируйте их при необходимости, затем
          закройте форму и откройте снова для загрузки актуальных данных.
        </p>
      )}
      <div className="flex gap-3">
        <Button disabled={mutation.isPending}>
          {mutation.isPending ? 'Сохранение…' : 'Сохранить задачу'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={onDone}
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}
