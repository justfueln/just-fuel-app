import {test,expect} from '@playwright/test';

const SUPABASE='https://ufolqntrfmvefpvrjnsa.supabase.co';
const USER_ID='11111111-1111-4111-8111-111111111111';
const RACE_ID='22222222-2222-4222-8222-222222222222';

function fakeJwt(){
  const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  return `${enc({alg:'none',typ:'JWT'})}.${enc({sub:USER_ID,aud:'authenticated',role:'authenticated',email:'athlete@example.com',iat:now,exp:now+3600})}.e2e`;
}

async function installSession(page){
  const token=fakeJwt();
  await page.addInitScript(({token,userId})=>{
    const now=Math.floor(Date.now()/1000);
    localStorage.setItem('sb-ufolqntrfmvefpvrjnsa-auth-token',JSON.stringify({access_token:token,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'e2e-refresh-token',user:{id:userId,aud:'authenticated',role:'authenticated',email:'athlete@example.com',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()}}));
  },{token,userId:USER_ID});
}

function json(route,data,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'content-range':'0-0/*'}})}

test('Race Phase 4 opens dashboard then keeps plan fuel checklist as primary actions',async({page})=>{
  await installSession(page);
  const race={race_goal_id:RACE_ID,user_id:USER_ID,event_name:'Cape Town Test Race',event_date:'2026-10-18',days_to_event:20,priority:'A',distance_km:100,elevation_m:1200,goal_time_minutes:240,event_type:'road_cycling',sport_type:'cycling',stage_count:1,status:'active'};

  await page.route(`${SUPABASE}/rest/v1/**`,route=>{
    const url=new URL(route.request().url()),parts=url.pathname.split('/').filter(Boolean),name=parts.at(-1);
    if(parts.includes('rpc')){
      if(name==='get_today_dashboard')return json(route,{});
      if(name==='get_race_goal_progress')return json(route,{races:[{race_goal_id:RACE_ID,event_name:race.event_name,score:81,status:'On track',confidence:'medium',coach_priority:'race_specificity',coach_priority_copy:'Keep the final key sessions specific to race demands.'}]});
      if(name==='get_training_readiness_insights')return json(route,{summary:{avg_7d:82,trend:'steady',checkins_28d:12},history:[],patterns:[]});
      return json(route,{ok:true});
    }
    if(name==='athlete_season_events')return json(route,[race]);
    if(name==='race_stage_plans')return json(route,[]);
    if(name==='race_fuel_plan')return json(route,[{race_goal_id:RACE_ID,carb_target_gph:90,race_duration_minutes:240,carb_target_g_total:360,hydration_ml_per_hour:600,sodium_target_mg_per_hour:900,bottle_mix_sachets:4,regular_gels:3,boost_gels:1,post_race_recover_servings:1}]);
    if(name==='race_fuel_timeline')return json(route,[]);
    if(name==='training_readiness_checkins')return json(route,[]);
    if(name==='training_setup_status')return json(route,[{user_id:USER_ID,next_step:'ready',strava_connected:true,active_race_exists:true,event_name:race.event_name}]);
    if(name==='training_profiles')return json(route,[{user_id:USER_ID,primary_sport:'cycling',sports_enabled:['cycling'],date_of_birth:'1985-05-10',experience_level:'intermediate',available_weekdays:[2,4,6],long_session_weekday:6,weekday_session_minutes:90,long_session_max_minutes:300}]);
    if(name==='training_sport_profiles')return json(route,[{user_id:USER_ID,sport_family:'cycling',enabled:true,is_primary:true,preferred_intensity_source:'auto'}]);
    return json(route,[]);
  });

  await page.goto('/?jfapp=16&legacy=cleared&e2e=race-phase4');
  await expect(page.getByText('JUST FUEL').first()).toBeVisible();
  await page.getByRole('button',{name:'Race',exact:true}).click();
  await expect(page.getByRole('heading',{name:'My Races'})).toBeVisible();
  await page.getByRole('button',{name:/Cape Town Test Race/}).first().click();

  const raceNav=page.getByRole('navigation',{name:'Race sections'});
  const dashboard=page.locator('.race-phase4-intelligence');
  await expect(page.getByText('RACE DASHBOARD',{exact:true})).toBeVisible();
  await expect(raceNav.getByRole('button',{name:'Race Plan',exact:true})).toBeVisible();
  await expect(raceNav.getByRole('button',{name:'Fuel',exact:true})).toBeVisible();
  await expect(raceNav.getByRole('button',{name:'Checklist',exact:true})).toBeVisible();
  await expect(dashboard.getByText('81/100',{exact:true})).toBeVisible();
  await expect(dashboard.getByText('82/100',{exact:true})).toBeVisible();
  await expect(dashboard.getByText(/25\.0 km\/h/)).toBeVisible();

  await raceNav.getByRole('button',{name:'Race Plan',exact:true}).click();
  await expect(page.getByText('RACE PLAN',{exact:true})).toBeVisible();
  await expect(page.getByText(/Course execution, pacing, stages and water points live together here/)).toBeVisible();
  await expect(page.locator('.race-v2-menu')).toBeHidden();
});