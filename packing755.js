(()=>{
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function itemKey(x,i){return [x.number||i+1,String(x.item||''),i].join('|')}
function allResolved(){const items=job?.items||[],st=job?.itemChecks||{};return items.every((x,i)=>{const v=st[itemKey(x,i)]||{};return v.checked===true&&v.shortage!==true})}
function anyShortage(){const st=job?.itemChecks||{};return Object.values(st).some(v=>v?.shortage)}
async function saveItem(i,checked,shortage){if(!job)return;const x=job.items[i],k=itemKey(x,i);job.itemChecks=job.itemChecks||{};job.itemChecks[k]={checked:!!checked,shortage:!!shortage,worker,at:new Date().toISOString()};renderJob();try{const r=await fetch('/api/public/packing/item-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantCode:job.tenantCode||tenant,code:job.code,token,worker,itemKey:k,checked:!!checked,shortage:!!shortage,item:{number:x.number,item:x.item,qty:x.qty}})}),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'저장 실패')}catch(e){alert('체크 저장 실패: '+e.message)}}
window.packItemCheckV755=i=>saveItem(i,true,false);
window.packItemShortageV755=i=>{const k=itemKey(job.items[i],i),v=job.itemChecks?.[k]||{};saveItem(i,false,!v.shortage)};
const oldRender=window.renderJob;
window.renderJob=function(){
 const app=document.getElementById('app');
 if(!job){return oldRender()}
 if(job.status==='packed'||job.completedAt){return showScanner()}
 const rows=(job.items||[]).map((x,i)=>{const c=packCalc(x),k=itemKey(x,i),v=job.itemChecks?.[k]||{},opt=String(x.item||'').match(/[\(（]([^\)）]+)[\)）]/)?.[1]||String(x.item||'').split('/').slice(1).join('/').trim();return `<div class="item" style="grid-template-columns:auto 1fr auto;align-items:center;gap:10px"><input type="checkbox" ${v.checked?'checked':''} ${v.shortage?'disabled':''} onchange="packItemCheckV755(${i})" style="width:28px;height:28px"><div class="name">#${E(x.number)} ${E(x.item)}${opt?`<div class="small">옵션: ${E(opt)}</div>`:''}${explainPack(c)?`<div class="small">${E(explainPack(c))}${c.componentTotal!==c.actualQty?` · 총 구성 ${c.componentTotal}${E(c.componentUnit)}`:''}</div>`:''}${v.shortage?'<div class="notice warn" style="margin-top:8px;padding:8px">⚠️ 재고부족 표시됨</div>':''}</div><div style="text-align:right"><div class="qty">${c.actualQty}${E(c.actualUnit)}<div class="small">넣으세요</div></div><button class="change" style="margin-top:8px;background:${v.shortage?'#ffd7d7':'#ececf1'}" onclick="packItemShortageV755(${i})">${v.shortage?'재고부족 취소':'재고부족'}</button></div></div>`}).join('');
 app.innerHTML=`<div class="top"><div class="worker">${E(worker)}님 <span class="pill">체크 자동저장</span></div><button class="change" onclick="changeWorker()">포장자 변경</button></div><div class="job">${E(job.jobNo||'')}번 / ${E(job.name||job.nick||'고객')}</div><div class="small" style="font-size:18px;font-weight:900;margin:6px 0 12px">판매자: ${E(job.seller||'미지정')}</div><div class="count">📦 실제 포장 총 ${totalQty(job.items)}단위</div><div class="items">${rows}</div>${anyShortage()?'<div class="notice warn"><b>재고부족 상품이 있습니다.</b><br>관리자 택배실에도 표시됩니다. 부족건을 해결한 뒤 체크해 주세요.</div>':''}<button class="btn good" ${allResolved()?'':'disabled style="opacity:.45"'} onclick="packed()">${allResolved()?'다 넣었어요':'모든 상품을 체크해주세요'}</button><div class="small">사이즈·색상·향·수량별로 확인 후 체크하세요. 재고가 없으면 해당 행의 재고부족 버튼을 누르세요.</div>`;
};
const oldPacked=window.packed;
window.packed=async function(){if(!allResolved())return alert('모든 상품을 체크해야 포장완료할 수 있습니다. 재고부족 표시가 있으면 먼저 해결해 주세요.');return oldPacked()};
})();
