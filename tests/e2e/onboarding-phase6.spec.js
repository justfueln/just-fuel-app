import {test,expect} from '@playwright/test';

const SUPABASE='https://ufolqntrfmvefpvrjnsa.supabase.co';
const USER_ID='11111111-1111-4111-8111-111111111111';

function fakeJwt(){
  const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  return `${enc({alg:'none',typ:'JWT'})}.${enc({sub:USER_ID,aud:'authenticated',role:'authenticated',email:'newathlete@example.com',iat:now,exp:now+3600})}.e2e`;
}

async function installSession(page){
  const token=fakeJwt();
  await page.addInitScript(({token,userId})=>{
    const now=Math.floor(Date.now()/1000);
    localStorage.setItem('sb-ufolqntrfmvefpvrjnsa-auth-token',JSON.stringify({access_token:token,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'e2e-refresh-token',user:{id:userId,aud:'authenticated',role:'authenticated',email:'newathlete@example.com',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()}}));
  },{token,userId:USER_ID});
}
function json(route,data,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'content-range':'0-0/*'}})}

test('Phase 6 gives a new athlete a short setup flow and keeps advanced metrics optional',async({page})=>{
  await installSession(page);
  let profile=null;

  await page.route(`${SUPABASE}/rest/v1/**`,async route=>{
    const request=route.request(),url=new URL(request.url()),parts=url.pathname.split('/').filter(Boolean),name=parts.at(-1);
    if(parts.includes('rpc'))return json(route,{ok:true});
    if(name==='training_setup_status')return json(route,[{user_id:USER_ID,strava_connected:false,active_race_exists:false,next_step:'connect_strava'}]);
    if(name==='training_profiles'){
      if(request.method()==='GET')return json(route,profile?[profile]:[]);
      const body=request.postDataJSON?.()||{};
      const next=Array.isArray(body)?body[0]:body;
      profile={...profile,...next,user_id:USER_ID};
      return json(route,[],201);
    }
    if(name==='training_sport_profiles')return json(route,request.method()==='GET'?[]:[],request.method()==='GET'?200:201);
    return json(route,[]);
  });

  await page.goto('/?jfapp=16&legacy=cleared&e2e=onboarding-phase6');
  const dialog=page.getByRole('dialog',{name:'Athlete setup'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'When were you born?'})).toBeVisible();
  await expect(dialog.getByText(/FTP, threshold pace, heart rate and weight are optional/i)).toBeVisible();

  await dialog.getByLabel('Date of birth').fill('1985-05-10');
  await dialog.getByRole('button',{name:'Continue'}).click();
  await expect(dialog.getByRole('heading',{name:'What do you mainly train for?'})).toBeVisible();
  await dialog.getByRole('button',{name:'Running'}).click();
  await dialog.getByRole('button',{name:'Continue'}).click();
  await expect(dialog.getByRole('heading',{name:'Where are you now?'})).toBeVisible();
  await dialog.getByRole('button',{name:'Beginner'}).click();
  await dialog.getByRole('button',{name:'Continue'}).click();
  await expect(dialog.getByRole('heading',{name:'Which days can you normally train?'})).toBeVisible();
  await dialog.getByRole('button',{name:'Continue'}).click();
  await expect(dialog.getByRole('heading',{name:'Best day for your longest session?'})).toBeVisible();
  await dialog.getByRole('button',{name:'Sat'}).click();
  await dialog.getByRole('button',{name:'Continue'}).click();

  await expect(dialog.getByRole('heading',{name:'Connect Strava'})).toBeVisible();
  expect(profile?.date_of_birth).toBe('1985-05-10');
  expect(profile?.primary_sport).toBe('running');
  expect(profile?.experience_level).toBe('beginner');
  expect(profile?.available_weekdays).toEqual([2,4,6]);
  expect(profile?.long_session_weekday).toBe(6);
  expect(profile?.ftp_w).toBeUndefined();

  await dialog.getByRole('button',{name:'Finish later'}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button',{name:/Finish athlete setup/i})).toBeVisible();
});
