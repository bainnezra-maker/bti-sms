-- Allow a teacher assignment made for an academic year to read that year's
-- semesters. When an assignment is explicitly tied to one semester, access
-- remains limited to that semester.
create or replace function public.teacher_can_access_term(target_term_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.teacher_assignments ta
    join public.terms target_term
      on target_term.id = target_term_id
    where ta.teacher_id = auth.uid()
      and ta.academic_year_id = target_term.academic_year_id
      and (ta.term_id is null or ta.term_id = target_term_id)
      and public.current_user_is_teacher()
  );
$function$;

revoke all on function public.teacher_can_access_term(uuid) from public;
grant execute on function public.teacher_can_access_term(uuid) to authenticated;
