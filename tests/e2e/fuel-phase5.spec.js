import {test,expect} from '@playwright/test';

const SUPABASE='https://ufolqntrfmvefpvrjnsa.supabase.co';
const USER_ID='11111111-1111-4111-8111-111111111111';
const RACE_ID='33333333-3333-4333-8333-333333333333';

function fakeJwt(){
  const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  return `${enc({alg:'none',typ:'JWT'})}.${enc({sub:USER_ID,aud:'authenticated',role:'authenticated',email:'athlete@example.com',iat:now,exp:now+3600})}.e2e`;
}
function dateOffset(days){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
async function installSession(page){
  const token=fakeJwt();
  await page.addInitScript(({token,userId})=>{
    const now=Math.floor(Date.now()/1000);
    localStorage.setItem('sb-ufolqntrfmvefpvrjnsa-auth-token',JSON.stringify({access_token:token,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'e2e-refresh-token',user:{id:userId,aud:'authenticated',role:'authenticated',email:'athlete@example.com',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()}}));
  },{token,userId:USER_ID});
}
function json(route,data,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'content-range':'0-0/*'}})}

test('Fuel Phase 5 answers what the athlete needs before exposing detailed tools',async({page})=>{
  await installSession(page);
  const tomorrow=dateOffset(1),raceDate=dateOffset(20);
  const forecast=[
    {horizon_days:7,product_key:'bottle_mix',required_units:4,quantity_on_hand:2,shortfall_units:2},
    {horizon_days:7,product_key:'energy_gel',required_units:6,quantity_on_hand:10,shortfall_units:0},
    {horizon_days:7,product_key:'boost_gel',required_units:2,quantity_on_hand:1,shortfall_units:1},
    {horizon_days:7,product_key:'hydrate',required_units:8,quantity_on_hand:5,shortfall_units:3},
    {horizon_days:7,product_key:'recover',required_units:2,quantity_on_hand:0,shortfall_units:2}
  ];
  const stock=forecast.map(row=>({user_id:USER_ID,product_key:row.product_key,quantity_on_hand:row.quantity_on_hand}));
  const training=[{session_id:'session-1',plan_id:'plan-1',session_date:tomorrow,sport_type:'cycling',title:'Endurance ride',duration_minutes:120,status:'planned',carb_target_gph:60,bottle_mix_sachets:2,regular_gels:2,boost_gels:1,hydrate_servings:2,recover_servings:1,hydration_ml_per_hour:600,sodium_target_mg_per_hour:900,fuel_delivery_mode:'bottle_first'}];

  await page.route(`${SUPABASE}/rest/v1/**`,route=>{
    const url=new URL(route.request().url()),parts=url.pathname.split('/').filter(Boolean),name=parts.at(-1);
    if(parts.includes('rpc')){
      if(name==='get_training_fuel_forecast')return json(route,forecast);
      if(name==='get_today_dashboard')return json(route,{});
      return json(route,{});
    }
    if(name==='training_plans')return json(route,[{id:'plan-1'}]);
    if(name==='training_session_fuel_plan_multisport')return json(route,training);
    if(name==='fuel_inventory')return json(route,stock);
    if(name==='training_fueling_profiles')return json(route,[{user_id:USER_ID,carb_strategy:'auto'}]);
    if(name==='athlete_season_events')return json(route,[{race_goal_id:RACE_ID,user_id:USER_ID,event_name:'Cape Town Test Race',event_date:raceDate,goal_time_minutes:240,status:'active'}]);
    if(name==='race_fuel_plan')return json(route,[{race_goal_id:RACE_ID,carb_target_gph:90,race_duration_minutes:240,carb_target_g_total:360,hydration_ml_per_hour:650,sodium_target_mg_per_hour:900,bottle_mix_sachets:4,regular_gels:3,boost_gels:1,post_race_recover_servings:1}]);
    if(name==='training_setup_status')return json(route,[{user_id:USER_ID,next_step:'ready',strava_connected:true}]);
    if(name==='training_profiles')return json(route,[{user_id:USER_ID,primary_sport:'cycling',sports_enabled:['cycling'],date_of_birth:'1985-05-10',experience_level:'intermediate',available_weekdays:[2,4,6],long_session_weekday:6,weekday_session_minutes:90,long_session_max_minutes:300}]);
    if(name==='training_sport_profiles')return json(route,[{user_id:USER_ID,sport_family:'cycling',enabled:true,is_primary:true,preferred_intensity_source:'auto'}]);
    return json(route,[]);
  });

  await page.goto('/?jfapp=16&legacy=cleared&e2e=fuel-phase5');
  await expect(page.getByText('JUST FUEL').first()).toBeVisible();
  await page.getByRole('button',{name:'Fuel',exact:true}).click();

  await expect(page.getByRole('heading',{name:'What do I need?'})).toBeVisible();
  const trainingCard=page.locator('.fuel-v3-need-card');
  await expect(trainingCard.getByText('UPCOMING TRAINING')).toBeVisible();
  await expect(trainingCard.getByText(/Endurance ride/)).toBeVisible();
  await expect(trainingCard.getByText('2',{exact:true}).first()).toBeVisible();

  const raceCard=page.locator('.fuel-v3-race-card');
  await expect(raceCard.getByText('Cape Town Test Race')).toBeVisible();
  await expect(raceCard.getByText('90',{exact:true})).toBeVisible();
  await expect(raceCard.getByText('4',{exact:true}).first()).toBeVisible();

  const stockCard=page.locator('.fuel-v3-stock-card');
  await expect(stockCard.getByText(/You are short/)).toBeVisible();
  await expect(stockCard.getByText(/2 short/).first()).toBeVisible();
  await expect(stockCard.getByRole('button',{name:/See exact order shortage/i})).toBeVisible();

  const actions=page.getByRole('region',{name:'Fuel actions'});
  await expect(actions.getByRole('button',{name:/Plan Fuel/i})).toBeVisible();
  await actions.getByRole('button',{name:/Update Stock/i}).click();
  await expect(page.getByText('Update Stock',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Save My Stock/i})).toBeVisible();
});