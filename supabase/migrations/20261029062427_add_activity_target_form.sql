alter table if exists public.school_activities
  add column if not exists target_form text not null default 'all';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_activities_target_form_check'
      and conrelid = 'public.school_activities'::regclass
  ) then
    alter table public.school_activities
      add constraint school_activities_target_form_check
      check (target_form in ('all', 'form_1', 'form_2', 'form_3'));
  end if;
end
$$;

create index if not exists school_activities_school_date_form_idx
  on public.school_activities (school_id, activity_date, target_form);

comment on column public.school_activities.target_form is
  'Audience for the activity: all, form_1, form_2, or form_3.';
