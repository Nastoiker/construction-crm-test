import { LoaderCircle, AlertCircle, FolderOpen } from 'lucide-react';
import { Button } from './button';
import { errorMessage } from '@/shared/lib/utils';

export function Loading() {
  return (
    <div
      role="status"
      className="flex items-center gap-3 py-12 text-muted-foreground"
    >
      <LoaderCircle className="animate-spin" size={20} />
      Загрузка данных…
    </div>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="my-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <AlertCircle size={18} />
      <span className="flex-1">{errorMessage(error)}</span>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-input bg-white px-6 py-16 text-center">
      <FolderOpen className="mx-auto mb-4 text-muted-foreground" size={32} />
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
