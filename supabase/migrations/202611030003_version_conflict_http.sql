-- Business conflicts must not use serialization_failure: hosted PostgREST may retry it indefinitely.
-- PT409 returns HTTP 409 immediately; CREATE OR REPLACE preserves existing restricted grants.

create or replace function public.update_object(p_id uuid, p_name text, p_address text, p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  update public.objects set name = btrim(p_name), address = btrim(p_address), version = version + 1
    where id = p_id and deleted_at is null and version = p_version;
  if not found then raise exception 'Объект изменён или удалён. Обновите страницу.' using errcode = 'PT409'; end if;
end;
$$;

create or replace function public.delete_object(p_id uuid, p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  -- Lock the parent first; task creation/editing takes the same lock.
  perform 1 from public.objects where id = p_id and deleted_at is null and version = p_version for update;
  if not found then raise exception 'Объект изменён или удалён. Обновите страницу.' using errcode = 'PT409'; end if;
  update public.tasks set deleted_at = now(), version = version + 1 where object_id = p_id and deleted_at is null;
  update public.objects set deleted_at = now(), version = version + 1 where id = p_id;
end;
$$;

create or replace function public.update_task(p_id uuid, p_title text, p_description text, p_assignee_id uuid, p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  perform private.check_assignee(p_assignee_id);
  update public.tasks set title = btrim(p_title), description = p_description, assignee_id = p_assignee_id, version = version + 1
    where id = p_id and deleted_at is null and version = p_version;
  if not found then raise exception 'Задача изменена или удалена. Обновите данные.' using errcode = 'PT409'; end if;
end;
$$;

create or replace function public.delete_task(p_id uuid, p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  update public.tasks set deleted_at = now(), version = version + 1
    where id = p_id and deleted_at is null and version = p_version;
  if not found then raise exception 'Задача изменена или удалена. Обновите данные.' using errcode = 'PT409'; end if;
end;
$$;

create or replace function public.transition_task(p_id uuid, p_to public.task_status, p_version integer, p_comment text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare current_task public.tasks; allowed boolean := false;
begin
  select * into current_task from public.tasks where id = p_id and deleted_at is null for update;
  -- Use one error for unknown and foreign tasks to avoid disclosing their existence.
  if not found or not (private.is_manager() or current_task.assignee_id = auth.uid()) or auth.uid() is null then
    raise exception 'Задача недоступна' using errcode = '42501';
  end if;
  if current_task.version <> p_version or p_version is null then
    raise exception 'Задача изменена. Обновите данные.' using errcode = 'PT409';
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
