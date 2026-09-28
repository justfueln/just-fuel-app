// Prevent legacy DOM-based Race enhancements from waking each other up forever.
// Both Race Goal Progress and Race Fuel Rehearsal observe the full document and
// replace their own cards. Without this narrow filter, one add-on's insert/remove
// wakes the other one, which then inserts above it and wakes the first one again.

if(typeof window!=='undefined'&&window.MutationObserver&&!window.__jfRaceAddonMutationGuard){
  const NativeMutationObserver=window.MutationObserver;
  const ADDON_SELECTOR=[
    '.jf-race-prep-card',
    '.jf-race-prep-chip',
    '.jf-home-race-prep',
    '.jf-race-rehearsal-card',
    '.jf-rehearsal-session',
    '.jf-race-week'
  ].join(',');

  const withinAddon=node=>{
    if(!node)return false;
    if(node.nodeType===1){
      return Boolean(node.matches?.(ADDON_SELECTOR)||node.closest?.(ADDON_SELECTOR));
    }
    return Boolean(node.parentElement?.closest?.(ADDON_SELECTOR));
  };

  const addonOnlyMutation=record=>{
    if(withinAddon(record.target))return true;
    const changed=[...record.addedNodes,...record.removedNodes];
    return changed.length>0&&changed.every(withinAddon);
  };

  class RaceSafeMutationObserver{
    constructor(callback){
      this._observer=new NativeMutationObserver((records,observer)=>{
        const relevant=records.filter(record=>!addonOnlyMutation(record));
        if(relevant.length)callback(relevant,observer);
      });
    }
    observe(...args){return this._observer.observe(...args)}
    disconnect(){return this._observer.disconnect()}
    takeRecords(){return this._observer.takeRecords().filter(record=>!addonOnlyMutation(record))}
  }

  window.MutationObserver=RaceSafeMutationObserver;
  window.__jfRaceAddonMutationGuard=true;
}
