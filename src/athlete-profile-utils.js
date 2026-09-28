function parseDateOnly(value){
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match)return null;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const date=new Date(year,month-1,day);
  if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return null;
  return date;
}

export function ageFromDob(value,today=new Date()){
  const dob=parseDateOnly(value);
  if(!dob||Number.isNaN(today?.getTime?.()))return null;
  let age=today.getFullYear()-dob.getFullYear();
  const beforeBirthday=today.getMonth()<dob.getMonth()||(today.getMonth()===dob.getMonth()&&today.getDate()<dob.getDate());
  if(beforeBirthday)age-=1;
  return age>=0&&age<=120?age:null;
}

export function estimatedMaxHrFromDob(value,today=new Date()){
  const age=ageFromDob(value,today);
  if(age==null||age<18||age>100)return null;
  return Math.round(208-(0.7*age));
}

export function dobIsValid(value,today=new Date()){
  if(!value)return true;
  const dob=parseDateOnly(value);
  if(!dob)return false;
  const age=ageFromDob(value,today);
  return dob<=today&&age!=null;
}
