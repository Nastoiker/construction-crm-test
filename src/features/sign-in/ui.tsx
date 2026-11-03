import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/shared/api/client';
import { Button, Field, Input, ErrorNotice } from '@/shared/ui';

const schema = z.object({
  email: z.email('Введите корректный email').trim(),
  password: z.string().min(1, 'Введите пароль'),
});
type Values = z.infer<typeof schema>;
export function SignInForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) throw error;
    },
  });
  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="space-y-5"
      noValidate
    >
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@company.ru"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
      </Field>
      <Field label="Пароль" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
      </Field>
      {mutation.error && <ErrorNotice error={mutation.error} />}
      <Button className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? 'Входим…' : 'Войти'}
      </Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        Доступ выдаёт администратор вашей компании.
      </p>
    </form>
  );
}
