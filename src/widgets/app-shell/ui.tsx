import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Building2, ClipboardCheck, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useProfile } from '@/entities/session';
import { supabase } from '@/shared/api/client';
import { cn } from '@/shared/lib/utils';
import { Button, ErrorNotice } from '@/shared/ui';
import { Brand } from '@/shared/ui/brand';

export function AppShell() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    setError(null);
    const { error: cause } = await supabase.auth.signOut();
    setPending(false);
    if (cause) setError(cause);
    else navigate('/login', { replace: true });
  }
  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-2.5 border-b-2 px-1 py-4 text-sm font-medium',
      isActive
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground',
    );
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
      >
        К содержимому
      </a>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-[1328px] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to="/objects" aria-label="Стройка — главная">
            <Brand />
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{profile?.display_name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {profile?.role === 'manager' ? 'Постановщик' : 'Исполнитель'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Выйти"
              disabled={pending}
              onClick={() => void signOut()}
            >
              <LogOut size={18} />
            </Button>
          </div>
        </div>
        <nav
          aria-label="Главное меню"
          className="mx-auto flex max-w-[1328px] gap-8 px-5 sm:px-8"
        >
          <NavLink to="/objects" className={navClass}>
            <Building2 size={17} />
            Объекты
          </NavLink>
          {profile?.role === 'executor' && (
            <NavLink to="/my-tasks" className={navClass}>
              <ClipboardCheck size={17} />
              Мои задачи
            </NavLink>
          )}
        </nav>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[1328px] px-5 py-8 [overflow-wrap:anywhere] sm:px-8 sm:py-10"
      >
        {error != null && <ErrorNotice error={error} />}
        <Outlet />
      </main>
    </div>
  );
}
