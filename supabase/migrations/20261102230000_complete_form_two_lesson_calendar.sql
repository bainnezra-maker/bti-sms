-- Complete the approved 2026/2027 Form 2 lesson-plan calendar.
-- The import previously stopped after 26 October, which left USB/LSP
-- generation without the remaining approved weeks.
with calendar_rows(title, activity_date) as (
  values
    ('LESSON PLAN', date '2026-11-02'),
    ('SRC WEEK/ SKILLS DISCOVERY', date '2026-11-09'),
    ('LESSON PLAN', date '2026-11-16'),
    ('LESSON PLAN', date '2026-11-23'),
    ('REVISION', date '2026-11-30'),
    ('END OF SEMESTER EXAMS', date '2026-12-07'),
    ('END OF SEMESTER EXAMS', date '2026-12-14'),
    ('VACATION', date '2026-12-18')
), target_years as (
  select id as academic_year_id, school_id
  from public.academic_years
  where name = '2026/2027'
)
insert into public.school_activities (
  school_id,
  academic_year_id,
  title,
  activity_date,
  end_date,
  activity_type,
  target_form,
  is_all_staff
)
select
  target_years.school_id,
  target_years.academic_year_id,
  calendar_rows.title,
  calendar_rows.activity_date,
  calendar_rows.activity_date,
  'general',
  'form_2',
  false
from target_years
cross join calendar_rows
where not exists (
  select 1
  from public.school_activities existing
  where existing.school_id = target_years.school_id
    and existing.academic_year_id = target_years.academic_year_id
    and existing.activity_date = calendar_rows.activity_date
    and existing.target_form = 'form_2'
);
