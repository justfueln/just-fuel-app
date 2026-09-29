-- Hotfix: keep the Home dashboard off the heavy full-session fuel view.
-- Applied to production after repeated get_today_dashboard statement timeouts.
-- The full Training/Fuel engines remain unchanged; Home calculates only the next-session summary it needs.

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
    s.id,s.user_id,s.session_date,s.sport_type,s.title,s.session_type,s.intensity_zone,
    coalesce(s.adjusted_duration_minutes,s.planned_duration_minutes) as duration_minutes,
    s.target_load,s.target_power_low_w,s.target_power_high_w,s.target_distance_km,s.target_elevation_m,s.is_key_session
  from active_plan p
  join training_plan_sessions s on s.plan_id=p.id
  where s.session_date>=p_today
    and s.session_type<>'race'
    and coalesce(s.status,'planned') not in ('completed','missed','cancelled')
    and not exists(select 1 from training_session_matches m where m.session_id=s.id)
  order by s.session_date,s.priority desc nulls last,s.id
  limit 1
), fuel_base as (
  select
    s.*,
    training_sport_family(s.sport_type) as sport_family,
    lower(coalesce(s.session_type,'')) as session_type_key,
    coalesce(p.carb_strategy,'auto') as carb_strategy,
    coalesce(p.max_auto_carbs_per_hour,90) as max_auto_carbs_per_hour,
    o.carb_target_gph as override_carb_target_gph,
    coalesce(o.bottle_duration_minutes,p.bottle_duration_minutes,90) as bottle_duration_minutes,
    coalesce(o.bottle_volume_ml,p.bottle_volume_ml,750) as bottle_volume_ml,
    coalesce(o.sodium_target_mg_per_hour,p.sodium_target_mg_per_hour,700) as sodium_target_mg_per_hour,
    coalesce(p.use_boost,true) as use_boost,
    coalesce(p.boost_auto_threshold_minutes,120) as boost_auto_threshold_minutes,
    coalesce(p.recover_after_key_sessions,true) as recover_after_key_sessions,
    o.boost_gels as override_boost_gels,
    o.recover_servings as override_recover_servings
  from next_session s
  left join training_fueling_profiles p on p.user_id=s.user_id
  left join training_session_fuel_overrides o on o.user_id=s.user_id and o.session_id=s.id
), fuel_auto as (
  select b.*,
    case
      when b.sport_family='cycling' then case
        when b.session_type_key in ('recovery','openers') and b.duration_minutes<=90 then 0
        when b.session_type_key='easy_endurance' and b.duration_minutes<=90 then 0
        when b.session_type_key='easy_endurance' then 50
        when b.session_type_key in ('endurance','bike_endurance') and b.duration_minutes<=75 then 0
        when b.session_type_key in ('endurance','bike_endurance') and b.duration_minutes<=120 then 50
        when b.session_type_key in ('endurance','bike_endurance') then 60
        when b.session_type_key in ('tempo','threshold','vo2') and b.duration_minutes<=120 then 60
        when b.session_type_key in ('tempo','threshold','vo2') then 90
        when b.session_type_key in ('long_endurance','race_specific','long_race_specific','brick_long') and b.duration_minutes<120 then 60
        when b.session_type_key in ('long_endurance','race_specific','long_race_specific','brick_long') then 90
        when b.duration_minutes<=75 then 0 when b.duration_minutes<=120 then 50 else 60 end
      when b.sport_family='running' then case
        when (b.session_type_key like '%recovery%' or b.session_type_key like '%easy%') and b.duration_minutes<=60 then 0
        when (b.session_type_key like '%recovery%' or b.session_type_key like '%easy%') and b.duration_minutes<=90 then 50
        when b.session_type_key like '%recovery%' or b.session_type_key like '%easy%' then 60
        when (b.session_type_key like '%quality%' or b.session_type_key like '%interval%' or b.session_type_key like '%tempo%' or b.session_type_key like '%threshold%' or b.session_type_key like '%vo2%') and b.duration_minutes<=60 then 50
        when (b.session_type_key like '%quality%' or b.session_type_key like '%interval%' or b.session_type_key like '%tempo%' or b.session_type_key like '%threshold%' or b.session_type_key like '%vo2%') and b.duration_minutes<=120 then 60
        when b.session_type_key like '%quality%' or b.session_type_key like '%interval%' or b.session_type_key like '%tempo%' or b.session_type_key like '%threshold%' or b.session_type_key like '%vo2%' then 90
        when b.session_type_key like '%long%' and b.duration_minutes<=75 then 50
        when b.session_type_key like '%long%' and b.duration_minutes<=150 then 60
        when b.session_type_key like '%long%' then 90
        when b.duration_minutes<=60 then 0 when b.duration_minutes<=90 then 50 when b.duration_minutes<=150 then 60 else 90 end
      when b.sport_family='hyrox' then case when b.duration_minutes<=90 then 0 when b.duration_minutes<=150 then 50 else 60 end
      when b.sport_family='swimming' then case when b.duration_minutes<=75 then 0 when b.duration_minutes<=120 then 50 else 60 end
      when b.sport_family='triathlon' then case when b.duration_minutes<=60 then 0 when b.duration_minutes<=120 then 60 else 90 end
      else case when b.duration_minutes<=75 then 0 when b.duration_minutes<=120 then 50 else 60 end
    end as auto_carb_target_gph
  from fuel_base b
), fuel_target as (
  select a.*,
    case
      when a.override_carb_target_gph is not null then greatest(0,least(120,a.override_carb_target_gph))
      when a.carb_strategy in ('50','60','90','120') then a.carb_strategy::int
      else least(a.auto_carb_target_gph,least(coalesce(a.max_auto_carbs_per_hour,90),90))
    end as carb_target_gph,
    case
      when a.sport_family='cycling' then greatest(300,round(a.bottle_volume_ml::numeric/nullif(a.bottle_duration_minutes,0)*60)::int)
      when a.sport_family='running' then 500
      when a.sport_family='hyrox' then 500
      when a.sport_family='swimming' then 400
      when a.sport_family='triathlon' then 600
      else 500
    end as hydration_ml_per_hour
  from fuel_auto a
), fuel_products as (
  select t.*,
    round(t.carb_target_gph::numeric*(t.duration_minutes::numeric/60.0))::int as carb_total,
    greatest(0,ceil(t.hydration_ml_per_hour::numeric*(t.duration_minutes::numeric/60.0)/250.0)*250)::int as hydration_total
  from fuel_target t
), fuel_bottles as (
  select p.*,
    case
      when p.carb_target_gph<=0 then 0
      when p.sport_family='cycling' then least(ceil(p.hydration_total::numeric/nullif(p.bottle_volume_ml,0))::int,greatest(1,ceil(p.carb_total::numeric/60.0)::int))
      when p.sport_family='swimming' then greatest(1,least(ceil(p.duration_minutes::numeric/90.0)::int,ceil(p.carb_total::numeric/60.0)::int))
      else 0
    end as bottle_mix_sachets
  from fuel_products p
), fuel_gels as (
  select b.*,
    case
      when b.carb_target_gph<=0 then 0
      when b.sport_family in ('running','hyrox','triathlon') then ceil(greatest(0,b.carb_total-b.bottle_mix_sachets*60)::numeric/40.0)::int
      else greatest(0,round(greatest(0,b.carb_total-b.bottle_mix_sachets*60)::numeric/40.0)::int)
    end as total_gels
  from fuel_bottles b
), next_fuel as (
  select g.*,
    case
      when g.total_gels<=0 then 0
      when g.override_boost_gels is not null then least(g.total_gels,greatest(0,g.override_boost_gels))
      when g.use_boost and g.duration_minutes>=g.boost_auto_threshold_minutes and (g.is_key_session or g.session_type_key in ('tempo','threshold','vo2','long_endurance','race_specific','long_race_specific','brick_long') or g.session_type_key like '%quality%' or g.session_type_key like '%interval%' or g.session_type_key like '%long%') then 1
      else 0
    end as boost_gels,
    case
      when g.override_recover_servings is not null then greatest(0,g.override_recover_servings)
      when g.recover_after_key_sessions and (g.is_key_session or g.duration_minutes>=120 or coalesce(g.target_load,0)>=75 or (g.sport_family='hyrox' and g.duration_minutes>=60) or (g.sport_family='running' and (g.session_type_key like '%quality%' or g.session_type_key like '%long%') and g.duration_minutes>=75)) then 1
      else 0
    end as recover_servings
  from fuel_gels g
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
    'fuel_ready',true,'carbs_gph',next_fuel.carb_target_gph,'bottle_mix',next_fuel.bottle_mix_sachets,'regular_gels',greatest(0,next_fuel.total_gels-next_fuel.boost_gels),'boost_gels',next_fuel.boost_gels,'recover',next_fuel.recover_servings,'fluid_ml_h',next_fuel.hydration_ml_per_hour,'sodium_mg_h',next_fuel.sodium_target_mg_per_hour
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
left join next_fuel on true
left join week_sessions on true
left join next7_sessions on true
left join recent_training on true
left join next_race on true
left join athlete on true
left join profile on true
)
select coalesce(result,'{}'::jsonb) from payload;
$function$;
