/* OMS v7.56 hotfix: receipt detail, simple shipping list, grouped summary, customer action visibility */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>(Number(v)||0).toLocaleString('ko-KR')+'원';

function receiptList(){try{return typeof filteredReceipts==='function'?filteredReceipts():getReceipts()}catch(e){return []}}

/* 1) 정산서: 화면 왼쪽에도 상세 버튼을 강제로 보여줌 */
function decorateReceiptDetailButtons(){
  const table=$('receiptCards')?.querySelector('table'); if(!table)return;
  const rs=receiptList().sort((a,b)=>String(a.nick||'').localeCompare(String(b.nick||''),'ko'));
  const hr=table.querySelector('thead tr');
  if(hr&&!hr.querySelector('.v756-detail-head')){
    const th=document.createElement('th'); th.className='v756-detail-head'; th.textContent='상세 정산서';
    const pos=hr.children[0]?.classList.contains('v7474-receipt-head')?2:1;
    hr.insertBefore(th,hr.children[pos]||null);
  }
  [...table.querySelectorAll('tbody tr')].forEach((tr,i)=>{
    if(tr.querySelector('.v756-detail-cell'))return;
    const r=rs[i]; if(!r)return;
    const td=document.createElement('td'); td.className='v756-detail-cell';
    td.innerHTML=`<button class="btn v756-detail-btn" type="button">상세보기/수정</button>`;
    td.querySelector('button').onclick=()=>window.openReceiptDetail?.(r.key);
    const pos=tr.children[0]?.querySelector('.v7474-receipt-check')?2:1;
    tr.insertBefore(td,tr.children[pos]||null);
  });
}
const rr756=window.renderReceipts;
window.renderReceipts=function(){const out=rr756?.apply(this,arguments);setTimeout(decorateReceiptDetailButtons,20);return out};

/* 2) 고객DB: 수정/삭제가 항상 왼쪽에서 보이도록 관리열 복제 */
function decorateCustomerActions(){
  const table=$('customersTable')?.querySelector('table'); if(!table)return;
  const hr=table.querySelector('thead tr');
  if(hr&&!hr.querySelector('.v756-manage-head')){
    const th=document.createElement('th');th.className='v756-manage-head';th.textContent='수정 / 삭제';
    const pos=hr.children[0]?.querySelector('input')?2:1;
    hr.insertBefore(th,hr.children[pos]||null);
  }
  [...table.querySelectorAll('tbody tr')].forEach(tr=>{
    if(tr.querySelector('.v756-manage-cell'))return;
    const original=[...tr.querySelectorAll('td')].find(td=>td.querySelector('button[onclick*="editCustomer"]')||td.querySelector('button[onclick*="deleteCustomer"]'));
    if(!original)return;
    const td=document.createElement('td');td.className='v756-manage-cell';td.innerHTML=original.innerHTML;
    const pos=tr.children[0]?.querySelector('.v7474-customer-check')?2:1;
    tr.insertBefore(td,tr.children[pos]||null);
  });
}
const rc756=window.renderCustomers;
window.renderCustomers=function(){const out=rc756?.apply(this,arguments);setTimeout(decorateCustomerActions,20);return out};

/* shipping grouping helper */
function buildShippingGroups(){
  const filter=$('shippingFilter')?.value||'paid',bundle=$('bundleMode')?.value||'date';
  let rs=typeof getReceipts==='function'?getReceipts():[];
  if(filter==='paid')rs=rs.filter(r=>r.payment?.status==='paid');
  const groups=new Map();
  rs.forEach(r=>{
    const c=r.customer||{};const k=bundle==='customer'?(c.id||r.nick):r.key;
    if(!groups.has(k))groups.set(k,{key:r.key,name:c.name||'',nick:r.nick,phone:c.phone||'',postalCode:c.postalCode||'',address:[c.address,c.detailAddress].filter(Boolean).join(' '),memo:c.memo||'',dates:new Set(),items:[],subtotal:0,fee:0,total:0,status:r.payment?.status||'unpaid'});
    const g=groups.get(k);g.dates.add(r.date);g.items.push(...(r.items||[]).map(x=>({...x})));g.subtotal+=Number(r.subtotal)||0;g.fee+=Number(r.fee)||0;g.total+=Number(r.total)||0;
  });
  return [...groups.values()].map((g,i)=>({...g,code:(typeof shippingCodeFor==='function'?shippingCodeFor(g):(typeof shipCode755==='function'?shipCode755(g):g.key)),jobNo:String(i+1).padStart(3,'0')}));
}
function shipStatus(s){return s?.shipmentScanAt?'🚚 출고준비완료':(s?.packingCompletedAt||s?.at)?'🟢 포장완료':'⏳ 포장대기'}
function shortItems(g){return (g.items||[]).slice(0,4).map(x=>`#${esc(x.number||'-')} ${esc(x.item)} ×${Number(x.qty)||0}`).join('<br>')+((g.items||[]).length>4?`<br><small>외 ${(g.items||[]).length-4}건</small>`:'')}

/* 3) 택배실: 예전처럼 단순한 표로 되돌림 */
window.renderShipping=function(){
  const arr=buildShippingGroups();window.currentShipping=arr;state.shippingScans=state.shippingScans||{};
  const box=$('shippingTable');if(!box)return;
  if(!arr.length){box.innerHTML='<div class="empty">택배 대상이 없습니다.</div>';return}
  box.innerHTML=`<div class="v756-ship-toolbar"><button class="btn" onclick="toggleAllShippingPrintV747(true)">전체선택</button><button class="btn secondary" onclick="toggleAllShippingPrintV747(false)">선택해제</button><button class="btn" onclick="printShippingSelectedV747()">선택 택배리스트 출력</button><button class="btn secondary" onclick="printShipping()">전체 택배리스트 출력</button></div><div class="scroll"><table class="v756-ship-table"><thead><tr><th><input type="checkbox" onchange="toggleAllShippingPrintV747(this.checked)"></th><th>상태</th><th>고객</th><th>주문상품</th><th>주소 / 연락처</th><th>청구금액</th><th>송장번호</th><th>관리</th></tr></thead><tbody>${arr.map(g=>{const s=state.shippingScans[g.code]||{};return `<tr><td><input type="checkbox" class="v7474-ship-check v747-ship-check" data-code="${esc(g.code)}"></td><td><b>${shipStatus(s)}</b><br><small>${esc(s.worker||'')}</small></td><td><b>${esc(g.name||g.nick)}</b><br><span>${esc(g.nick)}</span></td><td class="v756-items">${shortItems(g)}</td><td>${esc(g.address||'-')}<br><b>${esc(g.phone||'-')}</b></td><td><b>${money(g.total)}</b></td><td><b>${esc(s.trackingNumber||'-')}</b><br><small>${esc(s.courier||'CJ대한통운')}</small></td><td><button class="btn secondary" onclick="openReceiptDetail('${esc(g.key)}')">정산서 보기/수정</button></td></tr>`}).join('')}</tbody></table></div>`;
};

/* 전체선택은 DOM 기준으로 확실하게 */
window.toggleAllShippingPrintV747=function(v){document.querySelectorAll('.v7474-ship-check,.v747-ship-check').forEach(cb=>cb.checked=!!v)};

/* 4) 총괄표: 같은 품번/상품은 한 행, 옵션은 합산하고 총수량으로 표시 */
function baseName(item){
  let s=String(item||'').trim();
  s=s.replace(/[（(][^）)]*(색상|향|사이즈|size|랜덤|지정|\d{2,3}\s*(mm|호)?)[^）)]*[）)]/ig,'').trim();
  if(s.includes('/')){const parts=s.split('/'); if(parts.length>1&&/(색상|향|사이즈|랜덤|지정|블랙|화이트|핑크|레드|블루|\d{2,3})/i.test(parts.slice(1).join('/')))s=parts[0].trim()}
  return s.replace(/\s{2,}/g,' ').trim();
}
function calcActual(x){try{if(typeof window.packCalcV750==='function')return window.packCalcV750(x)}catch(e){}const q=Number(x?.qty)||0;return {orderQty:q,actualQty:q,actualUnit:'개',saleUnit:'개'}}
function groupedSku(arr){
  const mp=new Map();
  arr.forEach(g=>(g.items||[]).forEach((x,i)=>{
    const num=String(x.number||'').replace(/^#/,'').trim();const name=baseName(x.item);const key=num?`N:${num}`:`P:${name.toLowerCase()}`;const c=calcActual(x);
    if(!mp.has(key))mp.set(key,{number:num||'-',name:name||String(x.item||''),orderQty:0,actualQty:0,actualUnits:new Map(),customers:new Set()});
    const z=mp.get(key);z.orderQty+=Number(x.qty)||0;z.actualQty+=Number(c.actualQty)||0;z.actualUnits.set(c.actualUnit||'개',(z.actualUnits.get(c.actualUnit||'개')||0)+(Number(c.actualQty)||0));z.customers.add(g.name||g.nick||'');
  }));
  return [...mp.values()].sort((a,b)=>(Number(a.number)||999999)-(Number(b.number)||999999)||a.name.localeCompare(b.name,'ko'));
}
function simpleCustomerPages(arr){
  return arr.map((g,i)=>`<section class="page"><h1>${esc(g.jobNo||String(i+1).padStart(3,'0'))}번 / ${esc(g.name||g.nick)}</h1><div class="meta">${esc(g.phone||'')} · ${esc(g.address||'')}</div><table><thead><tr><th>품번</th><th>상품명</th><th>수량</th></tr></thead><tbody>${(g.items||[]).map(x=>{const c=calcActual(x);return `<tr><td>#${esc(x.number||'-')}</td><td>${esc(x.item)}</td><td class="qty">${Number(c.actualQty)||0}${esc(c.actualUnit||'개')}</td></tr>`}).join('')}</tbody></table></section>`).join('')
}
window.printPackingSummaryV748=function(){
  window.renderShipping();const arr=[...(window.currentShipping||[])];if(!arr.length)return alert('출력할 택배 대상이 없습니다.');
  const sku=groupedSku(arr),company=window.__tenantCompany||state.settings?.company||'땡라이브';
  const summary=`<section class="page"><h1>${esc(company)} 상품 준비 총괄표</h1><p>같은 품번/상품은 하나로 합산했습니다.</p><table><thead><tr><th>품번</th><th>상품명</th><th>총 주문수량</th><th>실제 준비수량</th><th>주문 고객수</th></tr></thead><tbody>${sku.map(x=>`<tr><td><b>#${esc(x.number)}</b></td><td>${esc(x.name)}</td><td class="qty">${x.orderQty}</td><td class="qty">${[...x.actualUnits].map(([u,q])=>q+esc(u)).join(' + ')}</td><td>${x.customers.size}명</td></tr>`).join('')}</tbody></table></section>`;
  const w=window.open('','_blank');if(!w)return alert('팝업 차단을 해제해 주세요.');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>상품 준비 총괄표</title><style>*{box-sizing:border-box}body{font-family:Arial,'Noto Sans KR',sans-serif;margin:0;color:#111}.page{width:210mm;min-height:297mm;padding:12mm;page-break-after:always}.page:last-child{page-break-after:auto}h1{font-size:28px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #777;padding:10px 8px}th{background:#eee}.qty{font-size:21px;font-weight:900;text-align:center}.meta{margin:8px 0 15px;color:#555}@page{size:A4;margin:0}</style></head><body>${summary}${simpleCustomerPages(arr)}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);w.document.close();
};

/* 기존 전체/선택 인쇄는 간편 포장지로 유지 */
window.printShipping=function(){window.renderShipping();const arr=[...(window.currentShipping||[])];if(!arr.length)return alert('출력할 택배 대상이 없습니다.');const w=window.open('','_blank');if(!w)return alert('팝업 차단을 해제해 주세요.');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,'Noto Sans KR',sans-serif}.page{width:210mm;min-height:297mm;padding:12mm;page-break-after:always}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:10px}.qty{font-size:22px;font-weight:900}@page{size:A4;margin:0}</style></head><body>${simpleCustomerPages(arr)}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()};
window.printShippingSelectedV747=function(){const codes=new Set([...document.querySelectorAll('.v7474-ship-check:checked,.v747-ship-check:checked')].map(x=>x.dataset.code));const arr=(window.currentShipping||[]).filter(g=>codes.has(g.code));if(!arr.length)return alert('출력할 고객을 체크해 주세요.');const w=window.open('','_blank');if(!w)return alert('팝업 차단을 해제해 주세요.');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,'Noto Sans KR',sans-serif}.page{width:210mm;min-height:297mm;padding:12mm;page-break-after:always}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:10px}.qty{font-size:22px;font-weight:900}@page{size:A4;margin:0}</style></head><body>${simpleCustomerPages(arr)}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()};

setTimeout(()=>{try{window.renderCustomers?.();window.renderReceipts?.();window.renderShipping?.()}catch(e){console.warn('v756 init',e)}},250);
})();
