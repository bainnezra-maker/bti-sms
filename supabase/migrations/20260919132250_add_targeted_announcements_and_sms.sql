alter table public.school_news
  add column if not exists audiences text[] not null default array['Students']::text[],
  add column if not exists target_form text not null default 'All',
  add column if not exists guardian_sms_enabled boolean not null default false,
  add column if not exists sms_total integer not null default 0,
  add column if not exists sms_sent integer not null default 0,
  add column if not exists sms_failed integer not null default 0,
  add column if not exists sms_missing_contact integer not null default 0,
  add column if not exists sms_last_sent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'school_news_audiences_check'
      and conrelid = 'public.school_news'::regclass
  ) then
    alter table public.school_news add constraint school_news_audiences_check
      check (
        cardinality(audiences) > 0
        and audiences <@ array['Students','Teachers','Housemasters','Guardians','Everyone']::text[]
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'school_news_sms_counts_check'
      and conrelid = 'public.school_news'::regclass
  ) then
    alter table public.school_news add constraint school_news_sms_counts_check
      check (sms_total >= 0 and sms_sent >= 0 and sms_failed >= 0 and sms_missing_contact >= 0);
  end if;
end
$$;

create table if not exists public.announcement_sms_deliveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  announcement_id uuid not null references public.school_news(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  student_name text,
  guardian_name text,
  recipient text,
  normalized_recipient text,
  status text not null default 'Pending'
    check (status in ('Pending','Sent','Failed','Missing Contact','Duplicate')),
  provider text not null default 'Hubtel',
  provider_message_id text,
  error text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (announcement_id, student_id)
);

create index if not exists announcement_sms_deliveries_school_status_idx
  on public.announcement_sms_deliveries (school_id, status, created_at desc);
create index if not exists announcement_sms_deliveries_announcement_idx
  on public.announcement_sms_deliveries (announcement_id, created_at desc);

alter table public.announcement_sms_deliveries enable row level security;
grant select, insert, update, delete on public.announcement_sms_deliveries to authenticated;

drop policy if exists "Admins can view announcement SMS deliveries" on public.announcement_sms_deliveries;
create policy "Admins can view announcement SMS deliveries"
on public.announcement_sms_deliveries for select to authenticated
using (current_user_is_admin() and school_id = current_user_school_id());

drop policy if exists "Admins can create announcement SMS deliveries" on public.announcement_sms_deliveries;
create policy "Admins can create announcement SMS deliveries"
on public.announcement_sms_deliveries for insert to authenticated
with check (current_user_is_admin() and school_id = current_user_school_id());

drop policy if exists "Admins can update announcement SMS deliveries" on public.announcement_sms_deliveries;
create policy "Admins can update announcement SMS deliveries"
on public.announcement_sms_deliveries for update to authenticated
using (current_user_is_admin() and school_id = current_user_school_id())
with check (current_user_is_admin() and school_id = current_user_school_id());

drop policy if exists "Admins can delete announcement SMS deliveries" on public.announcement_sms_deliveries;
create policy "Admins can delete announcement SMS deliveries"
on public.announcement_sms_deliveries for delete to authenticated
using (current_user_is_admin() and school_id = current_user_school_id());

drop policy if exists "Students can view published school news" on public.school_news;
create policy "Students can view targeted published school news"
on public.school_news for select to authenticated
using (
  current_user_is_student()
  and is_published = true
  and (audiences @> array['Everyone']::text[] or audiences @> array['Students']::text[])
  and (
    target_form = 'All'
    or exists (
      select 1
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = current_student_id()
        and e.status = 'active'
        and lower(coalesce(c.level,'')) = lower(school_news.target_form)
    )
  )
);

drop policy if exists "Staff can view targeted published school news" on public.school_news;
create policy "Staff can view targeted published school news"
on public.school_news for select to authenticated
using (
  is_published = true
  and school_id = current_user_school_id()
  and exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and coalesce(u.is_active,true) = true
      and (
        audiences @> array['Everyone']::text[]
        or (u.role = 'teacher'::public.user_role and audiences @> array['Teachers']::text[])
        or (u.role = 'housemaster'::public.user_role and audiences @> array['Housemasters']::text[])
        or (u.role = 'staff'::public.user_role and audiences @> array['Everyone']::text[])
      )
  )
);
