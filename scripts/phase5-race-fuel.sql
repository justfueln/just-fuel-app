-- Phase 5: sport-aware race fuel engine.
-- Single-day cycling/running/triathlon + stage-race aggregation.
-- Keeps the public race_fuel_plan / race_fuel_timeline contracts intact.

create or replace view public.race_fuel_plan_multisport as
with base as (
  select
    p.*,
    public.training_sport_family(p.sport_type) as sport_family,
    coalesce(a.multi_day,false) as is_multi_day,
    a.stage_count,
    a.swim_km,
    a.bike_km,
    a.run_km,
    case public.training_sport_family(p.sport_type)
      when 'cycling' then 'bottle_first'
      when 'running' then 'gels_first'
      when 'hyrox' then 'gels_first'
      when 'triathlon' then 'tri_split'
      else 'mixed'
    end::text as fuel_delivery_mode
  from public.race_fuel_plan_base_v1 p
  left join public.athlete_season_events a on a.race_goal_id=p.race_goal_id
), stage_agg as (
  select
    user_id,
    race_goal_id,
    count(*) filter(where estimated_duration_minutes is not null) as planned_stages,
    coalesce(sum(estimated_duration_minutes),0)::integer as duration_minutes,
    coalesce(round(sum(carb_target_gph::numeric*estimated_duration_minutes)/nullif(sum(estimated_duration_minutes),0)),0)::integer as carb_target_gph,
    coalesce(sum(round(carb_target_gph::numeric*(estimated_duration_minutes::numeric/60.0))),0)::integer as carb_target_g_total,
    coalesce(sum(bottle_mix_sachets),0)::integer as bottle_mix_sachets,
    coalesce(sum(regular_gels),0)::integer as regular_gels,
    coalesce(sum(boost_gels),0)::integer as boost_gels,
    coalesce(sum(hydrate_servings),0)::integer as hydrate_servings,
    coalesce(sum(recover_servings),0)::integer as recover_servings,
    coalesce(sum(round(fluid_ml_per_hour::numeric*(estimated_duration_minutes::numeric/60.0))),0)::integer as fluid_total_ml,
    coalesce(sum(round(sodium_mg_per_hour::numeric*(estimated_duration_minutes::numeric/60.0))),0)::integer as sodium_total_mg
  from public.race_stage_plans
  group by user_id,race_goal_id
), effective as (
  select
    b.*,
    s.planned_stages,
    case when b.is_multi_day and coalesce(s.duration_minutes,0)>0 then s.duration_minutes else b.race_duration_minutes end::integer as effective_duration_minutes,
    case when b.is_multi_day and coalesce(s.duration_minutes,0)>0 then 'stage_plan' else b.duration_source end::text as effective_duration_source,
    case when b.is_multi_day and coalesce(s.duration_minutes,0)>0 then s.carb_target_gph else b.carb_target_gph end::integer as effective_carb_target_gph,
    case when b.is_multi_day and coalesce(s.duration_minutes,0)>0 then s.carb_target_g_total else round(b.carb_target_gph::numeric*(b.race_duration_minutes::numeric/60.0))::integer end as effective_carb_target_g_total,
    case when b.is_multi_day and coalesce(s.duration_minutes,0)>0 then s.hydrate_servings else b.pre_race_hydrate_servings end::integer as effective_pre_hydrate,
    case when b.is_multi_day and coalesce(s.duration_minutes,0)>0 then s.recover_servings else b.post_race_recover_servings end::integer as effective_recover,
    s.bottle_mix_sachets as stage_mix,
    s.regular_gels as stage_regular,
    s.boost_gels as stage_boost,
    s.fluid_total_ml as stage_fluid_total_ml,
    s.sodium_total_mg as stage_sodium_total_mg
  from base b
  left join stage_agg s on s.user_id=b.user_id and s.race_goal_id=b.race_goal_id
), leg_weights as (
  select e.*,
    case when e.sport_family='triathlon' then coalesce(nullif(e.swim_km,0)*20.0,e.effective_duration_minutes*0.15) else 0 end::numeric as swim_weight,
    case when e.sport_family='triathlon' then coalesce(nullif(e.bike_km,0)*2.0,e.effective_duration_minutes*0.55) else 0 end::numeric as bike_weight,
    case when e.sport_family='triathlon' then coalesce(nullif(e.run_km,0)*6.0,e.effective_duration_minutes*0.30) else 0 end::numeric as run_weight
  from effective e
), leg_times as (
  select w.*,
    case when w.sport_family='triathlon' then round(w.effective_duration_minutes*w.swim_weight/nullif(w.swim_weight+w.bike_weight+w.run_weight,0))::integer else null end as swim_duration_minutes,
    case when w.sport_family='triathlon' then round(w.effective_duration_minutes*w.bike_weight/nullif(w.swim_weight+w.bike_weight+w.run_weight,0))::integer else null end as bike_duration_minutes
  from leg_weights w
), quantities as (
  select l.*,
    case
      when l.is_multi_day and coalesce(l.stage_mix,0)>=0 then coalesce(l.stage_mix,0)
      when l.sport_family in ('running','hyrox') then 0
      when l.sport_family='triathlon' then case when l.effective_carb_target_gph<=0 then 0 else greatest(0,ceil(coalesce(l.bike_duration_minutes,0)::numeric/nullif(l.bottle_duration_minutes,0))::integer) end
      else l.bottle_mix_sachets
    end::integer as ms_bottle_mix_sachets,
    case
      when l.is_multi_day then coalesce(l.stage_regular,0)+coalesce(l.stage_boost,0)
      when l.sport_family in ('running','hyrox') and l.effective_carb_target_g_total>0 then ceil(l.effective_carb_target_g_total::numeric/40.0)::integer
      when l.sport_family='triathlon' then greatest(0,round(greatest(0,l.effective_carb_target_g_total-(greatest(0,ceil(coalesce(l.bike_duration_minutes,0)::numeric/nullif(l.bottle_duration_minutes,0))::integer)*60))::numeric/40.0)::integer)
      else l.total_gels
    end::integer as ms_total_gels
  from leg_times l
), caffeine as (
  select q.*,
    case
      when q.is_multi_day then coalesce(q.stage_boost,0)
      when q.ms_total_gels<=0 or not q.use_boost then 0
      when q.override_boost_gels is not null then least(q.override_boost_gels,q.ms_total_gels)
      when q.race_duration_minutes<150 then 0
      when q.sport_family in ('running','hyrox','triathlon') then least(q.ms_total_gels,1+floor(greatest(0,q.effective_duration_minutes-150)::numeric/120.0)::integer)
      else least(q.ms_total_gels,q.boost_gels)
    end::integer as ms_boost_gels
  from quantities q
), final_calc as (
  select c.*,
    greatest(0,c.ms_total_gels-c.ms_boost_gels)::integer as ms_regular_gels,
    (c.ms_bottle_mix_sachets*60+c.ms_total_gels*40)::integer as ms_planned_carbs_g,
    case when c.effective_duration_minutes>0 then round((c.ms_bottle_mix_sachets*60+c.ms_total_gels*40)::numeric/(c.effective_duration_minutes::numeric/60.0),1) else 0::numeric end as ms_planned_carbs_per_hour,
    case
      when c.is_multi_day and coalesce(c.stage_fluid_total_ml,0)>0 then c.stage_fluid_total_ml
      when c.sport_family='triathlon' then round(c.hydration_ml_per_hour::numeric*(greatest(0,c.effective_duration_minutes-coalesce(c.swim_duration_minutes,0))::numeric/60.0))::integer
      else c.fluid_target_ml_total
    end::integer as effective_fluid_total_ml,
    case
      when c.is_multi_day and coalesce(c.stage_sodium_total_mg,0)>0 then c.stage_sodium_total_mg
      when c.sport_family='triathlon' then round(c.sodium_target_mg_per_hour::numeric*(greatest(0,c.effective_duration_minutes-coalesce(c.swim_duration_minutes,0))::numeric/60.0))::integer
      else c.sodium_target_mg_total
    end::integer as effective_sodium_total_mg
  from caffeine c
)
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
  effective_duration_minutes as race_duration_minutes,
  effective_duration_source as duration_source,
  bottle_duration_minutes,
  bottle_volume_ml,
  case when is_multi_day and effective_duration_minutes>0 then round(effective_sodium_total_mg::numeric/(effective_duration_minutes::numeric/60.0))::integer else sodium_target_mg_per_hour end as sodium_target_mg_per_hour,
  use_boost,
  max_auto_carbs_per_hour,
  boost_auto_threshold_minutes,
  override_carb_target_gph,
  override_boost_gels,
  effective_pre_hydrate as pre_race_hydrate_servings,
  pre_race_regular_gels,
  pre_race_boost_gels,
  pre_race_carb_target_g,
  effective_recover as post_race_recover_servings,
  race_fuel_notes,
  effective_carb_target_gph as carb_target_gph,
  round(effective_duration_minutes::numeric/60.0,2) as race_duration_hours,
  case when bottle_volume_ml>0 then ceil(effective_fluid_total_ml::numeric/bottle_volume_ml)::integer else 0 end as hydration_bottles,
  case when effective_duration_minutes>0 then round(effective_fluid_total_ml::numeric/(effective_duration_minutes::numeric/60.0))::integer else hydration_ml_per_hour end as hydration_ml_per_hour,
  effective_fluid_total_ml as fluid_target_ml_total,
  (ms_bottle_mix_sachets*bottle_volume_ml)::integer as prepared_bottle_capacity_ml,
  effective_sodium_total_mg as sodium_target_mg_total,
  effective_carb_target_g_total as carb_target_g_total,
  bottle_mix_sachets,
  total_gels,
  boost_gels,
  regular_gels,
  planned_carbs_g,
  planned_carbs_per_hour,
  caffeine_during_race_mg,
  caffeine_total_race_day_mg,
  boost_timing_minutes,
  pre_race_note,
  during_race_note,
  hydration_note,
  recovery_note,
  high_carb_note,
  sport_family,
  fuel_delivery_mode,
  ms_bottle_mix_sachets,
  ms_total_gels,
  ms_boost_gels,
  ms_regular_gels,
  ms_planned_carbs_g,
  ms_planned_carbs_per_hour,
  case
    when is_multi_day then 'Use the stage-by-stage plan. Product totals are aggregated across the full event; each stage keeps its own duration, carbs, hydration and recovery plan.'
    when sport_family='running' then 'Gels are the primary race carbohydrate source. Use aid stations, soft flasks, a vest or carried fluid to meet the fluid target.'
    when sport_family='hyrox' then 'Keep race fuel simple. Use gels only when the event duration and practiced tolerance justify carbohydrate during the race, with normal fluids for hydration.'
    when sport_family='cycling' then 'Bottle Mix is the primary carbohydrate source and gels fill the remaining carbohydrate target.'
    when sport_family='triathlon' then 'Fuel the bike with Bottle Mix, then use gels to close the full-race carbohydrate target and keep the run delivery simple with gels plus aid-station fluids.'
    else 'Use the planned carbohydrate and fluid targets with products you have already practised.'
  end::text as delivery_note,
  is_multi_day,
  swim_duration_minutes,
  bike_duration_minutes,
  case when sport_family='triathlon' then greatest(0,effective_duration_minutes-coalesce(swim_duration_minutes,0)-coalesce(bike_duration_minutes,0)) else null end::integer as run_duration_minutes
from final_calc;

create or replace view public.race_fuel_timeline_multisport as
with p as (
  select * from public.race_fuel_plan_multisport
), pre_events as (
  select user_id,race_goal_id,event_name,-90 as minute_mark,5 as sort_order,'pre_hydrate'::text as event_type,
    ('Pre-race: '||pre_race_hydrate_servings||' Hydrate serving(s), according to normal tolerance')::text as instruction,1 as item_number
  from p where pre_race_hydrate_servings>0 and not is_multi_day
  union all
  select user_id,race_goal_id,event_name,-15,10,'pre_gel',('Pre-race: '||pre_race_regular_gels||' regular gel(s)')::text,1
  from p where pre_race_regular_gels>0 and not is_multi_day
  union all
  select user_id,race_goal_id,event_name,-15,11,'pre_boost',('Pre-race: '||pre_race_boost_gels||' Boost gel(s)')::text,1
  from p where pre_race_boost_gels>0 and not is_multi_day
), stage_note as (
  select user_id,race_goal_id,event_name,0 as minute_mark,15 as sort_order,'stage_plan'::text as event_type,
    'Use the stage-by-stage fuel plan for this multi-day event. Each stage has its own Bottle Mix, gels, Hydrate and Recover quantities.'::text as instruction,1 as item_number
  from p where is_multi_day
), hydration_start as (
  select user_id,race_goal_id,event_name,0 as minute_mark,18 as sort_order,'hydration_target'::text as event_type,
    case
      when sport_family='running' then ('Hydration target: about '||hydration_ml_per_hour||' ml/h using aid stations or what you can comfortably carry')::text
      when sport_family='hyrox' then ('Hydration target: about '||hydration_ml_per_hour||' ml/h according to event access and tolerance')::text
      when sport_family='triathlon' then ('Hydration target after the swim: about '||hydration_ml_per_hour||' ml/h using bike bottles and run aid stations')::text
      else ('Hydration target: about '||hydration_ml_per_hour||' ml/h')::text
    end as instruction,1 as item_number
  from p where not is_multi_day
), transitions as (
  select user_id,race_goal_id,event_name,coalesce(swim_duration_minutes,0) as minute_mark,19 as sort_order,'t1'::text as event_type,
    'T1: begin bike fueling early. Start Bottle Mix once settled on the bike.'::text as instruction,1 as item_number
  from p where sport_family='triathlon' and not is_multi_day and coalesce(swim_duration_minutes,0)>0
  union all
  select user_id,race_goal_id,event_name,coalesce(swim_duration_minutes,0)+coalesce(bike_duration_minutes,0),40,'t2',
    'T2: switch to the simpler run strategy — gels plus fluids from aid stations or what you carry.'::text,1
  from p where sport_family='triathlon' and not is_multi_day and coalesce(bike_duration_minutes,0)>0
), bottles as (
  select p.user_id,p.race_goal_id,p.event_name,
    case when p.sport_family='triathlon' then coalesce(p.swim_duration_minutes,0)+(gs.n-1)*p.bottle_duration_minutes else (gs.n-1)*p.bottle_duration_minutes end::integer as minute_mark,
    20 as sort_order,'bottle'::text as event_type,
    case when p.sport_family='triathlon' then ('Bike bottle '||gs.n||' — 1 Bottle Mix in '||p.bottle_volume_ml||' ml')::text else ('Bottle '||gs.n||' — 1 Bottle Mix in '||p.bottle_volume_ml||' ml')::text end as instruction,
    gs.n as item_number
  from p cross join lateral generate_series(1,p.ms_bottle_mix_sachets) gs(n)
  where not p.is_multi_day and p.fuel_delivery_mode in ('bottle_first','tri_split','mixed') and p.ms_bottle_mix_sachets>0
), gel_positions as (
  select p.*,
    i.i,
    case
      when p.sport_family='triathlon' then coalesce(p.swim_duration_minutes,0)+round((greatest(1,p.race_duration_minutes-coalesce(p.swim_duration_minutes,0))::numeric*i.i)/(p.ms_total_gels+1))::integer
      else round((p.race_duration_minutes::numeric*i.i)/(p.ms_total_gels+1))::integer
    end as gel_minute
  from p cross join lateral generate_series(1,p.ms_total_gels) i(i)
  where not p.is_multi_day
), boost_indices as (
  select p.race_goal_id,round((j.j::numeric*(p.ms_total_gels+1))/(p.ms_boost_gels+1))::integer as gel_index
  from p cross join lateral generate_series(1,p.ms_boost_gels) j(j)
  where not p.is_multi_day
), gel_events as (
  select g.user_id,g.race_goal_id,g.event_name,g.gel_minute as minute_mark,30 as sort_order,
    case when exists(select 1 from boost_indices bi where bi.race_goal_id=g.race_goal_id and bi.gel_index=g.i) then 'boost' else 'gel' end::text as event_type,
    case when exists(select 1 from boost_indices bi where bi.race_goal_id=g.race_goal_id and bi.gel_index=g.i) then 'Take 1 Boost gel (40 g carbs, 100 mg caffeine)' else 'Take 1 Energy Gel (40 g carbs)' end::text as instruction,
    g.i as item_number
  from gel_positions g
), post_events as (
  select user_id,race_goal_id,event_name,race_duration_minutes+15 as minute_mark,90 as sort_order,'recover'::text as event_type,
    ('Post-race: '||post_race_recover_servings||' Recover serving(s)')::text as instruction,1 as item_number
  from p where post_race_recover_servings>0 and not is_multi_day
)
select * from pre_events
union all select * from stage_note
union all select * from hydration_start
union all select * from transitions
union all select * from bottles
union all select * from gel_events
union all select * from post_events;

create or replace view public.race_fuel_timeline as
select user_id,race_goal_id,event_name,minute_mark,((minute_mark+1000)*100+sort_order)::integer as sort_order,event_type,instruction,item_number
from public.race_fuel_timeline_multisport;

create or replace function public.build_personalized_stage_plan(p_race_goal_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_user uuid;v_event uuid;v_sport text;v_base_speed numeric;v_climb_density numeric;
  v_bottle_minutes integer;v_bottle_ml integer;v_fluid integer;v_sodium integer;v_use_boost boolean;v_max_auto integer;
  v_race_carb integer;v_stage_carb integer;
  v_count integer:=0;r record;ap record;v_hours numeric;v_stage_density numeric;v_terrain_factor numeric;v_fatigue_factor numeric;
  v_duration integer;v_mix integer;v_total_carbs integer;v_gels integer;v_boost integer;v_regular integer;v_stage_plan_id uuid;v_pacing text;v_equipment text;
begin
  select g.user_id,g.catalog_event_id,e.sport_category into v_user,v_event,v_sport
  from public.race_goals g left join public.event_catalog e on e.id=g.catalog_event_id
  where g.id=p_race_goal_id and g.status='active';
  if v_user is null then raise exception 'Race not found'; end if;
  if auth.uid() is not null and auth.uid()<>v_user then raise exception 'Not allowed'; end if;
  if v_event is null then raise exception 'Race is not linked to an event catalogue entry'; end if;

  if v_sport='running' then
    select coalesce(percentile_cont(0.5) within group(order by (distance_m/1000.0)/(moving_time_s/3600.0)) filter(where sport_family='running' and moving_time_s>0 and distance_m>=5000),9.0),
           coalesce(percentile_cont(0.5) within group(order by total_elevation_gain_m/(distance_m/1000.0)) filter(where sport_family='running' and distance_m>=5000),15.0)
      into v_base_speed,v_climb_density
    from public.training_activity_metrics
    where user_id=v_user and start_date_local>=now()-interval '90 days';
  else
    select coalesce(percentile_cont(0.5) within group(order by (distance_m/1000.0)/(moving_time_s/3600.0)) filter(where sport_family='cycling' and moving_time_s>0 and distance_m>=20000),24.0),
           coalesce(percentile_cont(0.5) within group(order by total_elevation_gain_m/(distance_m/1000.0)) filter(where sport_family='cycling' and distance_m>=20000),10.0)
      into v_base_speed,v_climb_density
    from public.training_activity_metrics
    where user_id=v_user and start_date_local>=now()-interval '90 days';
  end if;

  select coalesce(max_auto_carbs_per_hour,90),coalesce(bottle_duration_minutes,90),coalesce(bottle_volume_ml,750),coalesce(sodium_target_mg_per_hour,700),coalesce(use_boost,true)
  into v_max_auto,v_bottle_minutes,v_bottle_ml,v_sodium,v_use_boost
  from public.training_fueling_profiles where user_id=v_user;
  v_max_auto:=coalesce(v_max_auto,90);v_bottle_minutes:=coalesce(v_bottle_minutes,90);v_bottle_ml:=coalesce(v_bottle_ml,750);v_sodium:=coalesce(v_sodium,700);v_use_boost:=coalesce(v_use_boost,true);
  select carb_target_gph into v_race_carb from public.race_fueling_overrides where user_id=v_user and race_goal_id=p_race_goal_id;
  v_fluid:=round(v_bottle_ml*60.0/nullif(v_bottle_minutes,0));

  for r in select * from public.event_stage_catalog where event_catalog_id=v_event order by stage_number loop
    if coalesce(r.distance_km,0)>0 then
      v_stage_density:=case when coalesce(r.elevation_m,0)>0 then r.elevation_m/r.distance_km else v_climb_density end;
      v_terrain_factor:=greatest(0.90,least(case when v_sport='running' then 1.35 else 1.22 end,1+((v_stage_density/nullif(v_climb_density,0))-1)*case when v_sport='running' then 0.24 else 0.18 end));
      v_fatigue_factor:=1+greatest(0,r.stage_number-1)*0.025;
      v_hours:=(r.distance_km/nullif(v_base_speed,0))*v_terrain_factor*v_fatigue_factor;
      v_duration:=greatest(30,round(v_hours*60));
      v_stage_carb:=case when v_race_carb is not null then greatest(0,least(120,v_race_carb)) when v_duration<150 then least(60,v_max_auto) else least(90,v_max_auto) end;
      v_total_carbs:=round((v_duration/60.0)*v_stage_carb);
      if v_sport='running' then
        v_mix:=0;
        v_gels:=greatest(0,ceil(v_total_carbs/40.0)::integer);
        v_equipment:='Running shoes, socks, race kit, vest/flasks if used, weather layers and any mandatory event kit. Match carried fluid to aid-station spacing.';
      else
        v_mix:=case when v_stage_carb>0 then greatest(1,ceil(v_duration::numeric/nullif(v_bottle_minutes,0))::integer) else 0 end;
        v_gels:=greatest(0,round(greatest(0,v_total_carbs-v_mix*60)/40.0)::integer);
        v_equipment:=coalesce(r.description,'Confirm bike, tyres, spares, tools and required equipment for this stage.');
      end if;
      v_boost:=case when v_use_boost and v_duration>=180 then least(v_gels,greatest(1,floor(v_duration/180.0)::integer)) else 0 end;
      v_regular:=greatest(0,v_gels-v_boost);
      v_pacing:='Estimate based on your recent '||coalesce(v_sport,'endurance')||' history (median '||to_char(v_base_speed,'FM999.0')||' km/h), stage climbing and cumulative fatigue. Start conservatively and protect the later stages.';
    else
      v_duration:=null;v_stage_carb:=coalesce(v_race_carb,0);v_mix:=0;v_total_carbs:=0;v_gels:=0;v_boost:=0;v_regular:=0;
      v_pacing:='Official stage date is loaded, but route distance/elevation is still awaiting organiser publication. Time, pacing and product quantities will calculate automatically when the official route is added.';
      v_equipment:=case when v_sport='running' then 'Confirm mandatory running kit, shoes, weather layers and hydration carrying requirements.' else coalesce(r.description,'Confirm equipment and spares for this stage.') end;
    end if;

    insert into public.race_stage_plans(user_id,race_goal_id,stage_number,stage_date,stage_name,distance_km,elevation_m,terrain,estimated_duration_minutes,start_location,finish_location,overnight_location,carb_target_gph,fluid_ml_per_hour,sodium_mg_per_hour,bottle_mix_sachets,regular_gels,boost_gels,hydrate_servings,recover_servings,pacing_notes,recovery_notes,equipment_notes,weather_notes,logistics_notes,updated_at)
    values(v_user,p_race_goal_id,r.stage_number,r.stage_date,r.stage_name,r.distance_km,r.elevation_m,r.terrain,v_duration,r.start_location,r.finish_location,r.overnight_location,v_stage_carb,v_fluid,v_sodium,v_mix,v_regular,v_boost,case when v_duration is null then 0 else 1 end,case when v_duration is null then 0 else 1 end,v_pacing,
      case when v_duration is null then 'Recovery plan will finalize with the official stage route.' else 'Refuel immediately after finishing, eat a substantial carbohydrate-rich meal, replace fluids and sodium, and prioritise sleep before the next stage.' end,
      v_equipment,'Update fluid target from the latest forecast and your own sweat-rate data before the stage.',concat_ws(' ',r.description,r.official_service_points_note),now())
    on conflict(user_id,race_goal_id,stage_number) do update set
      stage_date=excluded.stage_date,stage_name=excluded.stage_name,distance_km=excluded.distance_km,elevation_m=excluded.elevation_m,terrain=excluded.terrain,estimated_duration_minutes=excluded.estimated_duration_minutes,start_location=excluded.start_location,finish_location=excluded.finish_location,overnight_location=excluded.overnight_location,carb_target_gph=excluded.carb_target_gph,fluid_ml_per_hour=excluded.fluid_ml_per_hour,sodium_mg_per_hour=excluded.sodium_mg_per_hour,bottle_mix_sachets=excluded.bottle_mix_sachets,regular_gels=excluded.regular_gels,boost_gels=excluded.boost_gels,hydrate_servings=excluded.hydrate_servings,recover_servings=excluded.recover_servings,pacing_notes=excluded.pacing_notes,recovery_notes=excluded.recovery_notes,equipment_notes=excluded.equipment_notes,weather_notes=excluded.weather_notes,logistics_notes=excluded.logistics_notes,updated_at=now()
    returning id into v_stage_plan_id;

    for ap in select * from public.event_stage_aid_catalog where event_catalog_id=v_event and stage_number=r.stage_number order by point_number loop
      insert into public.race_stage_aid_points(user_id,race_goal_id,stage_id,point_number,name,distance_km,water_available,bottle_refill,food_available,tech_support,notes,updated_at)
      values(v_user,p_race_goal_id,v_stage_plan_id,ap.point_number,ap.name,ap.distance_km,ap.water_available,ap.bottle_refill,ap.food_available,ap.tech_support,ap.notes,now())
      on conflict(user_id,stage_id,point_number) do update set name=excluded.name,distance_km=excluded.distance_km,water_available=excluded.water_available,bottle_refill=excluded.bottle_refill,food_available=excluded.food_available,tech_support=excluded.tech_support,notes=excluded.notes,updated_at=now();
    end loop;
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$function$;
