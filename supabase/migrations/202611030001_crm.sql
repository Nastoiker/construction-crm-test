-- All browser writes go through narrow, permission-checked RPCs.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  role public.app_role not null
);

create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 150),
  address text not null check (length(btrim(address)) between 1 and 300),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 150),
  description text not null default '' check (length(description) <= 5000),
  object_id uuid not null references public.objects(id),
  assignee_id uuid not null references public.profiles(id),
  author_id uuid not null references public.profiles(id),
  status public.task_status not null default 'new',
  created_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table public.task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  actor_id uuid not null references public.profiles(id),
  from_status public.task_status,
  to_status public.task_status not null,
  comment text check (length(comment) <= 2000),
  created_at timestamptz not null default clock_timestamp()
);

create index tasks_assignee_object_idx on public.tasks(assignee_id, object_id) where deleted_at is null;
create index tasks_object_idx on public.tasks(object_id) where deleted_at is null;
create index history_task_created_idx on public.task_history(task_id, created_at);

create function private.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'manager');
$$;

create function private.require_manager() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_manager() then
    raise exception 'Действие доступно только постановщику' using errcode = '42501';
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

-- Directory contains only display names and roles, never emails or auth metadata.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy tasks_read on public.tasks for select to authenticated
  using (deleted_at is null and (private.is_manager() or assignee_id = (select auth.uid())));
create policy objects_read on public.objects for select to authenticated
  using (deleted_at is null and (private.is_manager() or exists (
    select 1 from public.tasks t where t.object_id = objects.id and t.assignee_id = (select auth.uid()) and t.deleted_at is null
  )));
create policy history_read on public.task_history for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_history.task_id));

revoke all on public.profiles, public.objects, public.tasks, public.task_history from anon, authenticated;
grant select on public.profiles, public.objects, public.tasks, public.task_history to authenticated;

create function public.create_object(p_name text, p_address text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.require_manager();
  insert into public.objects(name, address, created_by)
    values (btrim(p_name), btrim(p_address), auth.uid()) returning id into result;
  return result;
end;
$$;

create function public.update_object(p_id uuid, p_name text, p_address text, p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  update public.objects set name = btrim(p_name), address = btrim(p_address), version = version + 1
    where id = p_id and deleted_at is null and version = p_version;
  if not found then raise exception 'Объект изменён или удалён. Обновите страницу.' using errcode = '40001'; end if;
end;
$$;

create function public.delete_object(p_id uuid, p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  -- Lock the parent first; task creation/editing takes the same lock.
  perform 1 from public.objects where id = p_id and deleted_at is null and version = p_version for update;
  if not found then raise exception 'Объект изменён или удалён. Обновите страницу.' using errcode = '40001'; end if;
  update public.tasks set deleted_at = now(), version = version + 1 where object_id = p_id and deleted_at is null;
  update public.objects set deleted_at = now(), version = version + 1 where id = p_id;
end;
$$;

create function private.check_assignee(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_id and role = 'executor') then
    raise exception 'Выберите действующего исполнителя' using errcode = '23514';
  end if;
end;
$$;

create function public.create_task(p_title text, p_description text, p_object_id uuid, p_assignee_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.require_manager();
  perform private.check_assignee(p_assignee_id);
  perform 1 from public.objects where id = p_object_id and deleted_at is null for update;
  if not found then raise exception 'Объект недоступен' using errcode = '23514'; end if;
  insert into public.tasks(title, description, object_id, assignee_id, author_id)
    values (btrim(p_title), p_description, p_object_id, p_assignee_id, auth.uid()) returning id into result;
  insert into public.task_history(task_id, actor_id, from_status, to_status)
    values (result, auth.uid(), null, 'new');
  return result;
end;
$$;

-- Object and author are immutable; moving a task is intentionally not part of this RPC.
create function public.update_task(p_id uuid, p_title text, p_description text, p_assignee_id uuid, p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  perform private.check_assignee(p_assignee_id);
  update public.tasks set title = btrim(p_title), description = p_description, assignee_id = p_assignee_id, version = version + 1
    where id = p_id and deleted_at is null and version = p_version;
  if not found then raise exception 'Задача изменена или удалена. Обновите данные.' using errcode = '40001'; end if;
end;
$$;

create function public.delete_task(p_id uuid, p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  update public.tasks set deleted_at = now(), version = version + 1
    where id = p_id and deleted_at is null and version = p_version;
  if not found then raise exception 'Задача изменена или удалена. Обновите данные.' using errcode = '40001'; end if;
end;
$$;

create function public.transition_task(p_id uuid, p_to public.task_status, p_version integer, p_comment text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare current_task public.tasks; allowed boolean := false;
begin
  select * into current_task from public.tasks where id = p_id and deleted_at is null for update;
  -- Use one error for unknown and foreign tasks to avoid disclosing their existence.
  if not found or not (private.is_manager() or current_task.assignee_id = auth.uid()) or auth.uid() is null then
    raise exception 'Задача недоступна' using errcode = '42501';
  end if;
  if current_task.version <> p_version or p_version is null then
    raise exception 'Задача изменена. Обновите данные.' using errcode = '40001';
  end if;
  if private.is_manager() then
    allowed := current_task.status = 'review' and p_to in ('accepted', 'rework');
  elsif current_task.assignee_id = auth.uid() then
    allowed := (current_task.status in ('new', 'rework') and p_to = 'in_progress')
      or (current_task.status = 'in_progress' and p_to = 'review');
  end if;
  if allowed is distinct from true then raise exception 'Недопустимый переход статуса' using errcode = '23514'; end if;
  if p_to = 'rework' and nullif(btrim(p_comment), '') is null then
    raise exception 'Укажите причину доработки' using errcode = '23514';
  end if;
  if length(p_comment) > 2000 then raise exception 'Комментарий слишком длинный' using errcode = '23514'; end if;
  update public.tasks set status = p_to, version = version + 1 where id = p_id;
  insert into public.task_history(task_id, actor_id, from_status, to_status, comment)
    values (p_id, auth.uid(), current_task.status, p_to, nullif(btrim(p_comment), ''));
end;
$$;

-- Default PostgreSQL function EXECUTE is PUBLIC: explicitly close it.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_manager() to authenticated;
revoke all on function public.create_object(text,text), public.update_object(uuid,text,text,integer),
  public.delete_object(uuid,integer), public.create_task(text,text,uuid,uuid),
  public.update_task(uuid,text,text,uuid,integer), public.delete_task(uuid,integer),
  public.transition_task(uuid,public.task_status,integer,text) from public, anon, authenticated;
grant execute on function public.create_object(text,text), public.update_object(uuid,text,text,integer),
  public.delete_object(uuid,integer), public.create_task(text,text,uuid,uuid),
  public.update_task(uuid,text,text,uuid,integer), public.delete_task(uuid,integer),
  public.transition_task(uuid,public.task_status,integer,text) to authenticated;

-- Admin API seed provisioning only; the service-role key must stay server-side.
grant all on public.profiles, public.objects, public.tasks, public.task_history to service_role;
