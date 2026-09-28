import { test, expect } from '@playwright/test';

const SUPABASE='https://ufolqntrfmvefpvrjnsa.supabase.co';
const USER_ID='11111111-1111-4111-8111-111111111111';

function fakeJwt(){
  const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  return `${enc({alg:'none',typ:'JWT'})}.${enc({sub:USER_ID,aud:'authenticated',role:'authenticated',email:'athlete@example.com',iat:now,exp:now+3600})}.e2e`;
}

async function installSession(page){
  const token=fakeJwt();
  await page.addInitScript(({token,userId})=>{
    const now=Math.floor(Date.now()/1000);
    localStorage.setItem('sb-ufolqntrfmvefpvrjnsa-auth-token',JSON.stringify({
      access_token:token,
      token_type:'bearer',
      expires_in:3600,
      expires_at:now+3600,
      refresh_token:'e2e-refresh-token',
      user:{
        id:userId,
        aud:'authenticated',
        role:'authenticated',
        email:'athlete@example.com',
        app_metadata:{provider:'email',providers:['email']},
        user_metadata:{},
        created_at:new Date().toISOString()
      }
    }));
  },{token,userId:USER_ID});
}

function json(route,data,status=200){
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'content-range':'0-0/*'}});
}

test('signed-in athlete keeps session and can run repeated Strava sync flow', async ({ page }) => {
  await installSession(page);

  await page.route(`${SUPABASE}/rest/v1/**`,route=>{
    const url=new URL(route.request().url());
    const parts=url.pathname.split('/').filter(Boolean);
    const name=parts.at(-1);
    if(parts.includes('rpc')){
      if(name==='refresh_training_sport_detection')return json(route,{ok:true,algorithm_version:'sport-detection-v1'});
      if(name==='refresh_training_plan_adaptation')return json(route,{ok:true,changed_sessions:2,algorithm_version:'adaptive-coach-v5-sport-aware'});
      if(name==='refresh_training_progression')return json(route,{ok:true,sessions_checked:2,algorithm_version:'training-progression-v4-sport-aware'});
      if(name==='refresh_training_session_targets')return json(route,{ok:true,updated_sessions:2,algorithm_version:'session-target-resolver-v2'});
      return json(route,{ok:true});
    }
    if(name==='training_setup_status')return json(route,[{user_id:USER_ID,next_step:'ready',strava_connected:true}]);
    if(name==='training_profiles')return json(route,[{user_id:USER_ID,primary_sport:'cycling',available_weekdays:[2,4,6],long_session_weekday:6}]);
    if(name==='training_sport_profiles')return json(route,[]);
    return json(route,[]);
  });

  await page.route(`${SUPABASE}/functions/v1/strava-sync`,route=>json(route,{ok:true}));

  await page.goto('/?jfapp=16&legacy=cleared&e2e=auth-strava');
  await expect(page.getByText('JUST FUEL').first()).toBeVisible();

  await page.getByRole('button',{name:'Profile and settings'}).click();
  await expect(page.getByText('athlete@example.com')).toBeVisible();
  await page.getByRole('button',{name:/Strava & Connections/i}).click();
  await expect(page.getByRole('heading',{name:'Connected'})).toBeVisible();

  await page.getByRole('button',{name:'Sync now'}).click();
  await expect(page.getByText(/Strava synced · 2 upcoming sessions checked or adjusted\./i)).toBeVisible();

  // A fresh app navigation must reuse the persisted Supabase session instead of asking for OTP again.
  await page.goto('/?jfapp=16&legacy=cleared&e2e=session-reload');
  await expect(page.getByText('JUST FUEL').first()).toBeVisible();
  await page.getByRole('button',{name:'Profile and settings'}).click();
  await expect(page.getByText('athlete@example.com')).toBeVisible();
});
