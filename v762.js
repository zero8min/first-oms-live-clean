/* OMS v7.62 urgent stability hotfix: SOLAPI masked-key guard + customer edit + no flicker */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const fingerprint=list=>JSON.stringify((list||[]).map(c=>[c.id,c.name,c.nickname||c.nick,c.phone,c.postalCode,c.address,c.detailAddress,c.memo,c.active]));
let customerFp=fingerprint(window.state?.customers||[]);
let customerBusy=false;

// SOLAPI 설정 화면: 마스킹 문자열을 입력값으로 절대 재사용하지 않는다.
window.loadSolapiSettings=async function(){
 try{
  const r=await fetch('/api/solapi/config?ts='+Date.now(),{cache:'no-store'}),d=await r.json();
  if(!r.ok)throw new Error(d.error||'설정 조회 실패');
  const key=$('solapiApiKey'),sec=$('solapiApiSecret'),snd=$('solapiSender'),pf=$('solapiPfId'),tpl=$('solapiTemplateId');
  if(key){key.value='';key.placeholder=d.apiKeyMasked?`저장됨 (${d.apiKeyMasked}) · 변경할 때만 입력`:'API Key 입력'}
  if(sec){sec.value='';sec.placeholder=d.hasSecret?'저장됨 · 변경할 때만 입력':'API Secret 입력'}
  if(snd)snd.value=d.sender||'';if(pf)pf.value=d.pfId||'';if(tpl)tpl.value=d.templateId||'';
  const el=$('solapiStatus');if(el)el.textContent=d.configured?'✅ 문자 발송 준비됨':'⚠️ 솔라피 설정 확인 필요';
  return d;
 }catch(e){const el=$('solapiStatus');if(el)el.textContent='⚠️ '+e.message;throw e}
};
window.saveSolapiSettings=async function(){
 const body={apiKey:($('solapiApiKey')?.value||'').trim(),apiSecret:($('solapiApiSecret')?.value||'').trim(),sender:($('solapiSender')?.value||'').trim(),pfId:($('solapiPfId')?.value||'').trim(),templateId:($('solapiTemplateId')?.value||'').trim()};
 try{const r=await fetch('/api/solapi/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'저장 실패');alert('솔라피 설정을 안전하게 저장했습니다.');await window.loadSolapiSettings()}catch(e){alert('솔라피 설정 저장 실패: '+e.message)}
};

// 서버 고객목록은 실제 변경됐을 때만 반영한다. 화면/스크롤/입력 중에는 강제 재렌더 금지.
window.syncServerCustomers=async function(showMessage=false){
 try{
  const r=await fetch('/api/customers?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
  const list=await r.json(),nextFp=fingerprint(list);
  if(nextFp!==customerFp){
   customerFp=nextFp;
   state.customers=(list||[]).map(c=>({...c,nickname:c.nickname||c.nick||'',nick:c.nickname||c.nick||''}));
   try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
   if(!customerBusy && !$('customerModal')?.classList.contains('show')){
    const sc=$('customersTable')?.querySelector('.scroll'),left=sc?.scrollLeft||0,top=sc?.scrollTop||0;
    window.renderCustomers?.();window.renderCustomerIssuesV755?.();
    requestAnimationFrame(()=>{const n=$('customersTable')?.querySelector('.scroll');if(n){n.scrollLeft=left;n.scrollTop=top}});
   }
  }
  if(showMessage)alert(`고객DB ${state.customers?.length||0}명을 확인했습니다.`);return true;
 }catch(e){if(showMessage)alert('고객DB 동기화 실패: '+e.message);return false}
};
window.applyServerCustomers=function(list){
 if(!Array.isArray(list))return;
 const nextFp=fingerprint(list);if(nextFp===customerFp)return;
 customerFp=nextFp;state.customers=list.map(c=>({...c,nickname:c.nickname||c.nick||'',nick:c.nickname||c.nick||''}));
 try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
 if(!customerBusy && !$('customerModal')?.classList.contains('show')){window.renderCustomers?.();window.renderCustomerIssuesV755?.()}
};

// 고객 수정은 배열 인덱스가 아니라 고객 id 기준으로 저장한다.
window.editCustomer=function(i){
 const c=state.customers[i];if(!c)return alert('고객정보를 찾을 수 없습니다.');
 $('cEditIndex').value=i;$('customerModal').dataset.customerId=c.id||'';
 $('cName').value=c.name||'';$('cNick').value=c.nick||c.nickname||'';$('cPhone').value=c.phone||'';$('cPostalCode').value=c.postalCode||'';$('cAddress').value=c.address||'';$('cDetailAddress').value=c.detailAddress||'';$('cMemo').value=c.memo||'';$('cAddressStatus').textContent='';$('customerModal').classList.add('show');
};
window.saveCustomer=async function(){
 if(customerBusy)return;customerBusy=true;
 const modal=$('customerModal'),id=modal?.dataset.customerId||'';
 const c={id:id||crypto.randomUUID(),name:($('cName')?.value||'').trim(),nickname:($('cNick')?.value||'').trim(),nick:($('cNick')?.value||'').trim(),phone:($('cPhone')?.value||'').trim(),postalCode:($('cPostalCode')?.value||'').trim(),address:($('cAddress')?.value||'').trim(),detailAddress:($('cDetailAddress')?.value||'').trim(),memo:($('cMemo')?.value||'').trim(),source:'관리자폼'};
 if(!c.name||!c.nickname||!c.phone||!c.address){customerBusy=false;return alert('성함, 닉네임, 연락처, 기본주소를 모두 입력해 주세요.')}
 try{
  const r=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)}),d=await r.json();if(!r.ok)throw new Error(d.error||'고객 저장 실패');
  const idx=state.customers.findIndex(x=>String(x.id||'')===String(d.id||c.id));if(idx>=0)state.customers[idx]={...state.customers[idx],...d,nickname:d.nickname||d.nick||c.nickname,nick:d.nickname||d.nick||c.nickname};else state.customers.push({...d,nickname:d.nickname||d.nick||c.nickname,nick:d.nickname||d.nick||c.nickname});
  customerFp=fingerprint(state.customers);try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
  modal?.classList.remove('show');if(modal)modal.dataset.customerId='';
  window.autoMatchAll?.();window.renderCustomers?.();window.renderCustomerIssuesV755?.();window.renderReceipts?.();window.renderShipping?.();
  alert('고객정보 수정이 저장되었습니다.');
 }catch(e){alert('고객정보 저장 실패: '+e.message)}finally{customerBusy=false}
};

// 10초 폴링이 편집 중 화면을 건드리지 않도록 추가 차단
setInterval(()=>{if(!document.hidden&&!customerBusy&&!$('customerModal')?.classList.contains('show'))window.syncServerCustomers(false)},30000);
window.addEventListener('load',()=>setTimeout(()=>window.loadSolapiSettings?.().catch(()=>{}),700));
})();
