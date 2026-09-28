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

test('signed-in athlete can open Strava connections and run a sync', async ({ page }) => {
  await installSession(page);

  await page.route(`${SUPABASE}/rest/v1/**`,route=>{
    const url=new URL(route.request().url());
    const table=url.pathname.split('/').pop();
    if(table==='training_setup_status')return json(route,[{user_id:USER_ID,next_step:'ready',strava_connected:true}]);
    if(table==='training_profiles')return json(route,[{user_id:USER_ID,primary_sport:'cycling',available_weekdays:[2,4,6],long_session_weekday:6}]);
    return json(route,[]);
  });

  await page.route(`${SUPABASE}/functions/v1/strava-sync`,route=>json(route,{ok:true,plan_adaptation:{changed_sessions:2}}));

  await page.goto('/?jfapp=16&legacy=cleared&e2e=auth-strava');
  await expect(page.getByText('JUST FUEL').first()).toBeVisible();

  await page.getByRole('button',{name:'Profile and settings'}).click();
  await expect(page.getByText('athlete@example.com')).toBeVisible();
  await page.getByRole('button',{name:/Strava & Connections/i}).click();
  await expect(page.getByRole('heading',{name:'Connected'})).toBeVisible();

  await page.getByRole('button',{name:'Sync now'}).click();
  await expect(page.getByText(/Strava synced · 2 upcoming sessions checked or adjusted\./i)).toBeVisible();
});
