import React,{useEffect,useState} from 'react';
import {Flag,LogOut,RefreshCw} from 'lucide-react';
import RaceHubV2 from './RaceHubV2';
import {supabase} from './main';
import {fetchTrainingRaces,sendTrainingOtp,verifyTrainingOtp} from './training-api';

export default function RaceApp(){
  const[session,setSession]=useState(null);
  const[authReady,setAuthReady]=useState(false);
  const[races,setRaces]=useState([]);
  const[loading,setLoading]=useState(false);
  const[message,setMessage]=useState('');
  const[email,setEmail]=useState('');
  const[otp,setOtp]=useState('');
  const[otpSent,setOtpSent]=useState(false);

  useEffect(()=>{
    let active=true;
    supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session||null);setAuthReady(true)}});
    const{data:sub}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next||null);setAuthReady(true)}});
    return()=>{active=false;sub.subscription.unsubscribe()};
  },[]);

  useEffect(()=>{
    if(!authReady)return;
    if(!session?.user){setRaces([]);setLoading(false);return}
    reloadRaces({keepMessage:true});
  },[authReady,session?.user?.id]);

  async function reloadRaces({keepMessage=false}={}){
    if(!session?.user)return;
    setLoading(true);
    if(!keepMessage)setMessage('');
    const result=await fetchTrainingRaces(supabase,session.user.id);
    if(result.error)setMessage(`Could not load races: ${result.error.message}`);
    else setRaces(result.races||[]);
    setLoading(false);
  }

  async function sendOtp(){
    const clean=email.trim();
    if(!clean)return setMessage('Enter your email address first.');
    setMessage('Sending login code…');
    const{error}=await sendTrainingOtp(supabase,clean);
    if(error)return setMessage(error.message);
    setOtpSent(true);setMessage('Login code sent. Use the newest code from your email.');
  }

  async function verifyOtp(){
    if(!otp.trim())return setMessage('Enter the login code from your email.');
    setMessage('Signing in…');
    const{error}=await verifyTrainingOtp(supabase,email.trim(),otp.trim());
    if(error)setMessage(error.message);
  }

  async function signOut(){
    await supabase.auth.signOut();
    setSession(null);setRaces([]);setMessage('');setOtp('');setOtpSent(false);
  }

  if(!authReady)return <div className="app-shell race-app-shell"><main><section className="card empty"><Flag size={28}/><p>Loading Race…</p></section></main></div>;
  if(!session)return <RaceLogin email={email} setEmail={setEmail} otp={otp} setOtp={setOtp} sent={otpSent} send={sendOtp} verify={verifyOtp} message={message}/>;

  return <div className="app-shell race-app-shell">
    <header className="topbar"><div><div className="brand">JUST FUEL</div><div className="subbrand">RACE SMART • FUEL SMART</div></div><div className="training-header-actions"><button className="icon-btn" onClick={()=>reloadRaces()} aria-label="Refresh races"><RefreshCw size={18}/></button><button className="icon-btn" onClick={signOut} aria-label="Sign out"><LogOut size={18}/></button></div></header>
    <main>{message&&<div className="notice">{message}</div>}{loading&&!races.length?<section className="card empty"><Flag size={28}/><p>Loading races…</p></section>:<RaceHubV2 races={races} userId={session.user.id} reload={reloadRaces}/>}</main>
    <footer className="footer-note">Fuel smart. Race ready.</footer>
  </div>;
}

function RaceLogin({email,setEmail,otp,setOtp,sent,send,verify,message}){
  return <div className="center-screen login-wrap"><div className="logo-mark">JF</div><h1>Race Login</h1><p className="muted">Sign in once to load your races, stages and race fuel plan.</p><input type="email" autoComplete="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/>{!sent?<button className="primary" onClick={send}>Send login code</button>:<><input inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="Login code" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))}/><button className="primary" onClick={verify}>Sign in</button><button className="secondary login-resend" onClick={send}>Send a new code</button></>}{message&&<div className="notice">{message}</div>}</div>;
}
