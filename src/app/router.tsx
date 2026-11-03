import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import {
  LoginPage,
  ObjectsPage,
  ObjectDetailsPage,
  TaskDetailsPage,
  MyTasksPage,
} from '@/pages';
import { AppShell } from '@/widgets/app-shell';
import { useSession, useProfile } from '@/entities/session';
import { Button, Empty, ErrorNotice, Loading } from '@/shared/ui';
import { supabase } from '@/shared/api/client';

function ProtectedRoute() {
  const { session, ready, error } = useSession();
  const profile = useProfile();
  if (!ready)
    return (
      <div className="p-8">
        <Loading />
      </div>
    );
  if (error)
    return (
      <div className="p-8">
        <ErrorNotice error={error} retry={() => window.location.reload()} />
      </div>
    );
  if (!session) return <Navigate to="/login" replace />;
  if (profile.isPending)
    return (
      <div className="p-8">
        <Loading />
      </div>
    );
  if (profile.error)
    return (
      <div className="p-8">
        <ErrorNotice
          error={profile.error}
          retry={() => void profile.refetch()}
        />
        <Button onClick={() => void supabase.auth.signOut()}>Выйти</Button>
      </div>
    );
  return <Outlet />;
}
export function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/objects" replace />} />
            <Route path="/objects" element={<ObjectsPage />} />
            <Route path="/objects/:id" element={<ObjectDetailsPage />} />
            <Route path="/tasks/:id" element={<TaskDetailsPage />} />
            <Route path="/my-tasks" element={<MyTasksPage />} />
            <Route
              path="*"
              element={
                <Empty
                  title="Страница не найдена"
                  description="Выберите раздел в главном меню."
                />
              }
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
