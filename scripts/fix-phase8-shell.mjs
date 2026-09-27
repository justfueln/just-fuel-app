import { execSync } from 'node:child_process';
import fs from 'node:fs';

const main=execSync('git show origin/main:src/ShellNextV3.jsx',{encoding:'utf8'});
const componentStart=main.indexOf('export default function ShellNextV3()');
const appHeaderStart=main.indexOf('function AppHeader(');
const bannerStart=main.indexOf('function ReminderBanner(');
if([componentStart,appHeaderStart,bannerStart].some(x=>x<0))throw new Error('Could not locate shell boundaries in main');

let component=main.slice(componentStart,appHeaderStart);
component=component.replace("  const [reminder,setReminder]=useState(loadReminder);\n  const [reminderDue,setReminderDue]=useState(false);\n", "  const {reminder,setReminder,reminderDue,requestReminderPermission,dismissReminder}=useWeeklyReminder();\n");
const reminderEffectStart=component.indexOf("  useEffect(()=>{\n    localStorage.setItem(REMINDER_KEY");
const installEffectStart=component.indexOf("\n\n  useEffect(()=>{\n    const standalone",reminderEffectStart);
if(reminderEffectStart<0||installEffectStart<0)throw new Error('Reminder effect boundaries not found');
component=component.slice(0,reminderEffectStart)+component.slice(installEffectStart+2);
const permissionStart=component.indexOf('  async function requestReminderPermission()');
const installStart=component.indexOf('  async function installApp()',permissionStart);
if(permissionStart<0||installStart<0)throw new Error('Reminder permission function boundaries not found');
component=component.slice(0,permissionStart)+component.slice(installStart);
component=component.replace("  function dismissReminder(){setReminder(r=>({...r,lastShown:localDateKey()}));setReminderDue(false)}\n",'');

const appHeader=main.slice(appHeaderStart,bannerStart).trimEnd();
const header=`import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BookOpen, Calculator, MoreHorizontal, ShoppingBag, Store, Truck } from 'lucide-react';
import TrainingApp from './App';
import CheckoutDrawer from './CheckoutDrawer';
import MorePage, { ReminderBanner } from './MorePage';
import useWeeklyReminder from './useWeeklyReminder';
import { FuelBuilder, ShopPage, LearnPage } from './CommercePages';
import { basketTtlMs, lastBasketTtlMs, normalizeMainSection, readSavedItems } from './app-state-utils';

const NAV = [
  ['Plan', Calculator], ['Learn', BookOpen], ['Shop', Store], ['Training', Activity], ['More', MoreHorizontal]
];
const BASKET_KEY = 'just-fuel-basket-v3';
const LAST_BASKET_KEY = 'just-fuel-last-basket-v1';
const BASKET_TTL = basketTtlMs;
const LAST_BASKET_TTL = lastBasketTtlMs;
const LAST_SECTION_KEY = 'just-fuel-last-section';

function loadBasket(){
  try{const raw=localStorage.getItem(BASKET_KEY);const items=readSavedItems(raw,BASKET_TTL);if(raw&&!items.length)localStorage.removeItem(BASKET_KEY);return items}catch{return[]}
}
function loadLastBasket(){
  try{const raw=localStorage.getItem(LAST_BASKET_KEY);const items=readSavedItems(raw,LAST_BASKET_TTL);if(raw&&!items.length)localStorage.removeItem(LAST_BASKET_KEY);return items}catch{return[]}
}

`;
fs.writeFileSync('src/ShellNextV3.jsx',header+component+appHeader+'\n');
