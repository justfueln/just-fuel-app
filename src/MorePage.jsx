import React, { useState } from 'react';
import { Bell, CalendarPlus, Check, ChevronRight, Clock, Download, Info, X } from 'lucide-react';
import { SHOP_DOMAIN, WHATSAPP_NUMBER } from './catalog';
import { DAY_NAMES, REMINDER_DEFAULT, buildReminderIcs, nextReminderLabel } from './reminder-utils';

export function ReminderBanner({reminder,onPlan,onDismiss}){
  return <div className="weekly-reminder"><Bell size={19}/><div><b>Weekly fuel check</b><span>{DAY_NAMES[Number(reminder.day)]} at {reminder.time} · check your cupboard and plan the week.</span></div><button onClick={onPlan}>Plan fuel</button><button className="reminder-x" onClick={onDismiss}><X size={18}/></button></div>
}

export default function MorePage({reminder,setReminder,requestReminderPermission,installed,installPrompt,installApp}){
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const[message,setMessage]=useState('');

  async function testReminder(){
    const permission=await requestReminderPermission();
    if(permission==='granted'&&'serviceWorker'in navigator){
      try{
        const reg=await navigator.serviceWorker.ready;
        await reg.showNotification('Just Fuel reminder test',{body:'Your weekly fuel reminder is working.',tag:'just-fuel-test'});
        setMessage('Test reminder sent.');
      }catch{setMessage('Could not send the test notification on this browser.')}
    }else if(permission==='denied')setMessage('Notifications are blocked in your browser settings.');
    else setMessage('Use the phone calendar option for a reliable closed-app reminder.');
  }

  function addToCalendar(){
    const ics=buildReminderIcs(reminder);
    const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='just-fuel-weekly-reminder.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setMessage('Calendar reminder created. Open the downloaded file and add it to your calendar.');
  }

  function toggle(){
    const next=!reminder.enabled;
    setReminder(r=>({...REMINDER_DEFAULT,...r,enabled:next,lastShown:'',lastNotified:''}));
    if(next)requestReminderPermission();
  }

  return <main className="public-page more-page"><div className="page-kicker">JUST FUEL</div><h1>More</h1>
    <section className="settings-card reminder-card-v2"><div className="settings-title"><Bell size={21}/><div><h3>Weekly fuel reminder</h3><p>Choose exactly when you want to check your fuel.</p></div><button className={`toggle ${reminder.enabled?'on':''}`} onClick={toggle}><span/></button></div>{reminder.enabled&&<><div className="reminder-controls-v2"><label><span>Day</span><select value={reminder.day} onChange={e=>setReminder(r=>({...r,day:Number(e.target.value),lastShown:'',lastNotified:''}))}>{DAY_NAMES.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label><label><span>Time</span><div className="time-input-wrap"><Clock size={18}/><input type="time" value={reminder.time||'18:00'} onChange={e=>setReminder(r=>({...r,time:e.target.value||'18:00',lastShown:'',lastNotified:''}))}/></div></label></div><div className="reminder-summary-v2"><b>Every {DAY_NAMES[Number(reminder.day)]} at {reminder.time||'18:00'}</b><span>Next: {nextReminderLabel(reminder)}</span></div><div className="reminder-actions-v2"><button onClick={testReminder}><Bell size={17}/>Test now</button><button onClick={addToCalendar}><CalendarPlus size={17}/>Add to calendar</button></div>{message&&<div className="reminder-message-v2">{message}</div>}</>}<small>For a reliable alert while the app is closed, use the phone calendar option.</small></section>
    <section className="settings-card"><div className="settings-title"><Download size={21}/><div><h3>Install Just Fuel</h3><p>Keep the app on your home screen.</p></div></div>{installed?<div className="installed-row"><Check size={18}/>Installed</div>:installPrompt?<button className="install-button" onClick={installApp}>Install app</button>:ios?<div className="ios-steps"><b>iPhone / iPad</b><span>Safari → Share → Add to Home Screen.</span></div>:<div className="ios-steps"><b>Android</b><span>Chrome menu → Add to Home screen / Install app.</span></div>}</section>
    <div className="more-links"><a href={SHOP_DOMAIN} target="_blank" rel="noreferrer"><div><h3>Just Fuel website</h3><p>Product and company information.</p></div><ChevronRight/></a><a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer"><div><h3>WhatsApp us</h3><p>Orders and fueling help.</p></div><ChevronRight/></a></div>
    <div className="app-note"><Info size={18}/><span>Plan and Shop work without a Training login. Sign in under Training for Strava, race and training features.</span></div>
  </main>
}
