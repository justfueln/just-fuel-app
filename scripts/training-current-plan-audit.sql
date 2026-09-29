-- Production audit fix: when more than one plan is active, prefer the plan that
-- is actually in progress today. If none is in progress, use the nearest future
-- plan, then fall back to the most recent past plan. This prevents a newly generated
-- future plan from hiding completed training and the athlete's next workout.

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
  select p.id,p.user_id,p.target_weekly_hours,p.generated_at,p.start_date,p.race_date
  from training_plans p, me
  where p.user_id=me.user_id and p.status='active'
  order by
    case
      when p.start_date<=p_today and p.race_date>=p_today then 0
      when p.start_date>p_today then 1
      else 2
    end,
    case when p.start_date<=p_today and p.race_date>=p_today then p.race_date end asc,
    case when p.start_date>p_today then p.start_date end asc,
    p.generated_at desc
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
  order by
    case
      when p.start_date<=p_today and p.race_date>=p_today then 0
      when p.start_date>p_today then 1
      else 2
    end,
    case when p.start_date<=p_today and p.race_date>=p_today then p.race_date end asc,
    case when p.start_date>p_today then p.start_date end asc,
    p.generated_at desc
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

create or replace function public.get_training_fuel_forecast(p_user_id uuid)
returns table(user_id uuid, horizon_days integer, product_key text, product_name text, consumption_unit text, selling_unit text, pack_size integer, sort_order integer, required_units integer, quantity_on_hand integer, shortfall_units integer, cart_quantity integer, stock_remaining_without_order integer, projected_stock_after_order integer)
language sql
stable
set search_path to 'public'
as $function$
with active_plan as (
  select p.id
  from public.training_plans p
  where p.user_id=p_user_id and p.status='active'
  order by
    case
      when p.start_date<=current_date and p.race_date>=current_date then 0
      when p.start_date>current_date then 1
      else 2
    end,
    case when p.start_date<=current_date and p.race_date>=current_date then p.race_date end asc,
    case when p.start_date>current_date then p.start_date end asc,
    p.generated_at desc
  limit 1
), horizons(horizon_days) as (values (7),(14),(30)), products as (
  select product_key,product_name,consumption_unit,selling_unit,pack_size,sort_order from public.fuel_forecast_products
), active_sessions as (
  select f.session_date,
    coalesce(f.bottle_mix_sachets,0)::integer as bottle_mix,
    coalesce(f.regular_gels,0)::integer as energy_gel,
    coalesce(f.boost_gels,0)::integer as boost_gel,
    coalesce(f.hydrate_servings,0)::integer as hydrate,
    coalesce(f.recover_servings,0)::integer as recover
  from public.training_session_fuel_plan_multisport f
  join active_plan ap on ap.id=f.plan_id
  left join public.training_session_completion c on c.session_id=f.session_id
  where f.user_id=p_user_id
    and f.session_date>=current_date
    and f.session_type<>'race'
    and c.actual_activity_id is null
    and coalesce(f.status,'planned') not in ('completed','missed','cancelled')
), demand as (
  select h.horizon_days,v.product_key,sum(v.quantity)::integer as required_units
  from horizons h cross join active_sessions s
  cross join lateral (values
    ('bottle_mix'::text,s.bottle_mix),
    ('energy_gel'::text,s.energy_gel),
    ('boost_gel'::text,s.boost_gel),
    ('hydrate'::text,s.hydrate),
    ('recover'::text,s.recover)
  ) v(product_key,quantity)
  where s.session_date<=current_date+(h.horizon_days-1)
  group by h.horizon_days,v.product_key
), base as (
  select p_user_id as user_id,h.horizon_days,p.* from horizons h cross join products p
), joined as (
  select b.user_id,b.horizon_days,b.product_key,b.product_name,b.consumption_unit,b.selling_unit,b.pack_size,b.sort_order,
    coalesce(d.required_units,0)::integer as required_units,
    coalesce(i.quantity_on_hand,0)::integer as quantity_on_hand
  from base b
  left join demand d on d.horizon_days=b.horizon_days and d.product_key=b.product_key
  left join public.fuel_inventory i on i.user_id=b.user_id and i.product_key=b.product_key
)
select j.user_id,j.horizon_days,j.product_key,j.product_name,j.consumption_unit,j.selling_unit,j.pack_size,j.sort_order,j.required_units,j.quantity_on_hand,
  greatest(j.required_units-j.quantity_on_hand,0)::integer as shortfall_units,
  case when greatest(j.required_units-j.quantity_on_hand,0)=0 then 0 else ceil(greatest(j.required_units-j.quantity_on_hand,0)::numeric/greatest(j.pack_size,1))::integer end as cart_quantity,
  greatest(j.quantity_on_hand-j.required_units,0)::integer as stock_remaining_without_order,
  (j.quantity_on_hand+(case when greatest(j.required_units-j.quantity_on_hand,0)=0 then 0 else ceil(greatest(j.required_units-j.quantity_on_hand,0)::numeric/greatest(j.pack_size,1))::integer end)*j.pack_size-j.required_units)::integer as projected_stock_after_order
from joined j
order by j.horizon_days,j.sort_order
$function$;
