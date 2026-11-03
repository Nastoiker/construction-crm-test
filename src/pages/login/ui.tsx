import { Navigate } from 'react-router-dom';
import { SignInForm } from '@/features/sign-in';
import { useSession } from '@/entities/session';
import { isConfigured } from '@/shared/api/client';
import { Brand } from '@/shared/ui/brand';

export function LoginPage() {
  const { session } = useSession();
  if (session) return <Navigate to="/objects" replace />;
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-16">
      <div className="w-full max-w-[400px]">
        <div className="mb-12 flex justify-center">
          <Brand />
        </div>
        <h1 className="text-center text-2xl font-semibold">Вход в кабинет</h1>
        <p className="mb-8 mt-3 text-center text-sm text-muted-foreground">
          Управление объектами и задачами компании
        </p>
        {isConfigured ? (
          <SignInForm />
        ) : (
          <div role="alert" className="panel text-sm leading-6">
            Подключение к серверу ещё не настроено. Укажите VITE_SUPABASE_URL и
            VITE_SUPABASE_ANON_KEY в окружении сборки.
          </div>
        )}
      </div>
    </main>
  );
}
