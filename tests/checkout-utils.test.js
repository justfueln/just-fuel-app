import test from 'node:test';
import assert from 'node:assert/strict';
import {basketStats,buildWhatsAppOrderMessage,checkoutAnalytics,freeDeliveryState} from '../src/checkout-utils.js';

const basket=[
  {productTitle:'Bottle Mix',variantTitle:'Mixed Berry',price:21.8,quantity:2},
  {productTitle:'Energy Gel',variantTitle:'Boost',price:22,quantity:3}
];

test('basketStats totals quantity and value',()=>{
  assert.deepEqual(basketStats(basket),{itemCount:5,total:109.6});
});

test('freeDeliveryState reports remaining amount and unlock',()=>{
  assert.deepEqual(freeDeliveryState(550,600),{freeDelivery:false,remaining:50,progress:550/600*100});
  assert.deepEqual(freeDeliveryState(610,600),{freeDelivery:true,remaining:0,progress:100});
});

test('WhatsApp order message contains lines total and delivery',()=>{
  const text=buildWhatsAppOrderMessage(basket,109.6,600);
  assert.match(text,/Bottle Mix — Mixed Berry × 2/);
  assert.match(text,/Energy Gel — Boost × 3/);
  assert.match(text,/Order total:/);
  assert.match(text,/PUDO: R75 below R600/);
});

test('checkout analytics excludes product names and exposes only funnel metrics',()=>{
  assert.deepEqual(checkoutAnalytics(basket,109.6,600),{basket_items:5,basket_value:109.6,free_delivery:false});
});
