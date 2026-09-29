import {test,expect} from '@playwright/test';

const SUPABASE='https://ufolqntrfmvefpvrjnsa.supabase.co';
const USER_ID='11111111-1111-4111-8111-111111111111';

function fakeJwt(){
  const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  return `${enc({alg:'none',typ:'JWT'})}.${enc({sub:USER_ID,aud:'authenticated',role:'authenticated',email:'athlete@example.com',iat:now,exp:now+3600})}.e2e`;
}
function todayKey(){const d=new Date();const p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}

async function installSession(page){
  const token=fakeJwt();
  await page.addInitScript(({token,userId})=>{
    const now=Math.floor(Date.now()/1000);
    localStorage.setItem('sb-ufolqntrfmvefpvrjnsa-auth-token',JSON.stringify({access_token:token,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'e2e-refresh-token',user:{id:userId,aud:'authenticated',role:'authenticated',email:'athlete@example.com',app_metadata:{provider:'email',providers:['email']},user_metadata:{name:'Alex Athlete'},created_at:new Date().toISOString()}}));
  },{token,userId:USER_ID});
}
function json(route,data,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'content-range':'0-0/*'}})}

test('Phase 7 puts a short coaching recommendation before detailed data on Home',async({page})=>{
  await installSession(page);
  const today=todayKey();
  const dashboard={
    athlete_name:'Alex Athlete',strava_connected:true,target_weekly_hours:8,
    next_session:{title:'Tempo ride',date:today,duration_minutes:75,zone:'Z3',carbs_gph:60,is_key:true},
    next_race:{name:'Cape Test Race',date:'2026-10-20',days_to_race:21,priority:'A',distance_km:100},
    week:{completed_sessions:2,planned_sessions:4,planned_minutes:300},
    next7:{planned_sessions:4,planned_minutes:300},
    recent:{hours_7d:7.5,distance_km_7d:180,activities_7d:4}
  };

  await page.route(`${SUPABASE}/rest/v1/**`,route=>{
    const url=new URL(route.request().url());
    const parts=url.pathname.split('/').filter(Boolean);
    const name=parts.at(-1);
    if(parts.includes('rpc')){
      if(name==='get_today_dashboard')return json(route,dashboard);
      if(name==='get_training_fuel_forecast')return json(route,[]);
      return json(route,{ok:true});
    }
    if(name==='training_setup_status')return json(route,[{user_id:USER_ID,next_step:'ready',strava_connected:true,active_race_exists:true,event_name:'Cape Test Race'}]);
    if(name==='training_profiles')return json(route,[{user_id:USER_ID,primary_sport:'cycling',sports_enabled:['cycling'],date_of_birth:'1985-05-10',experience_level:'intermediate',available_weekdays:[2,4,6],long_session_weekday:6,weekday_session_minutes:90,long_session_max_minutes:300}]);
    if(name==='training_sport_profiles')return json(route,[{user_id:USER_ID,sport_family:'cycling',enabled:true,is_primary:true,preferred_intensity_source:'auto'}]);
    if(name==='training_readiness_checkins')return json(route,[]);
    return json(route,[]);
  });

  await page.goto('/?jfapp=16&legacy=cleared&e2e=smart-coach-phase7');
  await expect(page.getByText('JUST FUEL').first()).toBeVisible();
  const coach=page.locator('.today-coach-card');
  await expect(coach).toBeVisible();
  await expect(coach.getByText('COACH RECOMMENDATION',{exact:true})).toBeVisible();
  await expect(coach.getByRole('heading',{name:/Key session today: Tempo ride/i})).toBeVisible();
  await expect(coach.locator('.jf-smart-coach-reason')).toContainText(/next planned session|training information|race timing/i);
  await expect(coach.getByText('COACH SAYS',{exact:true})).toHaveCount(0);
  await expect(page.locator('.today-more-card')).toBeVisible();
});
