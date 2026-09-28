/* Additive, account-scoped UI record. Owner approved subject to upgrade/rollback tests. */
(function(root){
  'use strict';
  const valid=r=>!!r&&r.schema===1&&typeof r.complete==='boolean'&&(r.specialty===null||typeof r.specialty==='string'&&r.specialty.length<=100);
  const key=owner=>'ui_onboarding_user_'+(/^\d+$/.test(String(owner))?String(owner):'browser');
  const returning=state=>!!(state&&(Object.keys(state.answers||{}).length||Object.keys(state.dl||{}).length||(state.fav||[]).length||(state.favBooks||[]).length||state.resume||state.settings?.education_ack));
  function migrate(record,legacyState){
    if(record!=null)return valid(record)?{record:{...record},write:false,writable:true}:{record:null,write:false,writable:false};
    const complete=returning(legacyState);
    return{record:{schema:1,complete,specialty:null},write:complete,writable:true};
  }
  function finish(record,specialty){
    if(!valid(record))throw new Error('Unknown onboarding record; not overwritten');
    if(specialty!==null&&(typeof specialty!=='string'||specialty.length>100))throw new Error('Invalid specialty');
    return{...record,complete:true,specialty};
  }
  const api={valid,key,returning,migrate,finish};root.KafuOnboardingCore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
