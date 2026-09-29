export const ONBOARDING_STEPS=['dob','sport','experience','days','long_day','strava','race'];
export const ONBOARDING_SPORTS=['cycling','running','triathlon','hyrox'];

export function profileSport(profile){
  const primary=String(profile?.primary_sport||'').toLowerCase();
  if(ONBOARDING_SPORTS.includes(primary))return primary;
  const enabled=Array.isArray(profile?.sports_enabled)?profile.sports_enabled:[];
  return enabled.find(s=>ONBOARDING_SPORTS.includes(String(s).toLowerCase()))||'';
}

export function selectedTrainingDays(profile){
  return Array.isArray(profile?.available_weekdays)
    ? profile.available_weekdays.map(Number).filter(d=>d>=1&&d<=7).sort((a,b)=>a-b)
    : [];
}

export function coreProfileComplete(profile){
  const days=selectedTrainingDays(profile);
  const longDay=Number(profile?.long_session_weekday||0);
  return Boolean(
    profile?.date_of_birth&&
    profileSport(profile)&&
    profile?.experience_level&&
    days.length>=2&&
    days.includes(longDay)
  );
}

export function nextOnboardingStep({profile,stravaConnected=false}={}){
  if(!profile?.date_of_birth)return'dob';
  if(!profileSport(profile))return'sport';
  if(!profile?.experience_level)return'experience';
  const days=selectedTrainingDays(profile);
  if(days.length<2)return'days';
  if(!days.includes(Number(profile?.long_session_weekday||0)))return'long_day';
  if(!stravaConnected)return'strava';
  return'race';
}

export function enabledFamiliesForSport(sport){
  const family=String(sport||'').toLowerCase();
  if(family==='triathlon')return new Set(['cycling','running','swimming']);
  if(family==='hyrox')return new Set(['hyrox','running']);
  if(family==='running')return new Set(['running']);
  return new Set(['cycling']);
}

export function primaryFamilyForSport(sport){
  const family=String(sport||'').toLowerCase();
  if(family==='triathlon')return'cycling';
  if(family==='hyrox')return'hyrox';
  if(family==='running')return'running';
  return'cycling';
}
