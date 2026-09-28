-- Phase 5 follow-up: keep triathlon ml/h as the post-swim hourly target.
-- Total fluid excludes the swim, but the displayed hourly rate must not be diluted over total race time.

create or replace view public.race_fuel_plan as
select
  race_goal_id,
  user_id,
  event_name,
  event_date,
  sport_type,
  distance_km,
  elevation_m,
  goal_time_minutes,
  priority,
  race_duration_minutes,
  duration_source,
  bottle_duration_minutes,
  bottle_volume_ml,
  sodium_target_mg_per_hour,
  use_boost,
  max_auto_carbs_per_hour,
  boost_auto_threshold_minutes,
  override_carb_target_gph,
  override_boost_gels,
  pre_race_hydrate_servings,
  pre_race_regular_gels,
  pre_race_boost_gels,
  pre_race_carb_target_g,
  post_race_recover_servings,
  race_fuel_notes,
  carb_target_gph,
  race_duration_hours,
  hydration_bottles,
  case
    when sport_family='triathlon' and race_duration_minutes>coalesce(swim_duration_minutes,0)
      then round(fluid_target_ml_total::numeric/((race_duration_minutes-coalesce(swim_duration_minutes,0))::numeric/60.0))::integer
    else hydration_ml_per_hour
  end as hydration_ml_per_hour,
  fluid_target_ml_total,
  prepared_bottle_capacity_ml,
  sodium_target_mg_total,
  carb_target_g_total,
  ms_bottle_mix_sachets as bottle_mix_sachets,
  ms_total_gels as total_gels,
  ms_boost_gels as boost_gels,
  ms_regular_gels as regular_gels,
  ms_planned_carbs_g as planned_carbs_g,
  ms_planned_carbs_per_hour as planned_carbs_per_hour,
  ms_boost_gels*100 as caffeine_during_race_mg,
  (ms_boost_gels+pre_race_boost_gels)*100 as caffeine_total_race_day_mg,
  case when ms_boost_gels>0 then (
    select array_agg(round((p.race_duration_minutes::numeric*j.j)/(p.ms_boost_gels+1))::integer order by j.j)
    from generate_series(1,p.ms_boost_gels) j(j)
  ) else array[]::integer[] end as boost_timing_minutes,
  pre_race_note,
  case
    when sport_family='running' then 'Start fueling early. Spread gels across the race and use aid stations, soft flasks, a vest or carried fluid for hydration.'
    when sport_family='hyrox' then 'Keep race-day fueling simple and practised. Use gels only where duration and tolerance justify them, with normal fluids for hydration.'
    when sport_family='triathlon' then 'Start fueling early after the swim and make the bike the main fueling opportunity. Keep the run delivery simpler with gels and fluids.'
    when is_multi_day then 'Use the stage-by-stage plan for each day rather than one continuous race timeline.'
    else during_race_note
  end::text as during_race_note,
  case
    when sport_family='running' then 'Fluid and sodium are hourly targets, not a bottle prescription. Adjust for weather, sweat rate, aid-station access and what you can comfortably carry.'
    when sport_family='triathlon' then 'Fluid and sodium targets apply after the swim. Use bike bottles first, then aid stations or carried fluid on the run.'
    when is_multi_day then 'Each stage has its own fluid and sodium targets. Reassess conditions and recovery between stages.'
    else hydration_note
  end::text as hydration_note,
  recovery_note,
  high_carb_note
from public.race_fuel_plan_multisport p;

create or replace view public.race_fuel_timeline as
select
  t.user_id,
  t.race_goal_id,
  t.event_name,
  t.minute_mark,
  ((t.minute_mark+1000)*100+t.sort_order)::integer as sort_order,
  t.event_type,
  case
    when t.event_type='hydration_target' and p.sport_family='triathlon' and p.race_duration_minutes>coalesce(p.swim_duration_minutes,0)
      then ('Hydration target after the swim: about '||round(p.fluid_target_ml_total::numeric/((p.race_duration_minutes-coalesce(p.swim_duration_minutes,0))::numeric/60.0))::integer||' ml/h using bike bottles and run aid stations')::text
    else t.instruction
  end as instruction,
  t.item_number
from public.race_fuel_timeline_multisport t
join public.race_fuel_plan_multisport p on p.race_goal_id=t.race_goal_id and p.user_id=t.user_id;
