-- Athlete Profile v2: DOB-driven adult max-HR fallback.
-- Age-estimated HR is deliberately the last fallback behind threshold HR,
-- sport-specific max HR, Strava-observed max HR and the general max-HR field.

alter table public.training_profiles add column if not exists date_of_birth date;

comment on column public.training_profiles.date_of_birth is
  'Athlete date of birth. Used only as a fallback for age-estimated max heart rate when better sport-specific or observed HR data is unavailable.';

create or replace function public.training_estimated_max_hr(p_date_of_birth date)
returns integer
language sql
stable
set search_path to 'public'
as $function$
  select case
    when p_date_of_birth is null then null
    when extract(year from age(current_date,p_date_of_birth)) < 18 then null
    when extract(year from age(current_date,p_date_of_birth)) > 100 then null
    else round(208.0-(0.7*extract(year from age(current_date,p_date_of_birth))))::integer
  end
$function$;

-- refresh_training_session_targets v3-age-fallback was applied to production with
-- v_max_hr resolved in this order:
-- sport threshold HR -> sport max HR -> Strava observed max HR -> general max HR
-- -> DOB estimate (only when HR was detected or HR coaching was explicitly selected).
-- The full function remains managed in Supabase and reports
-- algorithm_version = session-target-resolver-v3-age-fallback.
