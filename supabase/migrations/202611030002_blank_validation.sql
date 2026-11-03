-- Whitespace-only inputs must fail even when bypassing browser validation.
alter table public.objects add constraint objects_name_not_blank check (name ~ '[^[:space:]]');
alter table public.objects add constraint objects_address_not_blank check (address ~ '[^[:space:]]');
alter table public.tasks add constraint tasks_title_not_blank check (title ~ '[^[:space:]]');
alter table public.task_history add constraint history_rework_reason_required
  check (to_status <> 'rework' or (comment is not null and comment ~ '[^[:space:]]'));
