import React,{useEffect,useState} from 'react';

export default function NetworkStatus(){
  const[online,setOnline]=useState(()=>navigator.onLine);
  const[showBackOnline,setShowBackOnline]=useState(false);

  useEffect(()=>{
    let timer;
    const onOnline=()=>{
      setOnline(true);
      setShowBackOnline(true);
      clearTimeout(timer);
      timer=setTimeout(()=>setShowBackOnline(false),2200);
    };
    const onOffline=()=>{
      clearTimeout(timer);
      setShowBackOnline(false);
      setOnline(false);
    };
    window.addEventListener('online',onOnline);
    window.addEventListener('offline',onOffline);
    return()=>{
      clearTimeout(timer);
      window.removeEventListener('online',onOnline);
      window.removeEventListener('offline',onOffline);
    };
  },[]);

  if(!online)return <div className="jf-network-banner offline" role="status" aria-live="polite">Offline · live sync, ordering and updates may be unavailable</div>;
  if(showBackOnline)return <div className="jf-network-banner online" role="status" aria-live="polite">Back online</div>;
  return null;
}
