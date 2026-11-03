import { useRef, useState } from 'react';
import { Check, Play, Send, Undo2 } from 'lucide-react';
import {
  availableTransitions,
  type Task,
  type TaskStatus,
} from '@/entities/task';
import type { Profile } from '@/entities/session';
import { rpc } from '@/shared/api/client';
import { useAction } from '@/shared/lib/use-action';
import { Button, Field, Textarea, ErrorNotice } from '@/shared/ui';

const actions = {
  in_progress: { label: 'Взять в работу', Icon: Play },
  review: { label: 'Отправить на проверку', Icon: Send },
  accepted: { label: 'Принять задачу', Icon: Check },
  rework: { label: 'Вернуть на доработку', Icon: Undo2 },
  new: { label: 'Новая', Icon: Play },
};
export function TaskActions({
  task,
  profile,
}: {
  task: Task;
  profile: Profile;
}) {
  const [comment, setComment] = useState('');
  const [validation, setValidation] = useState('');
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const transitions = availableTransitions(task, profile.role, profile.id);
  const mutation = useAction(
    async (status: TaskStatus) => {
      await rpc('transition_task', {
        p_id: task.id,
        p_to: status,
        p_version: task.version,
        p_comment: comment.trim() || undefined,
      });
    },
    () => {
      setComment('');
      setValidation('');
    },
  );
  if (!transitions.length)
    return (
      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
        {task.status === 'accepted'
          ? 'Задача принята. Работа завершена.'
          : profile.role === 'manager'
            ? 'Ожидаем отправки задачи на проверку.'
            : 'Задача ожидает решения постановщика.'}
      </p>
    );
  function transition(status: TaskStatus) {
    if (status === 'rework' && !comment.trim()) {
      setValidation('Укажите причину доработки');
      commentRef.current?.focus();
      return;
    }
    setValidation('');
    mutation.mutate(status);
  }
  return (
    <section className="space-y-4" aria-label="Действия с задачей">
      <Field
        label={
          transitions.includes('rework')
            ? 'Комментарий (обязателен для доработки)'
            : 'Комментарий (необязательно)'
        }
        htmlFor="transition-comment"
        error={validation}
      >
        <Textarea
          id="transition-comment"
          ref={commentRef}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
          aria-invalid={!!validation}
          aria-describedby={validation ? 'transition-comment-error' : undefined}
          placeholder="Добавьте детали для коллег"
        />
      </Field>
      {mutation.error && <ErrorNotice error={mutation.error} />}
      <div className="flex flex-wrap gap-3">
        {transitions.map((status) => {
          const { label, Icon } = actions[status];
          return (
            <Button
              key={status}
              variant={status === 'rework' ? 'outline' : 'default'}
              disabled={mutation.isPending}
              onClick={() => transition(status)}
            >
              <Icon size={16} />
              {label}
            </Button>
          );
        })}
      </div>
      {mutation.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Сохраняем статус…
        </p>
      )}
    </section>
  );
}
