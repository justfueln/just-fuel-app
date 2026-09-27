import fs from 'node:fs';

const path='src/ShellNextV3.jsx';
let source=fs.readFileSync(path,'utf8');

if(source.includes("from './CommercePages'")){
  console.log('Commerce pages already extracted.');
  process.exit(0);
}

const learnStart=source.indexOf('const LEARN = [');
const learnEnd=source.indexOf('\n\nfunction localDateKey',learnStart);
const suggestedStart=source.indexOf('function suggestedCarbsPerHour(');
const suggestedEnd=source.indexOf('\n\nexport default function ShellNextV3',suggestedStart);
const fuelStart=source.indexOf('function FuelBuilder(');
const moreStart=source.indexOf('function MorePage(',fuelStart);

if([learnStart,learnEnd,suggestedStart,suggestedEnd,fuelStart,moreStart].some(x=>x<0)){
  throw new Error('Could not locate public-page extraction boundaries.');
}

const learnBlock=source.slice(learnStart,learnEnd).trim();
const suggestedBlock=source.slice(suggestedStart,suggestedEnd).trim();
const commerceBlock=source.slice(fuelStart,moreStart).trim();

const commerceFile=`import React, { useMemo, useState } from 'react';\nimport { Check, Minus, Plus, ShoppingBag } from 'lucide-react';\nimport { CATALOG, byKey, money } from './catalog';\n\n${learnBlock}\n\n${suggestedBlock}\n\n${commerceBlock}\n\nexport { FuelBuilder, ShopPage, LearnPage };\n`;
fs.writeFileSync('src/CommercePages.jsx',commerceFile);

source=source.slice(0,fuelStart)+source.slice(moreStart);
const importNeedle="import CheckoutDrawer from './CheckoutDrawer';";
if(!source.includes(importNeedle))throw new Error('CheckoutDrawer import not found');
source=source.replace(importNeedle,`${importNeedle}\nimport { FuelBuilder, ShopPage, LearnPage } from './CommercePages';`);

fs.writeFileSync(path,source);
