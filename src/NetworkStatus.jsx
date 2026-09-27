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

  if(!online)return <div className="jf-network-banner offline" role="status">Offline · you can keep browsing cached screens</div>;
  if(showBackOnline)return <div className="jf-network-banner online" role="status">Back online</div>;
  return null;
}
