import React,{useEffect,useState} from 'react';
import RaceHubV2 from './RaceHubV2';
import {supabase} from './main';

export default function RaceHubStandalone({races=[]}){
  const[userId,setUserId]=useState('');
  useEffect(()=>{supabase.auth.getSession().then(({data})=>setUserId(data.session?.user?.id||''))},[]);
  async function reload(){window.location.reload()}
  if(!userId)return <section className="card empty"><p>Loading Race…</p></section>;
  return <RaceHubV2 races={races} userId={userId} reload={reload}/>;
}
