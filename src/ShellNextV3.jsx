import React, { useEffect, useMemo, useState } from 'react';
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
function AppHeader({count,onBasket}){
  return <><div className="delivery-banner"><Truck size={18}/>PUDO delivery: R75 · Free over R600</div><header className="shell-header"><div className="jf-logo"><div><b>JUST</b><strong>FUEL</strong></div><small>ENDURANCE NUTRITION</small></div><button className="bag-button" onClick={onBasket} aria-label="Open basket"><ShoppingBag size={25}/><span className="bag-count">{count}</span></button></header></>
}
