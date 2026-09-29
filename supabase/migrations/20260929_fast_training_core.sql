create or replace function public.get_training_core_fast(p_today date default current_date)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
with me as (
  select auth.uid() as user_id
), dashboard as (
  select public.get_today_dashboard(p_today) as data
), profile as (
  select tp.user_id,tp.primary_sport,tp.available_weekdays,tp.long_session_weekday,tp.ftp_w,tp.weight_kg,tp.weekly_hours_target
  from me
  left join training_profiles tp on tp.user_id=me.user_id
), strava as (
  select exists(select 1 from strava_connections sc,me where sc.user_id=me.user_id) as connected
), race as (
  select g.id,g.event_name,g.event_date
  from race_goals g,me
  where g.user_id=me.user_id and g.status='active'
  order by g.event_date
  limit 1
), plan as (
  select p.id,p.race_goal_id
  from training_plans p,me
  where p.user_id=me.user_id and p.status='active'
  order by p.generated_at desc
  limit 1
), payload as (
  select d.data,
         jsonb_build_object(
           'strava_connected',s.connected,
           'athlete_details_exists',pr.user_id is not null,
           'primary_sport',coalesce(pr.primary_sport,'cycling'),
           'training_days_selected',coalesce(cardinality(pr.available_weekdays),0),
           'long_session_weekday',pr.long_session_weekday,
           'ftp_w',pr.ftp_w,
           'weight_kg',pr.weight_kg,
           'weekly_hours_target',pr.weekly_hours_target,
           'active_race_exists',r.id is not null,
           'race_goal_id',r.id,
           'event_name',r.event_name,
           'event_date',r.event_date,
           'active_plan_exists',p.id is not null,
           'plan_id',p.id,
           'fuel_defaults_exist',exists(select 1 from training_fueling_profiles ff,me where ff.user_id=me.user_id),
           'fuel_stock_entered',exists(select 1 from fuel_inventory fi,me where fi.user_id=me.user_id),
           'next_step',case
             when not s.connected then 'connect_strava'
             when pr.user_id is null or coalesce(cardinality(pr.available_weekdays),0)<2 then 'athlete_details'
             when r.id is null then 'add_race'
             when p.id is null then 'generate_plan'
             else 'ready'
           end,
           'next_step_label',case
             when not s.connected then 'Connect Strava'
             when pr.user_id is null or coalesce(cardinality(pr.available_weekdays),0)<2 then 'Complete athlete details'
             when r.id is null then 'Add your target event'
             when p.id is null then 'Build training plan'
             else 'Training setup complete'
           end
         ) as setup
  from dashboard d
  cross join profile pr
  cross join strava s
  left join race r on true
  left join plan p on true
)
select jsonb_build_object('dashboard',coalesce(data,'{}'::jsonb),'setup',coalesce(setup,'{}'::jsonb)) from payload;
$function$;

grant execute on function public.get_training_core_fast(date) to authenticated;
