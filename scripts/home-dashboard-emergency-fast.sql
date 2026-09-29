-- Production fast path for signed-in Home.
-- Applied 2026-09-29 after get_today_dashboard repeatedly hit PostgREST statement timeouts.
-- Keep Home lightweight; detailed fuel calculations stay in Training/Fuel.

create or replace function public.get_today_dashboard(p_today date default current_date)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
with me as (
  select auth.uid() as user_id
), active_plan as (
  select p.id,p.user_id,p.target_weekly_hours,p.generated_at
  from training_plans p, me
  where p.user_id=me.user_id and p.status='active'
  order by p.generated_at desc
  limit 1
), next_session as (
  select
    s.id,s.session_date,s.title,s.session_type,s.intensity_zone,
    coalesce(s.adjusted_duration_minutes,s.planned_duration_minutes) as duration_minutes,
    s.target_load,s.target_power_low_w,s.target_power_high_w,s.target_distance_km,s.target_elevation_m,s.is_key_session
  from active_plan p
  join training_plan_sessions s on s.plan_id=p.id
  where s.session_date>=p_today
    and s.session_type<>'race'
    and coalesce(s.status,'planned') not in ('completed','missed','cancelled')
    and not exists(select 1 from training_session_matches m where m.session_id=s.id)
  order by s.session_date,s.id
  limit 1
), week_sessions as (
  select
    count(*)::int as planned_sessions,
    count(*) filter(where coalesce(s.status,'')='completed' or exists(select 1 from training_session_matches m where m.session_id=s.id))::int as completed_sessions,
    coalesce(sum(coalesce(s.adjusted_duration_minutes,s.planned_duration_minutes)),0)::int as planned_minutes
  from active_plan p
  join training_plan_sessions s on s.plan_id=p.id
  where s.session_type<>'race'
    and s.session_date between date_trunc('week',p_today::timestamp)::date and (date_trunc('week',p_today::timestamp)::date+6)
    and coalesce(s.status,'planned')<>'cancelled'
), next7_sessions as (
  select
    count(*)::int as planned_sessions,
    coalesce(sum(coalesce(s.adjusted_duration_minutes,s.planned_duration_minutes)),0)::int as planned_minutes
  from active_plan p
  join training_plan_sessions s on s.plan_id=p.id
  where s.session_type<>'race'
    and s.session_date between p_today and (p_today+6)
    and coalesce(s.status,'planned') not in ('completed','missed','cancelled')
    and not exists(select 1 from training_session_matches m where m.session_id=s.id)
), recent_training as (
  select rs.hours_7d,rs.distance_km_7d,rs.activities_7d
  from training_rolling_summary rs, me
  where rs.user_id=me.user_id
), next_race as (
  select g.id,g.event_name,g.event_date,g.sport_type,g.event_type,g.distance_km,g.elevation_m,g.priority,g.terrain
  from race_goals g, me
  where g.user_id=me.user_id and g.status='active' and g.event_date>=p_today
  order by g.event_date,g.priority
  limit 1
), athlete as (
  select
    coalesce(nullif(trim(concat_ws(' ',sc.athlete->>'firstname',sc.athlete->>'lastname')),''),null) as athlete_name,
    sc.last_synced_at,(sc.id is not null) as strava_connected
  from me
  left join strava_connections sc on sc.user_id=me.user_id
), profile as (
  select tp.weekly_hours_target from me left join training_profiles tp on tp.user_id=me.user_id
), payload as (
select jsonb_build_object(
  'signed_in',me.user_id is not null,
  'athlete_name',athlete.athlete_name,
  'strava_connected',coalesce(athlete.strava_connected,false),
  'last_synced_at',athlete.last_synced_at,
  'target_weekly_hours',coalesce(profile.weekly_hours_target,active_plan.target_weekly_hours),
  'next_session',case when next_session.id is null then null else jsonb_build_object(
    'id',next_session.id,'date',next_session.session_date,'title',next_session.title,'type',next_session.session_type,'zone',next_session.intensity_zone,
    'duration_minutes',next_session.duration_minutes,'target_load',next_session.target_load,'power_low_w',next_session.target_power_low_w,'power_high_w',next_session.target_power_high_w,
    'distance_km',next_session.target_distance_km,'elevation_m',next_session.target_elevation_m,'is_key',next_session.is_key_session,
    'fuel_ready',false,'carbs_gph',null,'bottle_mix',null,'regular_gels',null,'boost_gels',null,'recover',null,'fluid_ml_h',null,'sodium_mg_h',null
  ) end,
  'week',jsonb_build_object('planned_sessions',coalesce(week_sessions.planned_sessions,0),'completed_sessions',coalesce(week_sessions.completed_sessions,0),'planned_minutes',coalesce(week_sessions.planned_minutes,0)),
  'next7',jsonb_build_object('planned_sessions',coalesce(next7_sessions.planned_sessions,0),'planned_minutes',coalesce(next7_sessions.planned_minutes,0)),
  'recent',jsonb_build_object('available',recent_training.hours_7d is not null,'activities_7d',coalesce(recent_training.activities_7d,0),'hours_7d',coalesce(recent_training.hours_7d,0),'distance_km_7d',coalesce(recent_training.distance_km_7d,0)),
  'next_race',case when next_race.id is null then null else jsonb_build_object(
    'id',next_race.id,'name',next_race.event_name,'date',next_race.event_date,'days_to_race',(next_race.event_date-p_today),'sport',next_race.sport_type,'type',next_race.event_type,
    'distance_km',next_race.distance_km,'elevation_m',next_race.elevation_m,'priority',next_race.priority,'terrain',next_race.terrain
  ) end
) as result
from me
left join active_plan on true
left join next_session on true
left join week_sessions on true
left join next7_sessions on true
left join recent_training on true
left join next_race on true
left join athlete on true
left join profile on true
)
select coalesce(result,'{}'::jsonb) from payload;
$function$;
