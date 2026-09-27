import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReminderIcs, nextReminderDate, reminderDueNow } from '../src/reminder-utils.js';

test('next reminder rolls to next week after the selected time',()=>{
  const now=new Date(2026,8,27,19,0,0);
  const next=nextReminderDate({day:0,time:'18:00'},now);
  assert.equal(next.getDate(),4);
  assert.equal(next.getMonth(),9);
  assert.equal(next.getHours(),18);
});

test('reminder is due only on configured day after configured time',()=>{
  const reminder={enabled:true,day:0,time:'18:00',lastShown:''};
  assert.equal(reminderDueNow(reminder,new Date(2026,8,27,17,59,0)),false);
  assert.equal(reminderDueNow(reminder,new Date(2026,8,27,18,0,0)),true);
  assert.equal(reminderDueNow(reminder,new Date(2026,8,28,18,0,0)),false);
});

test('calendar export contains weekly recurrence and reminder',()=>{
  const ics=buildReminderIcs({day:4,time:'17:00'},new Date(2026,8,27,8,0,0));
  assert.match(ics,/RRULE:FREQ=WEEKLY;BYDAY=TH/);
  assert.match(ics,/SUMMARY:Just Fuel weekly fuel check/);
  assert.match(ics,/BEGIN:VALARM/);
});
