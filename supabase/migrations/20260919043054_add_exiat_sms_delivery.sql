alter table public.student_exiats
  add column if not exists guardian_message text,
  add column if not exists sms_status text not null default 'Not Sent',
  add column if not exists sms_message text,
  add column if not exists sms_recipient text,
  add column if not exists sms_provider text not null default 'Hubtel',
  add column if not exists sms_provider_message_id text,
  add column if not exists sms_attempt_count integer not null default 0,
  add column if not exists sms_last_attempt_at timestamptz,
  add column if not exists sms_sent_at timestamptz,
  add column if not exists sms_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_exiats_sms_status_check'
      and conrelid = 'public.student_exiats'::regclass
  ) then
    alter table public.student_exiats
      add constraint student_exiats_sms_status_check
      check (sms_status in ('Not Sent', 'Pending', 'Sent', 'Failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_exiats_sms_attempt_count_check'
      and conrelid = 'public.student_exiats'::regclass
  ) then
    alter table public.student_exiats
      add constraint student_exiats_sms_attempt_count_check
      check (sms_attempt_count >= 0);
  end if;
end
$$;

create index if not exists student_exiats_sms_status_idx
  on public.student_exiats (school_id, sms_status, created_at desc);
