import { Building2 } from 'lucide-react';

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Building2 className="text-[#d92e42]" size={28} strokeWidth={1.7} />
      <span className="text-xl font-semibold tracking-[.07em]">СТРОЙКА</span>
      <span className="ml-2 hidden border-l pl-4 text-xs leading-4 text-muted-foreground sm:block">
        Объекты
        <br />и задачи
      </span>
    </div>
  );
}
