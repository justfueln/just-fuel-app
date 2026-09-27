import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Droplets, Fuel, Minus, Plus, RefreshCw, Save, Zap } from 'lucide-react';
import { supabase } from './main';

const fmtDate=v=>v?new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${v}T12:00:00`)):'—';
const num=v=>Number(v)||0;
const round=(v,d=0)=>{const p=10**d;return Math.round(num(v)*p)/p};
const pct=v=>v==null?'—':`${Math.round(Number(v))}%`;
const emptyForm=()=>({bottle_mix_sachets:0,regular_gels:0,boost_gels:0,hydrate_servings:0,recover_servings:0,extra_carbs_g:0,fluid_ml:0,energy_feel:'',issues:[],notes:''});
const FEELS=[['great','Great'],['good','Good'],['okay','Okay'],['energy_dip','Energy dip'],['hungry','Hungry']];
const ISSUES=[['gi_discomfort','GI discomfort'],['bloating','Bloating'],['cramping','Cramping'],['nausea','Nausea']];

function actualCarbs(form){return num(form.bottle_mix_sachets)*60+(num(form.regular_gels)+num(form.boost_gels))*40+num(form.extra_carbs_g)}
function Stepper({label,value,onChange,sub}){return <div className="fuel-log-stepper"><div><strong>{label}</strong>{sub&&<small>{sub}</small>}</div><div><button type="button" onClick={()=>onChange(Math.max(0,num(value)-1))}><Minus size={15}/></button><b>{num(value)}</b><button type="button" onClick={()=>onChange(num(value)+1)}><Plus size={15}/></button></div></div>}

export default function TrainingFuelReview(){
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(''),[editing,setEditing]=useState(''),[form,setForm]=useState(emptyForm());

  async function load(){
    setLoading(true);setError('');
    const{data:{session}}=await supabase.auth.getSession();
    if(!session?.user){setError('Sign in to review your fueling.');setLoading(false);return}
    const active=await supabase.from('training_plans').select('id').eq('user_id',session.user.id).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle();
    if(active.error){setError(active.error.message);setLoading(false);return}
    if(!active.data?.id){setRows([]);setLoading(false);return}
    await supabase.rpc('refresh_training_session_matches',{p_user_id:session.user.id});
    const result=await supabase.from('training_fuel_review').select('*').eq('user_id',session.user.id).eq('plan_id',active.data.id).not('actual_activity_id','is',null).order('session_date',{ascending:false});
    if(result.error)setError(result.error.message);else setRows(result.data||[]);
    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  function startEdit(row){
    setEditing(row.session_id);
    setForm({
      bottle_mix_sachets:num(row.actual_bottle_mix_sachets),regular_gels:num(row.actual_regular_gels),boost_gels:num(row.actual_boost_gels),hydrate_servings:num(row.actual_hydrate_servings),recover_servings:num(row.actual_recover_servings),extra_carbs_g:num(row.extra_carbs_g),fluid_ml:num(row.actual_fluid_ml),energy_feel:row.energy_feel||'',issues:Array.isArray(row.issues)?row.issues:[],notes:row.notes||''
    });
  }
  function setField(key,value){setForm(v=>({...v,[key]:value}))}
  function toggleIssue(key){setForm(v=>({...v,issues:v.issues.includes(key)?v.issues.filter(x=>x!==key):[...v.issues,key]}))}

  async function save(row){
    const{data:{session}}=await supabase.auth.getSession();
    if(!session?.user)return;
    setSaving(row.session_id);setError('');
    const payload={session_id:row.session_id,user_id:session.user.id,activity_id:row.actual_activity_id,bottle_mix_sachets:num(form.bottle_mix_sachets),regular_gels:num(form.regular_gels),boost_gels:num(form.boost_gels),hydrate_servings:num(form.hydrate_servings),recover_servings:num(form.recover_servings),extra_carbs_g:num(form.extra_carbs_g),fluid_ml:num(form.fluid_ml),energy_feel:form.energy_feel||null,issues:form.issues,notes:form.notes.trim()||null,logged_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const result=await supabase.from('training_session_fuel_actual').upsert(payload,{onConflict:'session_id'});
    if(result.error)setError(result.error.message);else{setEditing('');await load()}
    setSaving('');
  }

  const summary=useMemo(()=>{
    const logged=rows.filter(r=>r.logged_at),withTarget=rows.filter(r=>r.logged_at&&num(r.planned_carbs_per_hour)>0&&num(r.actual_carbs_per_hour)>=0);
    const avgActual=withTarget.length?withTarget.reduce((n,r)=>n+num(r.actual_carbs_per_hour),0)/withTarget.length:null;
    const avgTarget=withTarget.length?withTarget.reduce((n,r)=>n+num(r.planned_carbs_per_hour),0)/withTarget.length:null;
    const close=withTarget.filter(r=>num(r.carb_completion_pct)>=80&&num(r.carb_completion_pct)<=120).length;
    const issueCount=logged.filter(r=>Array.isArray(r.issues)&&r.issues.length).length;
    return{logged:logged.length,total:rows.length,avgActual,avgTarget,close,issueCount};
  },[rows]);

  const coach=useMemo(()=>{
    if(!summary.logged)return'Log what you actually consumed after each completed ride. The app will compare it with the plan and build your personal fueling history.';
    const logged=rows.filter(r=>r.logged_at);
    const under=logged.filter(r=>r.carb_completion_pct!=null&&num(r.carb_completion_pct)<75).length;
    const hungry=logged.filter(r=>r.energy_feel==='hungry'||r.energy_feel==='energy_dip').length;
    if(summary.issueCount>=2)return'You have logged repeated stomach or cramping issues. Keep the next fuel rehearsal controlled and use the notes to identify which intake level or product mix was involved.';
    if(under>=2||hungry>=2)return'Your recent fuel logs show repeated low intake or low-energy feedback. Aim closer to the planned carb target on the next suitable session and reassess how you feel.';
    if(summary.close>=Math.max(2,Math.ceil(summary.logged*.7)))return'Your logged fueling is tracking the plan consistently. Keep practising the same approach on key sessions so race-day execution becomes automatic.';
    return'Keep logging completed sessions. A few more rides will make the planned-versus-actual pattern much more useful.';
  },[rows,summary]);

  return <div className="stack training-fuel-review-screen">
    <section className="card fuel-review-head">
      <div className="row-between"><div><span className="eyebrow">PLANNED FUEL VS ACTUAL</span><h2>Fuel review</h2></div><button className="icon-btn" onClick={load} disabled={loading} aria-label="Refresh fuel review"><RefreshCw size={18}/></button></div>
      <p className="muted">After a completed Strava session, log what you actually drank and ate. Bottle Mix counts as 60 g carbohydrate and each Just Fuel gel as 40 g.</p>
      <div className="fuel-review-summary-grid"><div><span>Fuel logged</span><strong>{summary.logged}/{summary.total}</strong><small>completed planned rides</small></div><div><span>Avg actual</span><strong>{summary.avgActual==null?'—':`${round(summary.avgActual)} g/h`}</strong><small>{summary.avgTarget==null?'No comparison yet':`target ${round(summary.avgTarget)} g/h`}</small></div><div><span>Close to plan</span><strong>{summary.close}</strong><small>80–120% of planned carbs</small></div></div>
    </section>

    <section className="card coach-card"><span className="eyebrow">COACH SAYS</span><h3>{coach}</h3></section>
    {loading&&<section className="card empty"><Fuel size={28}/><p>Loading completed rides and fuel plans…</p></section>}
    {error&&<div className="notice">{error}</div>}
    {!loading&&!error&&!rows.length&&<section className="card empty"><Fuel size={28}/><p>No completed planned rides yet. After your first planned workout syncs from Strava, it will appear here for fuel logging.</p></section>}

    {!loading&&rows.map(row=>{
      const logged=Boolean(row.logged_at),open=editing===row.session_id;
      const carbTone=row.carb_completion_pct==null?'pending':num(row.carb_completion_pct)<75?'low':num(row.carb_completion_pct)>125?'high':'good';
      const previewCarbs=actualCarbs(form),hours=Math.max(.01,num(row.actual_duration_minutes)/60),previewGph=Math.round(previewCarbs/hours),previewFluid=Math.round(num(form.fluid_ml)/hours);
      return <section className="card fuel-review-card" key={row.session_id}>
        <div className="row-between"><div><span className="eyebrow">{fmtDate(row.session_date)}</span><h3>{row.title}</h3><small className="muted">{row.actual_name||'Matched Strava activity'} · {round(row.actual_duration_minutes)} min</small></div>{logged?<span className={`compare-verdict ${carbTone}`}>Fuel logged</span>:<span className="compare-verdict pending">Needs fuel log</span>}</div>

        <div className="fuel-compare-grid">
          <div><span className="compare-label">PLANNED</span><strong>{num(row.planned_carbs_per_hour)>0?`${round(row.planned_carbs_per_hour)} g/h`:'—'}</strong><small>{num(row.planned_carbs_g)>0?`${row.planned_carbs_g} g carbs total`:'No carb target'}</small><small>{num(row.planned_fluid_ml)>0?`${row.planned_fluid_ml} ml fluid`:'Fluid target not set'}</small></div>
          <div><span className="compare-label">ACTUAL</span><strong>{logged&&row.actual_carbs_per_hour!=null?`${round(row.actual_carbs_per_hour)} g/h`:'—'}</strong><small>{logged?`${row.actual_carbs_g} g carbs total`:'Not logged yet'}</small><small>{logged&&num(row.actual_fluid_ml)>0?`${row.actual_fluid_ml} ml fluid`:'—'}</small></div>
        </div>

        {logged&&<div className="fuel-review-bars"><div><span>Carbs</span><div><i style={{width:`${Math.min(150,num(row.carb_completion_pct))}%`}}/></div><b>{pct(row.carb_completion_pct)}</b></div>{row.fluid_completion_pct!=null&&<div><span>Fluid</span><div><i style={{width:`${Math.min(150,num(row.fluid_completion_pct))}%`}}/></div><b>{pct(row.fluid_completion_pct)}</b></div>}</div>}

        {!open?<button className="secondary fuel-log-button" onClick={()=>startEdit(row)}>{logged?'Edit actual fuel':'Log actual fuel'}</button>:<div className="fuel-log-form">
          <div className="fuel-log-title"><div><span className="eyebrow">WHAT YOU ACTUALLY USED</span><h4>{previewGph} g carbs/h · {previewFluid} ml/h</h4></div><CheckCircle2 size={20}/></div>
          <Stepper label="Bottle Mix" sub="60 g carbs each" value={form.bottle_mix_sachets} onChange={v=>setField('bottle_mix_sachets',v)}/>
          <Stepper label="Regular gels" sub="40 g carbs each" value={form.regular_gels} onChange={v=>setField('regular_gels',v)}/>
          <Stepper label="Boost gels" sub="40 g carbs + caffeine each" value={form.boost_gels} onChange={v=>setField('boost_gels',v)}/>
          <Stepper label="Hydrate servings" value={form.hydrate_servings} onChange={v=>setField('hydrate_servings',v)}/>
          <Stepper label="Recover servings" value={form.recover_servings} onChange={v=>setField('recover_servings',v)}/>
          <label className="fuel-log-field"><span>Other carbs consumed</span><div><input type="number" min="0" step="10" value={form.extra_carbs_g} onChange={e=>setField('extra_carbs_g',Math.max(0,num(e.target.value)))}/><b>g</b></div></label>
          <label className="fuel-log-field"><span>Total fluid consumed</span><div><input type="number" min="0" step="100" value={form.fluid_ml} onChange={e=>setField('fluid_ml',Math.max(0,num(e.target.value)))}/><b>ml</b></div></label>

          <div className="fuel-log-choice"><span>How was your energy?</span><div>{FEELS.map(([key,label])=><button type="button" key={key} className={form.energy_feel===key?'active':''} onClick={()=>setField('energy_feel',form.energy_feel===key?'':key)}>{label}</button>)}</div></div>
          <div className="fuel-log-choice"><span>Any issues?</span><div>{ISSUES.map(([key,label])=><button type="button" key={key} className={form.issues.includes(key)?'active':''} onClick={()=>toggleIssue(key)}>{label}</button>)}</div></div>
          <label className="fuel-log-notes"><span>Notes</span><textarea rows="3" placeholder="Anything useful to remember for the next fuel rehearsal…" value={form.notes} onChange={e=>setField('notes',e.target.value)}/></label>
          <div className="fuel-log-actions"><button className="secondary" type="button" onClick={()=>setEditing('')}>Cancel</button><button className="primary" type="button" disabled={saving===row.session_id} onClick={()=>save(row)}><Save size={17}/>{saving===row.session_id?'Saving…':'Save fuel log'}</button></div>
        </div>}

        {logged&&!open&&<details className="session-more"><summary>Fuel details</summary><div className="pill-row session-detail-pills"><span>{num(row.actual_bottle_mix_sachets)} Bottle Mix</span><span>{num(row.actual_regular_gels)} gels</span><span>{num(row.actual_boost_gels)} Boost</span>{num(row.actual_hydrate_servings)>0&&<span>{row.actual_hydrate_servings} Hydrate</span>}{num(row.actual_recover_servings)>0&&<span>{row.actual_recover_servings} Recover</span>}{row.energy_feel&&<span>Energy: {FEELS.find(x=>x[0]===row.energy_feel)?.[1]||row.energy_feel}</span>}</div>{Array.isArray(row.issues)&&row.issues.length>0&&<p className="muted">Issues: {row.issues.map(x=>ISSUES.find(i=>i[0]===x)?.[1]||x).join(', ')}</p>}{row.notes&&<p>{row.notes}</p>}</details>}
      </section>
    })}
  </div>
}
