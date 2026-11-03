import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ConstructionObject } from '@/entities/object';
import { rpc } from '@/shared/api/client';
import { useAction } from '@/shared/lib/use-action';
import { isVersionConflict } from '@/shared/lib/utils';
import { Button, Field, Input, ErrorNotice } from '@/shared/ui';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Введите название')
    .max(150, 'Не более 150 символов'),
  address: z
    .string()
    .trim()
    .min(1, 'Введите адрес')
    .max(300, 'Не более 300 символов'),
});
type Values = z.infer<typeof schema>;
export function ObjectForm({
  object,
  onDone,
}: {
  object?: ConstructionObject;
  onDone: () => void;
}) {
  const [editVersion] = useState(object?.version ?? 1);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: object ?? { name: '', address: '' },
  });
  const mutation = useAction(async (values: Values) => {
    const args = { p_name: values.name, p_address: values.address };
    await rpc(
      object ? 'update_object' : 'create_object',
      object ? { ...args, p_id: object.id, p_version: editVersion } : args,
    );
  }, onDone);
  return (
    <form
      className="panel mb-6 space-y-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <h2 className="font-semibold">
        {object ? 'Редактирование объекта' : 'Новый объект'}
      </h2>
      <Field
        label="Название объекта"
        htmlFor="object-name"
        error={errors.name?.message}
      >
        <Input
          id="object-name"
          maxLength={150}
          aria-invalid={!!errors.name}
          {...register('name')}
        />
      </Field>
      <Field
        label="Адрес"
        htmlFor="object-address"
        error={errors.address?.message}
      >
        <Input
          id="object-address"
          maxLength={300}
          aria-invalid={!!errors.address}
          {...register('address')}
        />
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
          {mutation.isPending ? 'Сохранение…' : 'Сохранить объект'}
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
