import { useEffect, useState } from 'react';
import { REMINDER_KEY, loadReminder, localDateKey, reminderDueNow } from './reminder-utils';

export default function useWeeklyReminder(){
  const[reminder,setReminder]=useState(loadReminder);
  const[reminderDue,setReminderDue]=useState(false);

  useEffect(()=>{
    localStorage.setItem(REMINDER_KEY,JSON.stringify(reminder));
    const check=()=>{
      const due=reminderDueNow(reminder);
      setReminderDue(due);
      if(due&&reminder.lastNotified!==localDateKey()&&'Notification'in window&&Notification.permission==='granted'&&'serviceWorker'in navigator){
        navigator.serviceWorker.ready.then(reg=>reg.showNotification('Just Fuel weekly fuel check',{body:'Check your fuel cupboard and plan what you need for the week.',tag:'just-fuel-weekly'}))
          .then(()=>setReminder(r=>({...r,lastNotified:localDateKey()}))).catch(()=>{});
      }
    };
    check();
    const timer=setInterval(check,30000);
    return()=>clearInterval(timer);
  },[reminder.enabled,reminder.day,reminder.time,reminder.lastShown,reminder.lastNotified]);

  async function requestReminderPermission(){
    if(!('Notification'in window))return'unsupported';
    if(Notification.permission==='default'){
      try{return await Notification.requestPermission()}catch{return'denied'}
    }
    return Notification.permission;
  }

  function dismissReminder(){
    setReminder(r=>({...r,lastShown:localDateKey()}));
    setReminderDue(false);
  }

  return{reminder,setReminder,reminderDue,requestReminderPermission,dismissReminder};
}
