(function(){
'use strict';
// OMS v7.71 focused patch only: customer matching, customer save, visible code cleanup.
const E=id=>document.getElementById(id);
const norm=v=>String(v??'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').trim().replace(/^@+/,'').replace(/님$/,'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();
const phone=v=>{let s=String(v??'').replace(/\D/g,'');if(s.startsWith('82')&&s.length>=11)s='0'+s.slice(2);return s};
const customers=()=>Array.isArray(window.state?.customers)?state.customers.filter(c=>c&&c.active!==false):[];
function matchCustomer(value,extra={}){
 const cs=customers(), id=String(extra.customerId||'').trim();
 if(id){const a=cs.filter(c=>String(c.id||'')===id);if(a.length===1)return {customer:a[0],status:'matched-id'}}
 const p=phone(extra.phone||'');
 if(p){const a=cs.filter(c=>phone(c.phone)===p);if(a.length===1)return {customer:a[0],status:'matched-phone'};if(a.length>1)return {customer:null,status:'duplicate'}}
 const n=norm(value||extra.nick||extra.name||'');if(!n)return {customer:null,status:'unmatched'};
 const a=cs.filter(c=>[c.nick,c.nickname,c.name].some(x=>norm(x)===n));
 if(a.length===1)return {customer:a[0],status:'matched'};if(a.length>1)return {customer:null,status:'duplicate'};
 return {customer:null,status:'unmatched'};
}
window.findCustomerByNick=nick=>matchCustomer(nick);
window.autoMatchAll=function(){(state.orders||[]).forEach(o=>{const m=matchCustomer(o.nick,{customerId:o.customerId,phone:o.phone,name:o.name});o.customerId=m.customer?.id||null;o.matchStatus=m.status})};

const originalGet=window.getReceipts;
if(typeof originalGet==='function')window.getReceipts=function(){
 const rs=originalGet.apply(this,arguments)||[];
 for(const r of rs){
   const m=matchCustomer(r.nick,{customerId:r.customerId,phone:r.phone,name:r.name});
   if(m.customer){r.customer=m.customer;r.customerId=m.customer.id;r.matchStatus=m.status;(r.items||[]).forEach(o=>{o.customerId=m.customer.id;o.matchStatus=m.status})}
 }
 return rs;
};

const originalImport=window.importOrders;
if(typeof originalImport==='function')window.importOrders=async function(rows,filename){
 const out=await originalImport(rows,filename);
 try{await window.syncServerCustomers?.(false)}catch(e){}
 window.autoMatchAll();try{window.saveSilently?.()}catch(e){};try{window.renderAll?.()}catch(e){}
 return out;
};

window.saveCustomer=async function(){
 const edit=E('cEditIndex')?.value??'', old=edit===''?null:(state.customers||[])[Number(edit)];
 const modal=E('customerModal'), receiptKey=modal?.dataset?.receiptKey||'';
 const c={id:old?.id||crypto.randomUUID(),name:(E('cName')?.value||'').trim(),nickname:(E('cNick')?.value||'').trim(),nick:(E('cNick')?.value||'').trim(),phone:(E('cPhone')?.value||'').trim(),postalCode:(E('cPostalCode')?.value||'').trim(),address:(E('cAddress')?.value||'').trim(),detailAddress:(E('cDetailAddress')?.value||'').trim(),memo:(E('cMemo')?.value||'').trim(),joinedAt:old?.joinedAt||new Date().toLocaleString('ko-KR'),source:'관리자폼'};
 if(!c.name||!c.nickname||!c.phone||!c.address){alert('성함, 닉네임, 연락처, 기본주소를 모두 입력해 주세요.');return}
 try{
   const r=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'고객 저장 실패');
   const saved={...c,...d,nickname:d.nickname||d.nick||c.nickname,nick:d.nickname||d.nick||c.nickname};
   const idx=(state.customers||[]).findIndex(x=>String(x.id||'')===String(saved.id||'')||(phone(saved.phone)&&phone(x.phone)===phone(saved.phone))||norm(x.nickname||x.nick)===norm(saved.nickname));
   if(idx>=0)state.customers[idx]={...state.customers[idx],...saved};else state.customers.push(saved);
   if(receiptKey){const parts=receiptKey.split('|'),date=parts.shift()||'',nickKey=norm(parts.join('|'));(state.orders||[]).forEach(o=>{if(String(o.date)===date&&norm(o.nick)===nickKey){o.customerId=saved.id;o.matchStatus='matched'}})}
   window.autoMatchAll();try{window.saveSilently?.()}catch(e){};
   try{await window.syncServerCustomers?.(false)}catch(e){};window.autoMatchAll();try{window.saveSilently?.()}catch(e){};try{window.renderAll?.()}catch(e){};try{window.closeCustomerModal?.()}catch(e){}
   alert('고객정보가 저장되어 정산서에 바로 반영되었습니다.');
 }catch(e){alert('고객정보 저장 실패: '+e.message)}
};

function removeVisibleCode(){
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),bad=[];
 while(walker.nextNode()){
   const n=walker.currentNode,p=n.parentElement;if(!p||['SCRIPT','STYLE','PRE','CODE','TEXTAREA'].includes(p.tagName))continue;
   const t=(n.nodeValue||'').trim();
   if(t.length>80&&(/<\/script>|window\.|document\.|function\s*\(|const\s+[A-Za-z_$]|XMLSerializer|createElement\(/.test(t)))bad.push(n);
 }
 bad.forEach(n=>n.remove());
}
function refresh(){try{window.autoMatchAll();window.saveSilently?.();window.renderAll?.()}catch(e){}removeVisibleCode()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else setTimeout(refresh,0);
new MutationObserver(()=>{clearTimeout(window.__oms771Clean);window.__oms771Clean=setTimeout(removeVisibleCode,80)}).observe(document.documentElement,{childList:true,subtree:true});
})();
