export const REMINDER_KEY='just-fuel-weekly-reminder';
export const DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const DAY_CODES=['SU','MO','TU','WE','TH','FR','SA'];
export const REMINDER_DEFAULT={enabled:false,day:0,time:'18:00',lastShown:'',lastNotified:''};

export function localDateKey(date=new Date()){
  const p=n=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}`;
}

export function loadReminder(storage=globalThis.localStorage){
  try{return {...REMINDER_DEFAULT,...(JSON.parse(storage?.getItem?.(REMINDER_KEY)||'null')||{})}}
  catch{return {...REMINDER_DEFAULT}}
}

export function timeParts(value='18:00'){
  const [h,m]=String(value||'18:00').split(':').map(Number);
  return {h:Number.isFinite(h)?h:18,m:Number.isFinite(m)?m:0};
}

export function nextReminderDate(reminder,now=new Date()){
  const {h,m}=timeParts(reminder?.time);
  const result=new Date(now);
  result.setHours(h,m,0,0);
  let delta=(Number(reminder?.day)-now.getDay()+7)%7;
  if(delta===0&&result<=now)delta=7;
  result.setDate(now.getDate()+delta);
  return result;
}

export function nextReminderLabel(reminder,now=new Date()){
  return new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(nextReminderDate(reminder,now));
}

export function reminderDueNow(reminder,now=new Date()){
  if(!reminder?.enabled||reminder.lastShown===localDateKey(now))return false;
  if(now.getDay()!==Number(reminder.day))return false;
  const {h,m}=timeParts(reminder.time);
  return (now.getHours()*60+now.getMinutes())>=(h*60+m);
}

export function icsStamp(date){
  const p=n=>String(n).padStart(2,'0');
  return `${date.getFullYear()}${p(date.getMonth()+1)}${p(date.getDate())}T${p(date.getHours())}${p(date.getMinutes())}00`;
}

export function buildReminderIcs(reminder,now=new Date()){
  const start=nextReminderDate(reminder,now);
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Just Fuel//Weekly Fuel Reminder//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:just-fuel-weekly-${Date.now()}@justfuelnutrition.co.za`,`DTSTART:${icsStamp(start)}`,`RRULE:FREQ=WEEKLY;BYDAY=${DAY_CODES[Number(reminder.day)]}`,'SUMMARY:Just Fuel weekly fuel check','DESCRIPTION:Check your fuel cupboard and plan what you need for the week.','BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Just Fuel weekly fuel check','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
}
