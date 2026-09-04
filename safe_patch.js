(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>(Number(v)||0).toLocaleString('ko-KR')+'원';
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/님$/,'').replace(/[\s\-_.·,()\[\]{}\/]/g,'');
const phone=v=>String(v??'').replace(/\D/g,'');

function extractMeta(text){
  const raw=String(text??'').trim();
  const opts=[];
  raw.replace(/\(([^()]*)\)|\[([^\[\]]*)\]|\{([^{}]*)\}/g,(_,a,b,c)=>{const v=(a??b??c??'').trim();if(v)opts.push(v);return _});
  const base=raw.replace(/\s*(\([^()]*\)|\[[^\[\]]*\]|\{[^{}]*\})\s*/g,' ').replace(/\s{2,}/g,' ').trim();
  return {raw,base:base||raw,option:opts.join(' / ')||'-',comments:opts};
}
window.extractOrderOptionSafe=extractMeta;

function findCustomerSafe(nick){
  const n=norm(nick); if(!n)return {customer:null,status:'unmatched'};
  const cs=(state.customers||[]).filter(c=>c.active!==false);
  let cand=cs.filter(c=>[c.nick,c.nickname,c.name].some(v=>norm(v)===n));
  if(cand.length===1)return {customer:cand[0],status:'matched'};
  if(cand.length>1)return {customer:null,status:'duplicate'};
  cand=cs.filter(c=>[c.nick,c.nickname,c.name].some(v=>{const x=norm(v);return n.length>=2&&x.length>=2&&(x.includes(n)||n.includes(x))}));
  return cand.length===1?{customer:cand[0],status:'matched-fuzzy'}:{customer:null,status:cand.length>1?'duplicate':'unmatched'};
}
window.findCustomerByNick=findCustomerSafe;
window.autoMatchAll=function(){(state.orders||[]).forEach(o=>{const m=findCustomerSafe(o.nick);o.customerId=m.customer?.id||null;o.matchStatus=m.status})};

function ruleByNumber(x){
  const k=String(x?.number??'').replace(/^#/,'').trim();
  const r=state.packingRules&&state.packingRules[k];
  return r||null;
}
function inferPack(x){
  const q=Math.max(0,Number(x?.qty)||0), meta=extractMeta(x?.item), text=(meta.comments.join(' ')+' '+meta.raw).replace(/\s+/g,' ');
  let m=text.match(/(\d+)\s*(개|봉지|봉|켤레|팩|박스)\s*(?:에|=|\/)?\s*1\s*(세트|묶음|팩|박스)/i);
  if(!m)m=text.match(/1\s*(세트|묶음|팩|박스)\s*(?:에|=|\/)?\s*(\d+)\s*(개|봉지|봉|켤레|팩|박스)/i);
  if(m){
    let componentQty,componentUnit,saleUnit;
    if(/^\d/.test(m[0])){componentQty=Number(m[1]);componentUnit=m[2];saleUnit=m[3]}else{saleUnit=m[1];componentQty=Number(m[2]);componentUnit=m[3]}
    const actualUnit=(componentUnit==='켤레'&&saleUnit==='묶음')?saleUnit:componentUnit;
    const actualQty=actualUnit===saleUnit?q:q*componentQty;
    return {orderQty:q,saleUnit,componentQty,componentUnit,actualUnit,actualQty,componentTotal:q*componentQty,source:'auto'};
  }
  m=text.match(/\b1\s*(봉지|봉|팩|박스|묶음|세트|개|켤레)\b/);
  if(m)return {orderQty:q,saleUnit:m[1],componentQty:1,componentUnit:m[1],actualUnit:m[1],actualQty:q,componentTotal:q,source:'auto'};
  return null;
}
function packCalc(x){
  const q=Math.max(0,Number(x?.qty)||0),r=ruleByNumber(x);
  if(r){
    const cq=Math.max(1,Number(r.componentQty)||1),sale=r.saleUnit||'개',cu=r.componentUnit||sale,au=r.actualUnit||cu;
    const actualQty=au===cu?q*cq:q;
    return {orderQty:q,saleUnit:sale,componentQty:cq,componentUnit:cu,actualUnit:au,actualQty,componentTotal:q*cq,source:'saved'};
  }
  return inferPack(x)||{orderQty:q,saleUnit:'개',componentQty:1,componentUnit:'개',actualUnit:'개',actualQty:q,componentTotal:q,source:'default'};
}
window.packCalcV750=packCalc;

function isKimchi(x){return /(김치|깍두기|총각|열무|배추|갓김치|파김치|백김치|동치미|겉절이|석박지|나박김치|오이소박이)/i.test(String(x?.item||''))}
window.isKimchiSafe=isKimchi;

function receiptGroups(){
  const rs=typeof getReceipts==='function'?getReceipts():[];
  return rs.map(r=>{
    if(!r.customer){const m=findCustomerSafe(r.nick);if(m.customer){r.customer=m.customer;r.customerId=m.customer.id;r.matchStatus=m.status}}
    return r;
  });
}
function itemRowData(x){const meta=extractMeta(x.item);return {num:String(x.number||'').replace(/^#/,''),name:meta.base,option:x.option||meta.option,qty:Number(x.qty)||0,unit:Number(x.unit)||0,amount:Number(x.amount)||0,pack:packCalc(x)}}

function receiptPage(r,items,page,totalPages,last){
  const c=r.customer||{},seller=r.items?.find(x=>x.seller)?.seller||window.__tenantCompany||state.settings?.company||'땡라이브';
  const rows=items.map(x=>{const d=itemRowData(x);return `<tr><td>#${esc(d.num)}</td><td>${esc(d.name)}</td><td>${esc(d.option)}</td><td>${d.qty}</td><td>${money(d.unit)}</td><td>${money(d.amount)}</td></tr>`}).join('');
  const footer=last?`<div class="sr-totals"><div><b>상품 합계</b><strong>${money(r.subtotal)}</strong></div><div class="fee"><b>택배비</b><strong>${money(r.fee)}</strong></div><div class="grand"><b>총 결제 금액</b><strong>${money(r.total)}</strong></div></div><div class="sr-bank">🏦 <b>입금계좌</b><span>${esc(state.settings?.bank||'')} ${esc(state.settings?.account||'')} &nbsp; 예금주 ${esc(state.settings?.holder||'')}</span></div><div class="sr-notice">❗ 입금자명은 닉네임 “${esc(r.nick)}”으로 입금 바랍니다.</div>`:'';
  return `<article class="safe-receipt"><div class="sr-page">${page}/${totalPages}</div><h1>정 산 서</h1><div class="sr-seller"><b>판매자 : ${esc(seller)}</b><span><b>주문일자</b> ${esc(r.date)}</span></div><div class="sr-customer"><div class="label">고객정보</div><div class="who"><b>${esc(c.name||r.nick)}님 / 닉네임 ${esc(r.nick)}</b></div><div class="contact">☎ 연락처 : ${esc(c.phone||'-')}<br>⌖ 주소 : ${esc([c.postalCode,c.address,c.detailAddress].filter(Boolean).join(' ')||'-')}</div></div><table><thead><tr><th>품번</th><th>품명</th><th>옵션</th><th>수량</th><th>단가</th><th>합계</th></tr></thead><tbody>${rows}</tbody></table>${footer}<div class="sr-thanks">감사합니다. 좋은 하루 되세요!<br>${esc(seller)}</div></article>`;
}
function receiptHtmlSafe(r){const items=r.items||[], per=9, pages=[];for(let i=0;i<Math.max(1,Math.ceil(items.length/per));i++)pages.push(receiptPage(r,items.slice(i*per,(i+1)*per),i+1,Math.max(1,Math.ceil(items.length/per)),i===Math.ceil(items.length/per)-1));return pages.join('')}
window.receiptHTML=receiptHtmlSafe;
window.safeReceiptHTML=receiptHtmlSafe;

window.openReceiptDetail=function(key){
  const r=receiptGroups().find(x=>x.key===key);if(!r)return alert('정산서를 찾을 수 없습니다.');
  let modal=$('receiptDetailModal');if(!modal){modal=document.createElement('div');modal.id='receiptDetailModal';modal.className='receipt-detail-modal';modal.innerHTML='<div class="receipt-detail-box"><div class="receipt-detail-actions no-print"><button class="btn warn" id="detailEditBtn">수정</button><button class="btn secondary" id="detailPrintBtn">인쇄</button><button class="btn bad" id="detailCloseBtn">닫기</button></div><div id="receiptDetailBody"></div></div>';document.body.appendChild(modal)}
  modal.classList.add('show');$('receiptDetailBody').innerHTML=receiptHtmlSafe(r);$('detailEditBtn').onclick=()=>openReceiptEditByKey(key);$('detailPrintBtn').onclick=()=>printReceiptSafe(key);$('detailCloseBtn').onclick=()=>modal.classList.remove('show');
};
window.printReceiptSafe=function(key){const r=receiptGroups().find(x=>x.key===key);if(!r)return;openPrintWindow(receiptHtmlSafe(r),'정산서',false)};
window.printOne=function(i){const r=receiptGroups()[i];if(r)printReceiptSafe(r.key)};

function shippingGroups(){
  let rs=receiptGroups();const filter=$('shippingFilter')?.value||'all';if(filter==='paid')rs=rs.filter(r=>r.payment?.status==='paid');
  const bundle=$('bundleMode')?.value||'customer',mp=new Map();
  rs.forEach(r=>{const c=r.customer||{},k=bundle==='customer'?(c.id||norm(r.nick)):r.key;if(!mp.has(k))mp.set(k,{key:r.key,name:c.name||'',nick:r.nick,phone:c.phone||'',postalCode:c.postalCode||'',address:[c.address,c.detailAddress].filter(Boolean).join(' '),dates:new Set(),items:[],seller:r.items?.find(x=>x.seller)?.seller||'',subtotal:0,fee:0,total:0,status:r.payment?.status||'unpaid'});const g=mp.get(k);g.dates.add(r.date);g.items.push(...r.items);g.subtotal+=Number(r.subtotal)||0;g.fee+=Number(r.fee)||0;g.total+=Number(r.total)||0});
  const arr=[...mp.values()].map((g,i)=>{g.code=typeof shippingCodeFor==='function'?shippingCodeFor(g):(String([...g.dates][0]||'').replaceAll('-','')+'-'+String(i+1).padStart(3,'0'));g.tracking=state.shippingScans?.[g.code]?.trackingNumber||'';g.packed=!!(state.shippingScans?.[g.code]?.packingCompletedAt||state.shippingScans?.[g.code]?.at);return g});window.currentShipping=arr;return arr;
}
function packText(x){const c=packCalc(x);return {main:`${c.actualQty}${c.actualUnit}`,detail:c.componentTotal!==c.actualQty||c.componentUnit!==c.actualUnit?`총 ${c.componentTotal}${c.componentUnit}`:`${c.componentTotal}${c.componentUnit}`}}

window.renderShipping=function(){
  const arr=shippingGroups(),box=$('shippingTable');if(!box)return;
  const kim=arr.flatMap(g=>g.items.filter(isKimchi).map(x=>({g,x,p:packText(x)})));
  let kimHtml='';if(kim.length){const sum=new Map();kim.forEach(({x,p})=>{const d=itemRowData(x),k=d.name+'|'+d.option+'|'+p.main.replace(/[0-9.]/g,'');const n=Number(p.main.match(/[0-9.]+/)?.[0]||0);if(!sum.has(k))sum.set(k,{name:d.name,opt:d.option,unit:p.main.replace(/[0-9.]/g,''),qty:0});sum.get(k).qty+=n});kimHtml=`<div class="kimchi-safe card"><b>🥬 김치리스트 · 주문고객 ${new Set(kim.map(z=>z.g.nick)).size}명</b><div>${[...sum.values()].map(z=>`${esc(z.name)}${z.opt&&z.opt!=='-'?' ('+esc(z.opt)+')':''} <strong>${z.qty}${esc(z.unit)}</strong>`).join(' · ')}</div></div>`}
  box.innerHTML=kimHtml+(arr.length?`<div class="scroll"><table class="shipping-safe"><thead><tr><th>선택</th><th>닉네임</th><th>실명</th><th>연락처</th><th>주소</th><th>판매자</th><th>송장번호</th><th>포장상태</th><th>상세</th></tr></thead><tbody>${arr.map(g=>`<tr><td><input class="safe-ship-check" type="checkbox" data-code="${esc(g.code)}"></td><td><b>${esc(g.nick)}</b></td><td>${esc(g.name||'정보없음')}</td><td>${esc(g.phone||'-')}</td><td>${esc((g.postalCode?g.postalCode+' ':'')+g.address||'-')}</td><td>${esc(g.seller||'')}</td><td><b>${esc(g.tracking||'-')}</b></td><td>${g.packed?'🟢 포장완료':'⏳ 포장대기'}</td><td><button class="btn secondary" onclick="openReceiptDetail('${esc(g.key)}')">상세보기</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">택배 대상이 없습니다.</div>');
};

function summaryRows(arr){const mp=new Map();arr.forEach(g=>(g.items||[]).forEach(x=>{const d=itemRowData(x),c=d.pack,k=[d.num,d.name,d.option,c.actualUnit].join('|');if(!mp.has(k))mp.set(k,{num:d.num,name:d.name,opt:d.option,unit:d.unit,order:0,work:0,workUnit:c.actualUnit,component:0,componentUnit:c.componentUnit,kimchi:isKimchi(x)});const z=mp.get(k);z.order+=d.qty;z.work+=c.actualQty;z.component+=c.componentTotal}));return [...mp.values()]}
function shippingSheet(g,idx,total){
 const rows=g.items.map(x=>{const d=itemRowData(x),p=packText(x);return `<tr class="${isKimchi(x)?'kimchi-row':''}"><td>#${esc(d.num)}</td><td>${esc(d.name)}</td><td>${esc(d.option)}</td><td>${d.qty}</td><td>${money(d.unit)}</td><td class="work"><b>${esc(p.main)}</b><small>(${esc(p.detail)})</small></td></tr>`}).join('');
 const totalWork=g.items.reduce((a,x)=>a+packCalc(x).actualQty,0),tracking=g.tracking||'';
 return `<section class="safe-ship-sheet"><div class="ss-page">${idx}/${total}</div><h1>택 배 리 스 트</h1><div class="ss-seller"><b>판매자 : ${esc(g.seller||window.__tenantCompany||'땡라이브')}</b><span>주문일자 : ${esc([...g.dates].join(', '))}</span></div><div class="ss-customer"><div class="label">고객정보</div><div class="who">닉네임 : <b>${esc(g.nick)}</b> / ${esc(g.name||'정보없음')}님</div><div class="contact">☎ 연락처 : ${esc(g.phone||'-')}<br>⌖ 주소 : ${esc((g.postalCode?g.postalCode+' ':'')+(g.address||'-'))}</div></div><table><thead><tr><th>품번</th><th>품명</th><th>옵션<br><small>(포장단위)</small></th><th>수량<br><small>(주문수량)</small></th><th>단가</th><th class="yellow">총 담아야 하는 수량<br><em>(작업 단위)</em></th></tr></thead><tbody>${rows}</tbody></table><div class="ss-total">📦 이 고객 총 담기 <strong>${totalWork}</strong> 작업 단위</div><div class="ss-bottom"><div><b>QR코드 스캔 후 작업 바랍니다</b><div id="safeqr-${esc(g.code)}" class="safeqr"></div><small>핸드폰 카메라로 QR코드를 스캔해주세요!<br>(포장 완료 처리 및 상태 업데이트)</small></div><div class="labelbox"><b>🚚 고객님 송장 붙혀놓는 칸</b>${tracking?`<div class="tracking">송장번호 ${esc(tracking)}</div>`:''}<div>작업 후 박스에<br>송장 스티커 붙혀주세요</div></div></div><div class="ss-foot">♥ 오늘도 안전하고 빠른 배송을 위해 잘 포장해 주세요!</div></section>`;
}
function summarySheet(arr,kimchiOnly=false){
 const rows=summaryRows(arr).filter(x=>!kimchiOnly||x.kimchi);return `<section class="safe-summary-sheet"><h1>${kimchiOnly?'🥬 김치 준비 총계표':'상품 준비 총계표'}</h1><div class="summary-note">택배팀은 <b>작업수량</b>만 보고 그대로 준비하세요.</div><table><thead><tr><th>품번</th><th>품명</th><th>옵션</th><th>단가</th><th>주문수량</th><th>작업수량</th></tr></thead><tbody>${rows.map(x=>`<tr class="${x.kimchi?'kimchi-row':''}"><td>#${esc(x.num)}</td><td>${esc(x.name)}</td><td>${esc(x.opt)}</td><td>${money(x.unit)}</td><td>${x.order}</td><td class="work"><b>${x.work}${esc(x.workUnit)}</b>${x.component!==x.work||x.componentUnit!==x.workUnit?`<small>총 ${x.component}${esc(x.componentUnit)}</small>`:''}</td></tr>`).join('')}</tbody></table>${!rows.length?'<div class="empty">대상 상품이 없습니다.</div>':''}</section>`}
function printCss(){return `<style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#111;font-family:Arial,'Noto Sans KR',sans-serif}.safe-receipt,.safe-ship-sheet,.safe-summary-sheet{width:210mm;min-height:297mm;padding:9mm 8mm;page-break-after:always;position:relative;background:#fff}.safe-receipt:last-child,.safe-ship-sheet:last-child,.safe-summary-sheet:last-child{page-break-after:auto}h1{text-align:center;font-size:38px;letter-spacing:14px;margin:0 0 18px}.sr-page,.ss-page{position:absolute;right:9mm;top:7mm}.sr-seller,.ss-seller{border:1px solid #aaa;padding:10px 12px;display:flex;justify-content:space-between}.sr-customer,.ss-customer{display:grid;grid-template-columns:100px 1fr 1.45fr;border:1px solid #aaa;border-top:0;min-height:88px}.sr-customer>div,.ss-customer>div{padding:12px;border-right:1px solid #aaa}.sr-customer>div:last-child,.ss-customer>div:last-child{border-right:0}.label{display:flex;align-items:center;justify-content:center;font-size:18px}.who{display:flex;align-items:center;font-size:20px}.who b{font-size:30px}.contact{font-size:16px;line-height:2}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:12px}th,td{border:1px solid #aaa;padding:10px 7px;text-align:center;word-break:keep-all}thead th{background:#171717;color:#fff;font-size:17px}thead th.yellow{background:#fff0a8;color:#111}thead th.yellow em{color:#d22;font-style:normal}td:nth-child(2){font-weight:700}.work{background:#fff2b2;font-size:20px}.work b{font-size:28px;color:#c20}.work small{display:block;color:#222;font-size:13px}.sr-totals{margin-top:12px;border:1px solid #999}.sr-totals>div{display:flex;justify-content:flex-end;gap:50px;padding:9px 14px;border-bottom:1px solid #aaa}.sr-totals>div:last-child{border:0}.sr-totals .fee{background:#fff4c2}.sr-totals .grand strong{font-size:28px;color:#c00}.sr-bank{margin-top:12px;background:#fff4c2;border:1px solid #aaa;padding:12px;display:flex;gap:28px}.sr-notice{margin-top:12px;border:1px solid #d44;color:#c00;padding:15px;text-align:center;font-weight:800}.sr-thanks{text-align:center;margin-top:28px;font-weight:800}.ss-total{margin-top:12px;border:1px solid #aaa;padding:10px;text-align:center;font-size:20px}.ss-total strong{font-size:36px;color:#c00;margin:0 15px}.ss-bottom{display:grid;grid-template-columns:1fr 1.3fr;gap:12px;margin-top:12px;text-align:center}.ss-bottom>div{border:1px solid #aaa;padding:10px;min-height:210px}.safeqr{height:135px;margin:10px auto}.safeqr img,.safeqr canvas{width:125px!important;height:125px!important;margin:auto}.labelbox>div{border:1px dashed #999;margin-top:14px;min-height:120px;padding:30px 10px;color:#666;font-size:18px}.labelbox .tracking{min-height:auto;border:0;margin:8px 0 0;padding:5px;color:#111;font-weight:900}.ss-foot{margin-top:10px;border:1px solid #aaa;padding:10px;text-align:center;font-size:18px}.safe-summary-sheet h1{letter-spacing:2px;font-size:30px}.summary-note{border:2px solid #111;padding:12px;text-align:center;font-size:20px}.safe-summary-sheet .kimchi-row td{color:#c00;font-weight:800}.safe-ship-sheet .kimchi-row td:nth-child(1),.safe-ship-sheet .kimchi-row td:nth-child(2),.safe-ship-sheet .kimchi-row td:nth-child(4){color:#c00;font-weight:900}@page{size:A4 portrait;margin:0}</style>`}
function openPrintWindow(body,title,qr=true){const w=window.open('','_blank');if(!w)return alert('팝업 차단을 해제해 주세요.');const qrScript=qr?'<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\\/script>':'';const qrInit=qr?`<script>window.onload=()=>{document.querySelectorAll('.safe-ship-sheet').forEach(s=>{const el=s.querySelector('.safeqr');if(el&&window.QRCode){const code=(el.id||'').replace('safeqr-','');new QRCode(el,{text:location.origin+'/packing.html?code='+encodeURIComponent(code),width:125,height:125})}});setTimeout(()=>window.print(),500)};<\\/script>`:`<script>window.onload=()=>setTimeout(()=>window.print(),300)<\\/script>`;w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title>'+qrScript+printCss()+'</head><body>'+body+qrInit+'</body></html>');w.document.close()}
window.printPackingSummaryV748=function(){const arr=shippingGroups();if(!arr.length)return alert('택배 대상이 없습니다.');openPrintWindow(summarySheet(arr)+arr.map((g,i)=>shippingSheet(g,i+1,arr.length)).join(''),'총계표 + 택배리스트',true)};
window.printShipping=function(){const arr=shippingGroups();if(!arr.length)return alert('택배 대상이 없습니다.');openPrintWindow(arr.map((g,i)=>shippingSheet(g,i+1,arr.length)).join(''),'택배리스트',true)};
window.printShippingSelectedV747=function(){const codes=new Set([...document.querySelectorAll('.safe-ship-check:checked,.v747-ship-check:checked,.v7474-ship-check:checked')].map(x=>x.dataset.code).filter(Boolean)),arr=shippingGroups().filter(g=>codes.has(g.code));if(!arr.length)return alert('출력할 고객을 체크해 주세요.');openPrintWindow(arr.map((g,i)=>shippingSheet(g,i+1,arr.length)).join(''),'선택 택배리스트',true)};
window.printKimchiListV748=function(){const arr=shippingGroups().map(g=>({...g,items:g.items.filter(isKimchi)})).filter(g=>g.items.length);if(!arr.length)return alert('김치 주문이 없습니다.');openPrintWindow(summarySheet(arr,true)+arr.map((g,i)=>shippingSheet(g,i+1,arr.length)).join(''),'김치리스트',true)};

window.toggleAllShippingPrintV747=v=>document.querySelectorAll('.safe-ship-check').forEach(x=>x.checked=v);

window.autoAnalyzePackingV770=function(show=false){
 const seen=new Map();(state.orders||[]).forEach(x=>{const num=String(x.number||'').replace(/^#/,'').trim();if(!seen.has(num))seen.set(num,x)});
 const unresolved=[],resolved=[];for(const [n,x] of seen){if(ruleByNumber(x)||inferPack(x))resolved.push(x);else unresolved.push(x)}
 const st=$('packingAutoStatusV770');if(st)st.innerHTML=`자동환산 <b>${resolved.length}</b>개 · 수기등록 필요 <b>${unresolved.length}</b>개`;
 const sel=$('packRuleProduct');if(sel){const cur=sel.value;sel.innerHTML='<option value="">수기등록할 상품 선택</option>'+unresolved.map(x=>`<option value="${esc(String(x.number||'').replace(/^#/,''))}">#${esc(String(x.number||'').replace(/^#/,''))} ${esc(extractMeta(x.item).base)}</option>`).join('');if([...sel.options].some(o=>o.value===cur))sel.value=cur}
 if(show)alert(`자동환산 ${resolved.length}개 / 수기등록 필요 ${unresolved.length}개`)
};

async function saveAllSafe(){try{localStorage.setItem(KEY,JSON.stringify(state));const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});if(!r.ok)throw new Error('HTTP '+r.status);alert('서버에 저장했습니다. 다른 컴퓨터에서도 마지막 저장값을 불러옵니다.')}catch(e){alert('서버 저장 실패: '+e.message)}}
window.saveAll=saveAllSafe;

function mountStandalone(){
 const om=$('v748PackingOps'),omM=$('omissionsMountV770');if(om&&omM&&om.parentElement!==omM)omM.appendChild(om);
 const pr=$('v750PackingRulesBox'),prM=$('packingAutoMountV770');if(pr&&prM&&pr.parentElement!==prM)prM.appendChild(pr);
 const cp=document.querySelector('.v723-courier-panel'),cpM=$('courierMountV770');if(cp&&cpM&&cp.parentElement!==cpM)cpM.appendChild(cp);
 const sh=$('shipping');if(sh){sh.querySelectorAll('.shipping-scan-box').forEach(x=>x.style.display='none');const act=sh.querySelector('.section-title .actions');if(act&&!$('safeSummaryBtn')){const mk=(id,text,fn,cls='btn secondary')=>{const b=document.createElement('button');b.id=id;b.className=cls;b.textContent=text;b.onclick=fn;act.prepend(b)};mk('safeKimchiBtn','🥬 김치리스트 출력',()=>printKimchiListV748());mk('safeSummaryBtn','총계표 출력',()=>printPackingSummaryV748(),'btn');mk('safeAllShipBtn','전체 택배리스트 출력',()=>printShipping())}}
 if(om)om.classList.add('safe-omission-page');
 autoAnalyzePackingV770(false);
}
function injectStyle(){if($('safePatchStyle'))return;const s=document.createElement('style');s.id='safePatchStyle';s.textContent=`#shipping #v748PackingOps,#shipping #v750PackingRulesBox,#shipping .v723-courier-panel{display:none!important}#omissions .safe-omission-page>.section-title:first-child,#omissions .safe-omission-page>.note:first-of-type{display:none!important}.shipping-safe{min-width:1200px}.shipping-safe th,.shipping-safe td{vertical-align:middle}.kimchi-safe{margin:10px 0;border-left:5px solid #d33}.kimchi-safe strong{color:#d33}.safe-receipt{background:#fff;color:#111;width:794px;min-height:1123px;margin:0 auto 16px;padding:34px;position:relative}.safe-receipt h1{text-align:center;font-size:40px;letter-spacing:14px}.safe-receipt table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:12px}.safe-receipt th,.safe-receipt td{border:1px solid #aaa;padding:9px;text-align:center}.safe-receipt thead th{background:#111!important;color:#fff!important;position:static!important}.safe-receipt .sr-page{position:absolute;right:34px;top:24px}.safe-receipt .sr-seller{display:flex;justify-content:space-between;border:1px solid #aaa;padding:10px}.safe-receipt .sr-customer{display:grid;grid-template-columns:90px 1fr 1.4fr;border:1px solid #aaa;border-top:0}.safe-receipt .sr-customer>div{padding:10px;border-right:1px solid #aaa}.safe-receipt .sr-customer>div:last-child{border-right:0}.safe-receipt .sr-totals{margin-top:12px;border:1px solid #aaa}.safe-receipt .sr-totals>div{display:flex;justify-content:flex-end;gap:40px;padding:8px;border-bottom:1px solid #aaa}.safe-receipt .sr-totals .fee,.safe-receipt .sr-bank{background:#fff4c2}.safe-receipt .sr-totals .grand strong{color:#c00;font-size:26px}.safe-receipt .sr-bank,.safe-receipt .sr-notice{margin-top:10px;padding:12px;border:1px solid #aaa}.safe-receipt .sr-notice{color:#c00;text-align:center}.safe-receipt .sr-thanks{text-align:center;margin-top:28px}.receipt-detail-box{max-width:900px!important}`;document.head.appendChild(s)}

async function initSafe(){injectStyle();mountStandalone();try{if(typeof syncServerCustomers==='function')await syncServerCustomers(false)}catch(e){}try{autoMatchAll();if(typeof renderReceipts==='function')renderReceipts();renderShipping()}catch(e){console.error('safe init',e)}}
document.addEventListener('DOMContentLoaded',initSafe);if(document.readyState!=='loading')setTimeout(initSafe,0);

// ===== 2026-08-24 targeted fixes: receipt/shipping/payment/courier =====
function splitCompositeOrderSafe(x){
  const raw=String(x?.item??'').trim();
  if(!raw)return [x];
  const parts=raw.split(/\s*\/\s*(?=[^/]{1,100}?\s+\d+(?:\.\d+)?\s*(?:개|봉지|봉|세트|묶음|팩|박스|켤레)\b)/i).map(v=>v.trim()).filter(Boolean);
  if(parts.length<=1)return [x];
  return parts.map((seg,i)=>{
    const qm=seg.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(개|봉지|봉|세트|묶음|팩|박스|켤레)\s*$/i);
    const qty=qm?Number(qm[1]):(i===0?(Number(x.qty)||1):1);
    const item=qm?seg.slice(0,qm.index).trim():seg;
    return {...x,id:String(x.id||'')+'__'+i,item:item||seg,qty,unit:i===0?(Number(x.unit)||0):0,amount:i===0?(Number(x.amount)||0):0,__split:true};
  });
}
function expandedItemsSafe(items){return (items||[]).flatMap(splitCompositeOrderSafe)}

const __oldItemRowData=itemRowData;
itemRowData=function(x){return __oldItemRowData(x)};

// detailed payment reconciliation
function amountSafe(v){const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?Math.round(n):0}
function payerVariantsSafe(v){
  const raw=String(v??'').normalize('NFKC').trim();
  const a=[raw];
  raw.replace(/\(([^()]*)\)|\[([^\[\]]*)\]|\{([^{}]*)\}/g,(_,x,y,z)=>{const t=(x||y||z||'').trim();if(t)a.push(t);return _});
  a.push(raw.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g,' '));
  return [...new Set(a.map(norm).filter(Boolean))];
}
function receiptAliasesSafe(r){const c=r.customer||{};return [...new Set([r.nick,c.nick,c.nickname,c.name].flatMap(payerVariantsSafe).filter(Boolean))]}
function payerMatchesSafe(payer,aliases){const ps=payerVariantsSafe(payer);return ps.some(p=>aliases.some(a=>p===a||(p.length>=2&&a.length>=2&&(p.includes(a)||a.includes(p)))))}
function paymentDateScoreSafe(p,rdate){const d=String(p?.date||p?.datetime||p?.at||'').slice(0,10);if(!d||!rdate)return 0;if(d===rdate)return 10;try{return Math.max(0,5-Math.abs((new Date(d)-new Date(rdate))/86400000))}catch(e){return 0}}

const __baseGetReceiptsSafe=window.getReceipts;
window.getReceipts=function(){
  let rs=__baseGetReceiptsSafe?__baseGetReceiptsSafe():[];
  // ensure current customer DB is reflected every time
  rs=rs.map(r=>{const m=findCustomerSafe(r.nick);if(m.customer){r.customer=m.customer;r.customerId=m.customer.id;r.matchStatus=m.status}return r});
  const used=new Set();
  for(const r of rs){
    const ov=state.paymentOverrides?.[r.key];
    if(ov?.status){r.payment={status:ov.status,payment:ov.payment||null,verified:ov.status==='paid',manual:true,reason:'관리자 수기변경'};continue}
    const aliases=receiptAliasesSafe(r), total=amountSafe(r.total);
    const named=(state.payments||[]).map((p,i)=>({p,i,amt:amountSafe(p.amount)})).filter(z=>!used.has(z.i)&&payerMatchesSafe(z.p.payer||z.p.name||z.p.depositor,aliases));
    const exact=named.filter(z=>z.amt===total).sort((a,b)=>paymentDateScoreSafe(b.p,r.date)-paymentDateScoreSafe(a.p,r.date));
    if(exact.length){const z=exact[0];used.add(z.i);r.payment={status:'paid',payment:z.p,paidAmount:z.amt,verified:true,reason:'입금자명 + 청구금액 정확일치'};continue}
    let combo=null;
    const cand=named.slice(0,10);
    for(let mask=1;mask<(1<<cand.length)&&!combo;mask++){let sum=0,sel=[];for(let j=0;j<cand.length;j++)if(mask>>j&1){sum+=cand[j].amt;sel.push(cand[j])}if(sum===total&&sel.length>1)combo=sel}
    if(combo){combo.forEach(z=>used.add(z.i));r.payment={status:'paid',payment:combo[0].p,payments:combo.map(z=>z.p),paidAmount:total,verified:true,reason:'동일 입금자 분할입금 합계 일치'};continue}
    if(named.length){const paid=named.reduce((a,z)=>a+z.amt,0);r.payment={status:'amount-mismatch',payment:named[0].p,payments:named.map(z=>z.p),paidAmount:paid,verified:false,reason:`입금자명 일치 · 청구 ${total.toLocaleString()}원 / 입금합계 ${paid.toLocaleString()}원`};continue}
    const amountOnly=(state.payments||[]).map((p,i)=>({p,i,amt:amountSafe(p.amount)})).filter(z=>!used.has(z.i)&&z.amt===total);
    if(amountOnly.length===1){r.payment={status:'review',payment:amountOnly[0].p,paidAmount:total,verified:false,reason:'금액은 일치하지만 입금자명 확인 필요'};continue}
    r.payment={status:'unpaid',verified:false,paidAmount:0};
  }
  return rs;
};

// one product per row, even when a source cell contains multiple products
receiptPage=function(r,items,page,totalPages,last){
  items=expandedItemsSafe(items);
  const c=r.customer||{},seller=r.items?.find(x=>x.seller)?.seller||window.__tenantCompany||state.settings?.company||'땡라이브';
  const rows=items.map(x=>{const d=itemRowData(x);return `<tr><td>#${esc(d.num)}</td><td>${esc(d.name)}</td><td>${esc(d.option)}</td><td>${d.qty}</td><td>${money(d.unit)}</td><td>${money(d.amount)}</td></tr>`}).join('');
  const footer=last?`<div class="sr-totals"><div><b>상품 합계</b><strong>${money(r.subtotal)}</strong></div><div class="fee"><b>택배비</b><strong>${money(r.fee)}</strong></div><div class="grand"><b>총 결제 금액</b><strong>${money(r.total)}</strong></div></div><div class="sr-bank">🏦 <b>입금계좌</b><span>${esc(state.settings?.bank||'')} ${esc(state.settings?.account||'')} &nbsp; 예금주 ${esc(state.settings?.holder||'')}</span></div><div class="sr-notice">❗ 입금자명은 닉네임 “${esc(r.nick)}”으로 입금 바랍니다.</div>`:'';
  return `<article class="safe-receipt"><div class="sr-page">${page}/${totalPages}</div><h1>정 산 서</h1><div class="sr-seller"><b>판매자 : ${esc(seller)}</b><span><b>주문일자</b> ${esc(r.date)}</span></div><div class="sr-customer"><div class="label">고객정보</div><div class="who"><span>닉네임 : </span><b>${esc(r.nick)}</b><small> / ${esc(c.name||'정보없음')}님</small></div><div class="contact">☎ 연락처 : ${esc(c.phone||'-')}<br>⌖ 주소 : ${esc([c.postalCode,c.address,c.detailAddress].filter(Boolean).join(' ')||'-')}</div></div><table><thead><tr><th>품번</th><th>품명</th><th>옵션</th><th>수량</th><th>단가</th><th>합계</th></tr></thead><tbody>${rows}</tbody></table>${footer}<div class="sr-thanks">감사합니다. 좋은 하루 되세요!<br>${esc(seller)}</div></article>`;
};
receiptHtmlSafe=function(r){const items=expandedItemsSafe(r.items||[]),per=9,pages=[],n=Math.max(1,Math.ceil(items.length/per));for(let i=0;i<n;i++)pages.push(receiptPage({...r,items},items.slice(i*per,(i+1)*per),i+1,n,i===n-1));return pages.join('')};
window.receiptHTML=receiptHtmlSafe;window.safeReceiptHTML=receiptHtmlSafe;

// shipping sheets: receipt-like customer information and stable print
function shippingByCodeSafe(code){return shippingGroups().find(g=>g.code===code)}
shippingSheet=function(g,idx,total){
 const items=expandedItemsSafe(g.items||[]);
 const rows=items.map(x=>{const d=itemRowData(x),p=packText(x);return `<tr class="${isKimchi(x)?'kimchi-row':''}"><td>#${esc(d.num)}</td><td>${esc(d.name)}</td><td>${esc(d.option)}</td><td>${d.qty}</td><td>${money(d.unit)}</td><td class="work"><b>${esc(p.main)}</b><small>(${esc(p.detail)})</small></td></tr>`}).join('');
 const totalWork=items.reduce((a,x)=>a+(Number(packCalc(x).actualQty)||0),0),tracking=g.tracking||'';
 return `<section class="safe-ship-sheet"><div class="ss-page">${idx}/${total}</div><h1>택 배 리 스 트</h1><div class="ss-seller"><b>판매자 : ${esc(g.seller||window.__tenantCompany||'땡라이브')}</b><span>주문일자 : ${esc([...g.dates].join(', '))}</span></div><div class="ss-customer"><div class="label">고객정보</div><div class="who"><span>닉네임 : </span><b>${esc(g.nick)}</b><small> / ${esc(g.name||'정보없음')}님</small></div><div class="contact">☎ 연락처 : ${esc(g.phone||'-')}<br>⌖ 주소 : ${esc((g.postalCode?g.postalCode+' ':'')+(g.address||'-'))}</div></div><table><thead><tr><th>품번</th><th>품명</th><th>옵션<br><small>(포장단위)</small></th><th>수량<br><small>(주문수량)</small></th><th>단가</th><th class="yellow">총 담아야 하는 수량<br><em>(작업 단위)</em></th></tr></thead><tbody>${rows}</tbody></table><div class="ss-total">📦 이 고객 총 담기 <strong>${totalWork}</strong> 작업 단위</div><div class="ss-bottom"><div><b>QR코드 스캔 후 작업 바랍니다</b><div class="safeqr"><img src="/qr_first.png" alt="QR"></div><small>핸드폰 카메라로 QR코드를 스캔해주세요!<br>(포장 완료 처리 및 상태 업데이트)</small></div><div class="labelbox"><b>🚚 고객님 송장 붙혀놓는 칸</b>${tracking?`<div class="tracking">송장번호 ${esc(tracking)}</div>`:''}<div>작업 후 박스에<br>송장 스티커 붙혀주세요</div></div></div><div class="ss-foot">♥ 오늘도 안전하고 빠른 배송을 위해 잘 포장해 주세요!</div></section>`;
};
window.openShippingDetailSafe=function(code){const g=shippingByCodeSafe(code);if(!g)return alert('택배리스트를 찾을 수 없습니다.');let m=$('shippingDetailSafeModal');if(!m){m=document.createElement('div');m.id='shippingDetailSafeModal';m.className='receipt-detail-modal';m.innerHTML='<div class="receipt-detail-box"><div class="receipt-detail-actions no-print"><button class="btn secondary" id="shipPrintSafeBtn">인쇄</button><button class="btn bad" id="shipCloseSafeBtn">닫기</button></div><div id="shipDetailSafeBody"></div></div>';document.body.appendChild(m)}m.classList.add('show');$('shipDetailSafeBody').innerHTML=shippingSheet(g,1,1);$('shipPrintSafeBtn').onclick=()=>openPrintWindow(shippingSheet(g,1,1),'택배리스트',false);$('shipCloseSafeBtn').onclick=()=>m.classList.remove('show')};

const __oldRenderShippingSafe=window.renderShipping;
window.renderShipping=function(){
 const arr=shippingGroups(),box=$('shippingTable');if(!box)return;
 const kim=arr.flatMap(g=>g.items.filter(isKimchi).map(x=>({g,x,p:packText(x)})));
 let kimHtml='';if(kim.length){const sum=new Map();kim.forEach(({x,p})=>{const d=itemRowData(x),k=d.name+'|'+d.option+'|'+p.main.replace(/[0-9.]/g,''),n=Number(p.main.match(/[0-9.]+/)?.[0]||0);if(!sum.has(k))sum.set(k,{name:d.name,opt:d.option,unit:p.main.replace(/[0-9.]/g,''),qty:0});sum.get(k).qty+=n});kimHtml=`<div class="kimchi-safe card"><b>🥬 김치리스트 · 주문고객 ${new Set(kim.map(z=>z.g.nick)).size}명</b><div>${[...sum.values()].map(z=>`${esc(z.name)}${z.opt&&z.opt!=='-'?' ('+esc(z.opt)+')':''} <strong>${z.qty}${esc(z.unit)}</strong>`).join(' · ')}</div></div>`}
 box.innerHTML=kimHtml+(arr.length?`<div class="scroll"><table class="shipping-safe"><thead><tr><th>선택</th><th>닉네임</th><th>실명</th><th>연락처</th><th>주소</th><th>판매자</th><th>송장번호</th><th>포장상태</th><th>상세</th></tr></thead><tbody>${arr.map(g=>`<tr><td><input class="safe-ship-check" type="checkbox" data-code="${esc(g.code)}"></td><td class="ship-nick"><b>${esc(g.nick)}</b></td><td>${esc(g.name||'정보없음')}</td><td>${esc(g.phone||'-')}</td><td>${esc((g.postalCode?g.postalCode+' ':'')+(g.address||'-'))}</td><td>${esc(g.seller||'')}</td><td><b>${esc(g.tracking||'-')}</b></td><td>${g.packed?'🟢 포장완료':'⏳ 포장대기'}</td><td><button class="btn secondary" onclick="openShippingDetailSafe('${esc(g.code)}')">택배리스트 보기</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">택배 대상이 없습니다.</div>');
};

// courier automation page must always contain its controls
function ensureCourierPanelSafe(){const mount=$('courierMountV770');if(!mount)return;let panel=document.querySelector('.v723-courier-panel');if(panel&&panel.parentElement!==mount)mount.appendChild(panel);if(panel)panel.style.setProperty('display','block','important');if(!panel||!mount.contains(panel)){mount.innerHTML='<div class="card"><div class="empty">택배사 설정 화면을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.</div></div>'}}
const __oldMountStandaloneSafe=mountStandalone;mountStandalone=function(){__oldMountStandaloneSafe();ensureCourierPanelSafe()};

// stronger visual reset so table body never becomes black/invisible
(function addTargetedStyle(){const st=document.createElement('style');st.id='safeTargetedFixStyle';st.textContent=`
.safe-receipt tbody td,.safe-ship-sheet tbody td{background:#fff!important;color:#111!important}
.safe-receipt tbody tr,.safe-ship-sheet tbody tr{background:#fff!important}
.safe-receipt .who,.safe-ship-sheet .who{display:flex!important;align-items:center!important;gap:6px!important;flex-wrap:wrap!important}
.safe-receipt .who>b,.safe-ship-sheet .who>b{font-size:32px!important;color:#111!important}
.safe-receipt .who small,.safe-ship-sheet .who small{font-size:16px!important;color:#333!important}
.shipping-safe .ship-nick b{font-size:20px!important}
#courierauto .v723-courier-panel{display:block!important}
.safeqr img{display:block!important;width:125px!important;height:125px!important;margin:8px auto!important}
@media print{.safe-receipt,.safe-ship-sheet,.safe-summary-sheet{display:block!important;visibility:visible!important;background:#fff!important;color:#111!important}.safe-receipt *, .safe-ship-sheet *, .safe-summary-sheet *{visibility:visible!important}}
`;document.head.appendChild(st)})();


// ===== MINIMAL PATCH: receipt width/page nav, fixed shipping view, reliable print, courier fields, dated server save =====
function receiptPagesForModalSafe(r){
  const items=expandedItemsSafe(r.items||[]), per=9, n=Math.max(1,Math.ceil(items.length/per)), pages=[];
  for(let i=0;i<n;i++) pages.push(receiptPage({...r,items},items.slice(i*per,(i+1)*per),i+1,n,i===n-1));
  return pages;
}

window.openReceiptDetail=function(key){
  const r=receiptGroups().find(x=>x.key===key); if(!r)return alert('정산서를 찾을 수 없습니다.');
  const pages=receiptPagesForModalSafe(r); let pos=0;
  let modal=$('receiptDetailModal');
  if(!modal){
    modal=document.createElement('div'); modal.id='receiptDetailModal'; modal.className='receipt-detail-modal';
    modal.innerHTML='<div class="receipt-detail-box"><div class="receipt-detail-actions no-print"><button class="btn warn" id="detailEditBtn">수정</button><button class="btn secondary" id="detailPrevBtn">◀</button><b id="detailPageNav" style="min-width:70px;text-align:center"></b><button class="btn secondary" id="detailNextBtn">▶</button><button class="btn secondary" id="detailPrintBtn">인쇄</button><button class="btn bad" id="detailCloseBtn">닫기</button></div><div id="receiptDetailBody"></div></div>';
    document.body.appendChild(modal);
  }
  const body=$('receiptDetailBody'), nav=$('detailPageNav'), prev=$('detailPrevBtn'), next=$('detailNextBtn');
  const draw=()=>{body.innerHTML=pages[pos]; nav.textContent=`< ${pos+1}/${pages.length} >`; prev.disabled=pos===0; next.disabled=pos===pages.length-1;};
  modal.classList.add('show'); draw();
  $('detailEditBtn').onclick=()=>openReceiptEditByKey(key);
  prev.onclick=()=>{if(pos>0){pos--;draw()}}; next.onclick=()=>{if(pos<pages.length-1){pos++;draw()}};
  $('detailPrintBtn').onclick=()=>printReceiptSafe(key); $('detailCloseBtn').onclick=()=>modal.classList.remove('show');
};

// Make the on-screen shipping detail use exactly the same receipt-style sheet as print.
window.openShippingDetailSafe=function(code){
  const g=shippingByCodeSafe(code); if(!g)return alert('택배리스트를 찾을 수 없습니다.');
  let m=$('shippingDetailSafeModal');
  if(!m){m=document.createElement('div');m.id='shippingDetailSafeModal';m.className='receipt-detail-modal';m.innerHTML='<div class="receipt-detail-box"><div class="receipt-detail-actions no-print"><button class="btn secondary" id="shipPrintSafeBtn">인쇄</button><button class="btn bad" id="shipCloseSafeBtn">닫기</button></div><div id="shipDetailSafeBody"></div></div>';document.body.appendChild(m)}
  m.classList.add('show'); $('shipDetailSafeBody').innerHTML=shippingSheet(g,1,1);
  $('shipPrintSafeBtn').onclick=()=>openPrintWindow(shippingSheet(g,1,1),'택배리스트',false);
  $('shipCloseSafeBtn').onclick=()=>m.classList.remove('show');
};

// Replace blank about:blank print behavior with a fully written document and wait for images before print.
openPrintWindow=function(body,title,qr=true){
  const w=window.open('','_blank'); if(!w)return alert('팝업 차단을 해제해 주세요.');
  const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title>'+printCss()+'</head><body>'+body+'</body></html>';
  try{w.document.open();w.document.write(html);w.document.close();}catch(e){try{w.document.documentElement.innerHTML=html}catch(_){return alert('인쇄 화면 생성 실패: '+e.message)}}
  const doPrint=()=>{try{w.focus();w.print()}catch(e){alert('인쇄 실행 실패: '+e.message)}};
  const wait=()=>{const imgs=[...w.document.images]; if(w.document.readyState==='complete'&&imgs.every(i=>i.complete))setTimeout(doPrint,350); else setTimeout(wait,120)};
  setTimeout(wait,120);
};
window.openPrintWindow=openPrintWindow;

// Courier export: name / phone / address / fixed item / fixed message only. Never mix name into phone/address.
function courierCustomerSafe(g){
  const hit=findCustomerSafe(g.nick||g.name||'')?.customer||{};
  const name=String(hit.name||g.name||g.nick||'').trim();
  const rawPhone=String(hit.phone||g.phone||'');
  const m=rawPhone.match(/01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/);
  let ph=m?m[0].replace(/\D/g,''):rawPhone.replace(/\D/g,'');
  if(ph.length===11)ph=ph.replace(/(\d{3})(\d{4})(\d{4})/,'$1-$2-$3'); else if(ph.length===10)ph=ph.replace(/(\d{3})(\d{3})(\d{4})/,'$1-$2-$3');
  const addr=[hit.address||g.address||'',hit.detailAddress||''].map(v=>String(v).trim()).filter(Boolean).join(' ').replace(/^\s*[^\d가-힣]*$/,'').trim();
  const postal=String(hit.postalCode||g.postalCode||'').trim();
  return {name,phone:ph,address:addr,postal};
}
window.downloadCourierUploadFile=function(){
  const headers=state.settings?.courier?.templateHeaders||[]; if(!headers.length)return alert('먼저 택배사 송장 양식 파일을 업로드해 주세요.');
  const groups=shippingPaidGroups(); if(!groups.length)return alert('입금완료된 택배 대상이 없습니다.');
  const value=(h,g)=>{const n=norm(h),c=courierCustomerSafe(g); if(/받는분|수하인|수취인|고객명|성명|이름/.test(n))return c.name; if(/전화|휴대폰|연락처|핸드폰|수하인전화|받는분전화/.test(n))return c.phone; if(/우편/.test(n))return c.postal; if(/주소|배송지/.test(n))return c.address; if(/내품명|상품명|품명/.test(n))return '잡화'; if(/배송메시지|배송메세지|배송메모|요청사항|메모/.test(n))return '안전한배송 부탁드려요'; return ''};
  const rows=groups.map(g=>Object.fromEntries(headers.map(h=>[h,value(h,g)])));
  const ws=XLSX.utils.json_to_sheet(rows,{header:headers}), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'송장접수');
  XLSX.writeFile(wb,`FIRST_OMS_${state.settings?.courier?.company||'택배사'}_송장접수_${new Date().toISOString().slice(0,10)}.xlsx`);
};

// Main Save button: choose a date, confirm, then persist that dated snapshot to server.
async function commitDatedSaveSafe(date){
  try{
    const clone=JSON.parse(JSON.stringify(state)); delete clone.savedSnapshots;
    state.savedSnapshots=state.savedSnapshots||{}; state.savedSnapshots[date]=clone; state.lastSavedDate=date;
    localStorage.setItem(KEY,JSON.stringify(state));
    const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)}); if(!r.ok)throw new Error('HTTP '+r.status);
    alert(date.replace(/-/g,'.')+' 정보로 서버에 저장했습니다.');
  }catch(e){alert('서버 저장 실패: '+e.message)}
}
function openDatedSaveSafe(){
  let m=$('datedSaveSafeModal'); if(!m){m=document.createElement('div');m.id='datedSaveSafeModal';m.className='receipt-detail-modal';m.innerHTML='<div class="receipt-detail-box" style="max-width:420px!important;min-height:0!important"><h3 style="margin-top:0">저장 날짜 선택</h3><input id="datedSaveSafeInput" type="date" style="width:100%;padding:12px;font-size:18px"><div class="actions" style="margin-top:15px;justify-content:flex-end"><button class="btn secondary" id="datedSaveCancel">취소</button><button class="btn" id="datedSaveOk">저장</button></div></div>';document.body.appendChild(m)}
  const inp=$('datedSaveSafeInput'); inp.value=new Date().toISOString().slice(0,10); m.classList.add('show');
  $('datedSaveCancel').onclick=()=>m.classList.remove('show'); $('datedSaveOk').onclick=async()=>{const d=inp.value;if(!d)return alert('날짜를 선택해 주세요.');const [y,mo,da]=d.split('-');if(!confirm(`${y}년 ${mo}월 ${da}일 정보로 저장할까요?`))return;m.classList.remove('show');await commitDatedSaveSafe(d)};
}
window.saveAll=openDatedSaveSafe;

(function addMinimalLayoutFixCss(){
  let st=$('minimalLayoutFixCss'); if(st)st.remove(); st=document.createElement('style'); st.id='minimalLayoutFixCss'; st.textContent=`
.receipt-detail-box{width:min(94vw,860px)!important;max-width:860px!important;overflow-x:hidden!important}
#receiptDetailBody,#shipDetailSafeBody{overflow-x:hidden!important;width:100%!important}
#receiptDetailBody .safe-receipt,#shipDetailSafeBody .safe-ship-sheet{width:100%!important;max-width:794px!important;min-width:0!important;min-height:auto!important;margin:0 auto 16px!important;padding:24px!important;box-sizing:border-box!important;background:#fff!important;color:#111!important}
#receiptDetailBody .safe-receipt table,#shipDetailSafeBody .safe-ship-sheet table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important}
#receiptDetailBody .safe-receipt th,#receiptDetailBody .safe-receipt td,#shipDetailSafeBody .safe-ship-sheet th,#shipDetailSafeBody .safe-ship-sheet td{padding:8px 5px!important;word-break:break-word!important;overflow-wrap:anywhere!important;color:#111}
#receiptDetailBody .safe-receipt thead th,#shipDetailSafeBody .safe-ship-sheet thead th{background:#171717!important;color:#fff!important}
#receiptDetailBody .safe-receipt th:nth-child(1){width:15%!important}#receiptDetailBody .safe-receipt th:nth-child(2){width:23%!important}#receiptDetailBody .safe-receipt th:nth-child(3){width:21%!important}#receiptDetailBody .safe-receipt th:nth-child(4){width:9%!important}#receiptDetailBody .safe-receipt th:nth-child(5){width:15%!important}#receiptDetailBody .safe-receipt th:nth-child(6){width:17%!important}
#shipDetailSafeBody .safe-ship-sheet h1{text-align:center!important;font-size:38px!important;letter-spacing:14px!important;margin:0 0 18px!important}
#shipDetailSafeBody .ss-seller{border:1px solid #aaa!important;padding:10px 12px!important;display:flex!important;justify-content:space-between!important}
#shipDetailSafeBody .ss-customer{display:grid!important;grid-template-columns:100px 1fr 1.45fr!important;border:1px solid #aaa!important;border-top:0!important;min-height:88px!important}
#shipDetailSafeBody .ss-customer>div{padding:12px!important;border-right:1px solid #aaa!important}#shipDetailSafeBody .ss-customer>div:last-child{border-right:0!important}
#shipDetailSafeBody .safe-ship-sheet th:nth-child(1){width:13%!important}#shipDetailSafeBody .safe-ship-sheet th:nth-child(2){width:19%!important}#shipDetailSafeBody .safe-ship-sheet th:nth-child(3){width:19%!important}#shipDetailSafeBody .safe-ship-sheet th:nth-child(4){width:11%!important}#shipDetailSafeBody .safe-ship-sheet th:nth-child(5){width:15%!important}#shipDetailSafeBody .safe-ship-sheet th:nth-child(6){width:23%!important}
#shipDetailSafeBody .work{background:#fff2b2!important}#shipDetailSafeBody .work b{font-size:25px!important;color:#c20!important}#shipDetailSafeBody .work small{display:block!important;color:#222!important}
#shipDetailSafeBody .ss-total{margin-top:12px!important;border:1px solid #aaa!important;padding:10px!important;text-align:center!important;font-size:20px!important}#shipDetailSafeBody .ss-total strong{font-size:36px!important;color:#c00!important;margin:0 15px!important}
#shipDetailSafeBody .ss-bottom{display:grid!important;grid-template-columns:1fr 1.3fr!important;gap:12px!important;margin-top:12px!important;text-align:center!important}#shipDetailSafeBody .ss-bottom>div{border:1px solid #aaa!important;padding:10px!important;min-height:210px!important}.labelbox>div{border:1px dashed #999!important;margin-top:14px!important;min-height:120px!important;padding:30px 10px!important;color:#666!important}.ss-foot{margin-top:10px!important;border:1px solid #aaa!important;padding:10px!important;text-align:center!important}
`;
  document.head.appendChild(st);
})();



// ===== FINAL FOCUSED FIX: A4 pagination, fixed shipping sheet, reliable print, packing QR, kimchi/summary, courier fields =====
function safePackBaseUrl(){
  return (async()=>{let base=location.origin+'/packing.html?tenant='+encodeURIComponent(window.__tenantCode||'FIRST-0001');try{const r=await fetch('/api/packing/access-link',{cache:'no-store'}),d=await r.json();if(r.ok&&d.ok&&d.url)base=location.origin+d.url}catch(e){}return base})();
}
function splitPagesSafe(items,per){const a=Array.isArray(items)?items:[];const n=Math.max(1,Math.ceil(a.length/per));return Array.from({length:n},(_,i)=>a.slice(i*per,(i+1)*per))}

function receiptPageFinal(r,items,page,total,last){
  const c=r.customer||{}, seller=window.__tenantCompany||state.settings?.company||'땡라이브';
  const rows=items.map(x=>{const d=itemRowData(x);return `<tr><td>#${esc(d.num)}</td><td>${esc(d.name)}</td><td>${esc(d.option)}</td><td>${d.qty}</td><td>${money(d.unit)}</td><td>${money(d.amount)}</td></tr>`}).join('');
  const footer=last?`<div class="sr-totals"><div><b>상품 합계</b><strong>${money(r.subtotal)}</strong></div><div class="fee"><b>택배비</b><strong>${money(r.fee)}</strong></div><div class="grand"><b>총 결제 금액</b><strong>${money(r.total)}</strong></div></div><div class="sr-bank"><b>입금계좌</b><span>${esc(state.settings?.bank||'카카오뱅크')} ${esc(state.settings?.account||'')} 예금주 ${esc(state.settings?.holder||'')}</span></div><div class="sr-notice">입금자명은 닉네임 “${esc(r.nick)}”으로 입금 바랍니다.</div>`:'';
  const title=total>1?`${esc(r.nick)}님 정산서 ${page}/${total}`:'정 산 서';
  return `<article class="safe-receipt final-a4"><div class="sr-page">${page}/${total}</div><h1>${title}</h1><div class="sr-seller"><b>판매자 : ${esc(seller)}</b><span><b>주문일자</b> ${esc(r.date)}</span></div><div class="sr-customer"><div class="label">고객정보</div><div class="who"><b>${esc(r.nick)}</b><small> / ${esc(c.name||'정보없음')}님</small></div><div class="contact">☎ 연락처 : ${esc(c.phone||'-')}<br>⌖ 주소 : ${esc([c.postalCode,c.address,c.detailAddress].filter(Boolean).join(' ')||'-')}</div></div><table><colgroup><col style="width:15%"><col style="width:23%"><col style="width:21%"><col style="width:9%"><col style="width:15%"><col style="width:17%"></colgroup><thead><tr><th>품번</th><th>품명</th><th>옵션</th><th>수량</th><th>단가</th><th>합계</th></tr></thead><tbody>${rows}</tbody></table>${footer}${last?`<div class="sr-thanks">감사합니다. 좋은 하루 되세요!<br>${esc(seller)}</div>`:''}</article>`;
}
function receiptHtmlFinal(r){const pages=splitPagesSafe(r.items,11);return pages.map((it,i)=>receiptPageFinal(r,it,i+1,pages.length,i===pages.length-1)).join('')}
window.receiptHTML=receiptHtmlFinal;window.safeReceiptHTML=receiptHtmlFinal;
window.openReceiptDetail=function(key){const r=receiptGroups().find(x=>x.key===key);if(!r)return alert('정산서를 찾을 수 없습니다.');const pages=splitPagesSafe(r.items,11);let pos=0,m=$('receiptDetailModal');if(!m){m=document.createElement('div');m.id='receiptDetailModal';m.className='receipt-detail-modal';m.innerHTML='<div class="receipt-detail-box"><div class="receipt-detail-actions no-print"><button class="btn warn" id="detailEditBtn">수정</button><button class="btn secondary" id="detailPrevBtn">◀</button><b id="detailPageNav"></b><button class="btn secondary" id="detailNextBtn">▶</button><button class="btn secondary" id="detailPrintBtn">인쇄</button><button class="btn bad" id="detailCloseBtn">닫기</button></div><div id="receiptDetailBody"></div></div>';document.body.appendChild(m)}m.classList.add('show');const draw=()=>{$('receiptDetailBody').innerHTML=receiptPageFinal(r,pages[pos],pos+1,pages.length,pos===pages.length-1);$('detailPageNav').textContent=`< ${pos+1}/${pages.length} >`;$('detailPrevBtn').disabled=pos===0;$('detailNextBtn').disabled=pos===pages.length-1};draw();$('detailPrevBtn').onclick=()=>{if(pos>0){pos--;draw()}};$('detailNextBtn').onclick=()=>{if(pos<pages.length-1){pos++;draw()}};$('detailEditBtn').onclick=()=>openReceiptEditByKey(key);$('detailPrintBtn').onclick=()=>printReceiptSafe(key);$('detailCloseBtn').onclick=()=>m.classList.remove('show')};

function shippingPagesFinal(g){const chunks=splitPagesSafe(g.items,9);return chunks.map((items,i)=>shippingSheetFinal({...g,items},i+1,chunks.length)).join('')}
function shippingSheetFinal(g,idx,total){const rows=(g.items||[]).map(x=>{const d=itemRowData(x),p=packText(x);return `<tr class="${isKimchi(x)?'kimchi-row':''}"><td>#${esc(d.num)}</td><td>${esc(d.name)}</td><td>${esc(d.option)}</td><td>${d.qty}</td><td>${money(d.unit)}</td><td class="work"><b>${esc(p.main)}</b><small>(${esc(p.detail)})</small></td></tr>`}).join('');const totalWork=(g.items||[]).reduce((a,x)=>a+(Number(itemRowData(x).pack.actualQty)||0),0),tracking=g.tracking||state.shippingScans?.[g.code]?.trackingNumber||'';return `<section class="safe-ship-sheet final-a4"><div class="ss-page">${idx}/${total}</div><h1>${total>1?`${esc(g.nick)}님 택배리스트 ${idx}/${total}`:'택 배 리 스 트'}</h1><div class="ss-seller"><b>판매자 : ${esc(g.seller||window.__tenantCompany||'땡라이브')}</b><span>주문일자 : ${esc([...g.dates].join(', '))}</span></div><div class="ss-customer"><div class="label">고객정보</div><div class="who">닉네임 : <b>${esc(g.nick)}</b><small> / ${esc(g.name||'정보없음')}님</small></div><div class="contact">☎ 연락처 : ${esc(g.phone||'-')}<br>⌖ 주소 : ${esc((g.postalCode?g.postalCode+' ':'')+(g.address||'-'))}</div></div><table><colgroup><col style="width:13%"><col style="width:19%"><col style="width:19%"><col style="width:11%"><col style="width:15%"><col style="width:23%"></colgroup><thead><tr><th>품번</th><th>품명</th><th>옵션<br><small>(포장단위)</small></th><th>수량<br><small>(주문수량)</small></th><th>단가</th><th class="yellow">총 담아야 하는 수량<br><em>(작업 단위)</em></th></tr></thead><tbody>${rows}</tbody></table>${idx===total?`<div class="ss-total">📦 이 고객 총 담기 <strong>${totalWork}</strong> 작업 단위</div><div class="ss-bottom"><div><b>QR코드 스캔 후 작업 바랍니다</b><div class="safeqr" data-pack-code="${esc(g.code)}"></div><small>포장작업 화면으로 연결됩니다.<br>(포장 완료 처리 및 상태 업데이트)</small></div><div class="labelbox"><b>🚚 고객님 송장 붙혀놓는 칸</b>${tracking?`<div class="tracking">송장번호 ${esc(tracking)}</div>`:''}<div>작업 후 박스에<br>송장 스티커 붙혀주세요</div></div></div><div class="ss-foot">♥ 오늘도 안전하고 빠른 배송을 위해 잘 포장해 주세요!</div>`:''}</section>`}
window.shippingSheet=shippingSheetFinal;
window.openShippingDetailSafe=function(code){const g=shippingByCodeSafe(code);if(!g)return alert('택배리스트를 찾을 수 없습니다.');let m=$('shippingDetailSafeModal');if(!m){m=document.createElement('div');m.id='shippingDetailSafeModal';m.className='receipt-detail-modal';m.innerHTML='<div class="receipt-detail-box"><div class="receipt-detail-actions no-print"><button class="btn secondary" id="shipPrintSafeBtn">인쇄</button><button class="btn bad" id="shipCloseSafeBtn">닫기</button></div><div id="shipDetailSafeBody"></div></div>';document.body.appendChild(m)}m.classList.add('show');$('shipDetailSafeBody').innerHTML=shippingPagesFinal(g);renderPackingQrsIn(document.getElementById('shipDetailSafeBody'));$('shipPrintSafeBtn').onclick=()=>printShippingGroupsFinal([g],'택배리스트');$('shipCloseSafeBtn').onclick=()=>m.classList.remove('show')};

async function renderPackingQrsIn(root){if(!root)return;const base=await safePackBaseUrl();root.querySelectorAll('.safeqr[data-pack-code]').forEach(el=>{el.innerHTML='';if(window.QRCode)new QRCode(el,{text:base+'&code='+encodeURIComponent(el.dataset.packCode||''),width:125,height:125})})}
async function printHtmlFinal(body,title){
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-100000px;top:0;width:210mm;background:#fff;z-index:-1';host.innerHTML=body;document.body.appendChild(host);await renderPackingQrsIn(host);await new Promise(r=>setTimeout(r,250));
  const w=window.open('','_blank');if(!w){host.remove();return alert('팝업 차단을 해제해 주세요.')}
  const clone=host.innerHTML;host.remove();w.document.open();w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title>'+printCss()+`<style>@page{size:A4 portrait;margin:0}.final-a4{width:210mm!important;min-height:297mm!important;max-height:297mm!important;overflow:hidden!important;padding:8mm!important}.final-a4 table{font-size:13px!important}.final-a4 th,.final-a4 td{padding:7px 5px!important}.final-a4 h1{font-size:31px!important;margin-bottom:12px!important}.safeqr img,.safeqr canvas{width:125px!important;height:125px!important}</style>`+'</head><body>'+clone+'</body></html>');w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch(e){alert('인쇄 실행 실패: '+e.message)}},500)
}
window.openPrintWindow=(body,title)=>printHtmlFinal(body,title);
window.printReceiptSafe=function(key){const r=receiptGroups().find(x=>x.key===key);if(r)return printHtmlFinal(receiptHtmlFinal(r),'정산서')};
async function printShippingGroupsFinal(arr,title){if(!arr?.length)return alert('출력할 고객이 없습니다.');return printHtmlFinal(arr.map(g=>shippingPagesFinal(g)).join(''),title)}
window.printShipping=function(){renderShipping();return printShippingGroupsFinal([...(window.currentShipping||[])],'택배리스트')};
window.printShippingSelectedV747=function(){renderShipping();const checks=[...document.querySelectorAll('.safe-ship-check:checked,.v747-ship-check:checked,.v7474-ship-check:checked')];const codes=new Set(checks.map(x=>x.dataset.code||x.closest('tr')?.querySelector('.shipping-code')?.textContent?.trim()).filter(Boolean));const a=(window.currentShipping||[]).filter(g=>codes.has(g.code));if(!a.length)return alert('출력할 고객을 체크해 주세요.');return printShippingGroupsFinal(a,'선택 택배리스트')};
window.printPackingSummaryV748=function(){renderShipping();const arr=[...(window.currentShipping||[])];return printHtmlFinal(summarySheet(arr,false),'상품 준비 총계표')};
window.printKimchiListV748=function(){renderShipping();const arr=[...(window.currentShipping||[])],kim=arr.map(g=>({...g,items:(g.items||[]).filter(isKimchi)})).filter(g=>g.items.length);if(!kim.length)return alert('김치 주문이 없습니다.');const body=summarySheet(kim,true)+kim.map(g=>shippingPagesFinal(g)).join('');return printHtmlFinal(body,'김치 전용 리스트')};

// Courier export: prioritize phone/address header recognition before generic name tokens.
window.downloadCourierUploadFile=function(){const headers=state.settings?.courier?.templateHeaders||[];if(!headers.length)return alert('먼저 택배사 송장 양식 파일을 업로드해 주세요.');const groups=shippingPaidGroups();if(!groups.length)return alert('입금완료된 택배 대상이 없습니다.');const value=(h,g)=>{const raw=String(h||''),n=norm(raw),c=courierCustomerSafe(g);if(/전화|휴대폰|연락처|핸드폰/.test(raw))return c.phone;if(/우편/.test(raw))return c.postal;if(/주소|배송지/.test(raw))return c.address;if(/내품명|상품명|품명/.test(raw))return '잡화';if(/배송메시지|배송메세지|배송메모|요청사항|메모/.test(raw))return '안전한배송 부탁드려요';if(/^(받는분|수하인|수취인|고객명|성명|이름)$/.test(raw.trim())||/받는분성명|수하인성명|수취인성명/.test(raw))return c.name;return ''};const rows=groups.map(g=>Object.fromEntries(headers.map(h=>[h,value(h,g)])));const ws=XLSX.utils.json_to_sheet(rows,{header:headers}),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'송장접수');XLSX.writeFile(wb,`FIRST_OMS_${state.settings?.courier?.company||'택배사'}_송장접수_${new Date().toISOString().slice(0,10)}.xlsx`)};

(function finalFixCss(){let st=$('finalFocusedFixCss');if(st)st.remove();st=document.createElement('style');st.id='finalFocusedFixCss';st.textContent=`
#receiptDetailBody .safe-receipt,#shipDetailSafeBody .safe-ship-sheet{width:100%!important;max-width:794px!important;margin:0 auto 12px!important;overflow:hidden!important}
#receiptDetailBody table,#shipDetailSafeBody table{width:100%!important;table-layout:fixed!important}
#receiptDetailBody th,#receiptDetailBody td,#shipDetailSafeBody th,#shipDetailSafeBody td{overflow:hidden!important;word-break:break-word!important}
.safeqr img,.safeqr canvas{display:block!important;margin:10px auto!important;width:125px!important;height:125px!important}
`;document.head.appendChild(st)})();

})();

/* ===== 2026-08-24 ONLY FIX: 입금완료 고객 송장파일 만들기 =====
   다른 화면/디자인/저장 데이터는 변경하지 않는다. */
(function(){
  function _digits(v){ return String(v||'').replace(/\D/g,''); }
  function _fmtPhone(v){
    const d=_digits(v);
    if(d.length===11) return d.replace(/(\d{3})(\d{4})(\d{4})/,'$1-$2-$3');
    if(d.length===10) return d.replace(/(\d{3})(\d{3})(\d{4})/,'$1-$2-$3');
    return String(v||'').trim();
  }
  function _cleanAddress(v){
    return String(v||'').replace(/^\s*\d{5,6}\s+/, '').replace(/\s+/g,' ').trim();
  }
  function _customerForReceipt(r){
    let c=r?.customer||{};
    try{
      if((!c.phone || !c.address) && typeof findCustomerSafe==='function'){
        const hit=findCustomerSafe(r?.nick||c?.name||'');
        if(hit?.customer) c={...c,...hit.customer};
      }
    }catch(e){}
    return c||{};
  }
  function _paidReceipts(){
    let rs=[];
    try{ rs=(typeof getReceipts==='function'?getReceipts():[])||[]; }catch(e){ rs=[]; }
    return rs.filter(r=>r?.payment?.status==='paid');
  }
  window.downloadCourierUploadFile=function(){
    try{
      if(typeof XLSX==='undefined') return alert('엑셀 기능을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      const paid=_paidReceipts();
      if(!paid.length) return alert('입금완료 고객이 없습니다. 입금대조에서 입금완료 상태를 확인해 주세요.');

      // 고객별 1행: 같은 고객의 입금완료 정산서가 여러 개여도 송장접수 파일에는 한 번만 기록.
      const map=new Map();
      paid.forEach((r,i)=>{
        const c=_customerForReceipt(r);
        const key=String(c.id||_digits(c.phone)||r.nick||c.name||('row'+i));
        if(map.has(key)) return;
        const name=String(c.name||r.nick||'').trim();
        const phone=_fmtPhone(c.phone||'');
        const address=_cleanAddress([c.address||'',c.detailAddress||''].filter(Boolean).join(' '));
        map.set(key,{
          '성함':name,
          '전화번호':phone,
          '주소':address,
          '내품명':'잡화',
          '배송메시지':'안전한배송 부탁드려요'
        });
      });
      const rows=[...map.values()];
      const missing=rows.filter(x=>!x['전화번호']||!x['주소']);
      if(missing.length){
        const ok=confirm(`입금완료 ${rows.length}명 중 연락처 또는 주소가 비어있는 고객이 ${missing.length}명 있습니다.\n그래도 송장파일을 만들까요?`);
        if(!ok) return;
      }
      const headers=['성함','전화번호','주소','내품명','배송메시지'];
      const ws=XLSX.utils.json_to_sheet(rows,{header:headers});
      ws['!cols']=[{wch:14},{wch:16},{wch:50},{wch:12},{wch:28}];
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,'송장접수');
      const date=new Date().toISOString().slice(0,10);
      XLSX.writeFile(wb,`FIRST_OMS_입금완료_송장접수_${date}.xlsx`);
    }catch(err){
      alert('송장파일 만들기 실패: '+(err?.message||err));
    }
  };
})();

/* === SERVER AUTO-SAVE SAFETY PATCH ===
   Any in-memory state change is persisted to /api/state after a short debounce.
   Existing UI/design is untouched. */
(function(){
  try{
    let lastSavedJson = '';
    let saving = false;
    let pending = false;
    let timer = null;
    async function persistStateNow(){
      if(typeof state === 'undefined') return;
      let json;
      try{ json = JSON.stringify(state); }catch(e){ return; }
      if(!json || json === lastSavedJson) return;
      if(saving){ pending = true; return; }
      saving = true;
      try{
        try{ if(typeof KEY !== 'undefined') localStorage.setItem(KEY,json); }catch(e){}
        const r = await fetch('/api/state', {method:'POST',headers:{'Content-Type':'application/json'},body:json});
        if(r.ok) lastSavedJson = json;
      }catch(e){
        // keep local copy; next detected change / interval retries server save
      }finally{
        saving = false;
        if(pending){ pending = false; setTimeout(persistStateNow,300); }
      }
    }
    function schedulePersist(){
      clearTimeout(timer);
      timer = setTimeout(persistStateNow,1200);
    }
    // Capture user edits after existing handlers have updated state.
    document.addEventListener('input',()=>setTimeout(schedulePersist,0),true);
    document.addEventListener('change',()=>setTimeout(schedulePersist,0),true);
    document.addEventListener('click',()=>setTimeout(schedulePersist,50),true);
    // Also detect programmatic state changes that do not originate from a DOM event.
    setInterval(()=>{
      try{
        if(typeof state === 'undefined') return;
        const j=JSON.stringify(state);
        if(j!==lastSavedJson) schedulePersist();
      }catch(e){}
    },2500);
    window.addEventListener('pagehide',()=>{
      try{
        if(typeof state==='undefined') return;
        const json=JSON.stringify(state);
        try{ if(typeof KEY!=='undefined') localStorage.setItem(KEY,json); }catch(e){}
        if(navigator.sendBeacon) navigator.sendBeacon('/api/state',new Blob([json],{type:'application/json'}));
      }catch(e){}
    });
    // Initialize comparison after server/local load settles.
    setTimeout(()=>{ try{ lastSavedJson=JSON.stringify(state); }catch(e){} },3000);
  }catch(e){}
})();

/* ===== 2026-09-04 FINAL DATA/SYNC PATCH =====
   Data/reconciliation/messaging/new-customer workflow only.
   Receipt and shipping sheet HTML/CSS are intentionally untouched. */
(function(){
  const FKEY='firstOmsReceiptSelectionV20260904';
  const $f=id=>document.getElementById(id);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const nrm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/님$/,'').replace(/[\s\-_.()[\]{}]/g,'');
  const amt=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?Math.round(n):0};

  // 1) Whole-state backup: never customer-only. Export the exact in-memory OMS state.
  window.downloadBackup=async function(){
    const payload={version:7.7,backupType:'FULL_OMS_STATE',exportedAt:new Date().toISOString(),tenantCode:window.__tenantCode||'FIRST-0001',state:clone(window.state||state)};
    const required=['orders','customers','payments','settings','paymentOverrides','shippingScans','shippingOmissions','packingRules','savedSnapshots'];
    payload.manifest=Object.fromEntries(required.map(k=>[k,Array.isArray(payload.state?.[k])?payload.state[k].length:(payload.state?.[k]&&typeof payload.state[k]==='object'?Object.keys(payload.state[k]).length:0)]));
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='FIRST_OMS_전체백업_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };

  // 2/3/9) Strict reconciliation. No fuzzy/substring auto-paid. Manual overrides are revalidated after charge changes.
  function aliases(r){const c=r.customer||{};return [...new Set([r.nick,c.nick,c.nickname,c.name].map(nrm).filter(Boolean))]}
  function strictPaymentFor(r,payments,used){
    const total=amt(r.total), as=aliases(r);
    const named=payments.map((p,i)=>({p,i,a:amt(p.amount),name:nrm(p.payer||p.name||p.depositor)})).filter(z=>!used.has(z.i)&&z.name&&as.includes(z.name));
    const exact=named.filter(z=>z.a===total);
    if(exact.length===1){used.add(exact[0].i);return {status:'paid',payment:exact[0].p,paidAmount:exact[0].a,verified:true,reason:'입금자명과 청구금액 정확일치'}}
    if(exact.length>1)return {status:'review',payment:exact[0].p,paidAmount:exact[0].a,verified:false,reason:'동일 이름·동일 금액 입금이 여러 건이라 확인 필요'};
    if(named.length){const sum=named.reduce((s,z)=>s+z.a,0);if(sum===total&&named.length>1){named.forEach(z=>used.add(z.i));return {status:'paid',payment:named[0].p,payments:named.map(z=>z.p),paidAmount:sum,verified:true,reason:'동일 입금자 분할입금 합계 정확일치'}}return {status:'amount-mismatch',payment:named[0].p,payments:named.map(z=>z.p),paidAmount:sum,verified:false,reason:`청구 ${total.toLocaleString()}원 / 실제입금 ${sum.toLocaleString()}원`}}
    return {status:'unpaid',verified:false,paidAmount:0,reason:'정확히 연결되는 입금내역 없음'};
  }
  const oldGet=window.getReceipts;
  if(typeof oldGet==='function') window.getReceipts=function(){
    const rs=oldGet().map(r=>{try{const m=findCustomerSafe(r.nick);if(m?.customer){r.customer=m.customer;r.customerId=m.customer.id;r.matchStatus=m.status}}catch(e){}return r});
    const used=new Set(),payments=state.payments||[];
    rs.forEach(r=>{
      const calc=strictPaymentFor(r,payments,used),ov=state.paymentOverrides?.[r.key];
      // A manual paid flag is not allowed to survive a changed invoice unless its recorded payment still equals the new total.
      if(ov?.status==='paid'&&ov.payment&&amt(ov.payment.amount)===amt(r.total)&&aliases(r).includes(nrm(ov.payment.payer||ov.payment.name||ov.payment.depositor))){r.payment={...calc,status:'paid',payment:ov.payment,paidAmount:amt(ov.payment.amount),verified:true,manual:true,reason:'수기확인값 재검증 완료'}}
      else r.payment=calc;
    });
    return rs;
  };

  // 2/6) Every settlement message includes account details even if the saved template omitted placeholders.
  const oldFmt=window.formatSms;
  window.formatSms=function(r){
    let t=typeof oldFmt==='function'?String(oldFmt(r)||''):'';const s=state.settings||{};
    const account=`입금계좌: ${s.bank||'카카오뱅크'} ${s.account||'계좌번호 미설정'} 예금주 ${s.holder||'김미숙'}`;
    if(!nrm(t).includes(nrm(s.account||'계좌번호미설정'))) t=(t.trim()?t.trim()+'\n\n':'')+account;
    return t;
  };

  // 4/7/10) Explicit save writes the COMPLETE state to server, then verifies by reading it back.
  async function saveWholeState(date){
    if(date){const snap=clone(state);delete snap.savedSnapshots;state.savedSnapshots=state.savedSnapshots||{};state.savedSnapshots[date]=snap;state.lastSavedDate=date}
    const body=JSON.stringify(state);localStorage.setItem(KEY,body);
    const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body});
    if(!r.ok)throw new Error('서버 저장 HTTP '+r.status);
    const check=await fetch('/api/state?ts='+Date.now(),{cache:'no-store'});if(!check.ok)throw new Error('저장 확인 HTTP '+check.status);
    const got=await check.json(),sv=got.state||got;
    const sig=x=>JSON.stringify([x?.orders?.length||0,x?.customers?.length||0,x?.payments?.length||0,Object.keys(x?.paymentOverrides||{}).length,Object.keys(x?.shippingScans||{}).length,x?.updatedAt||'']);
    if((sv?.orders?.length||0)!==(state.orders?.length||0)||(sv?.customers?.length||0)!==(state.customers?.length||0)||(sv?.payments?.length||0)!==(state.payments?.length||0))throw new Error('서버 저장 확인값이 현재 화면과 다릅니다. 다시 저장해 주세요.');
    return sig(sv);
  }
  window.commitDatedSaveSafe=async function(date){try{await saveWholeState(date);alert(date.replace(/-/g,'.')+' 전체 정보를 서버에 저장했고 재확인했습니다. 다른 컴퓨터에서도 같은 서버 저장본을 불러옵니다.')}catch(e){alert('서버 저장 실패: '+e.message)}};

  // Server is authoritative on another computer/login. Load complete state, not only customers.
  async function loadAuthoritativeState(){
    try{const r=await fetch('/api/state?ts='+Date.now(),{cache:'no-store'});if(!r.ok)return;const d=await r.json(),sv=d.state||d;if(!sv||!Array.isArray(sv.customers))return;
      const meaningful=(sv.orders?.length||sv.payments?.length||Object.keys(sv.savedSnapshots||{}).length||0)>0;if(!meaningful)return;
      state={...state,...sv,settings:{...(state.settings||{}),...(sv.settings||{})}};window.state=state;localStorage.setItem(KEY,JSON.stringify(state));try{autoMatchAll()}catch(e){};try{renderAll()}catch(e){}
    }catch(e){console.warn('전체 서버상태 동기화 실패',e)}
  }
  window.addEventListener('load',()=>setTimeout(loadAuthoritativeState,500));

  // 5) Persist settlement checkbox selection independently of search text.
  let selected=new Set();try{selected=new Set(JSON.parse(localStorage.getItem(FKEY)||'[]'))}catch(e){}
  document.addEventListener('change',e=>{const cb=e.target;if(!cb?.matches?.('.v7474-receipt-check,.v747-receipt-check'))return;const key=cb.dataset.key;if(!key)return;cb.checked?selected.add(key):selected.delete(key);localStorage.setItem(FKEY,JSON.stringify([...selected]))},true);
  const mo=new MutationObserver(()=>document.querySelectorAll('.v7474-receipt-check,.v747-receipt-check').forEach(cb=>{if(cb.dataset.key&&selected.has(cb.dataset.key))cb.checked=true}));
  window.addEventListener('load',()=>{const box=$f('receiptCards');if(box)mo.observe(box,{childList:true,subtree:true})});

  // 6) Settlement-room pre-broadcast message box using existing selected customer SMS sender when available.
  function mountSettlementBroadcast(){const sec=$f('receipts');if(!sec||$f('settlementBroadcastFinal'))return;const tools=sec.querySelector('.receipt-tools');const box=document.createElement('div');box.id='settlementBroadcastFinal';box.className='card no-print';box.style.margin='12px 0';box.innerHTML='<div class="section-title" style="margin-top:0"><h3>정산실 방송 전 문자</h3></div><textarea id="settlementBroadcastText" rows="4" placeholder="방송 전 안내, 입금계좌 등을 입력하세요."></textarea><div class="actions" style="margin-top:8px"><button class="btn" id="settlementBroadcastSend">체크 고객에게 전송</button></div><div class="muted">정산서에서 체크한 고객에게 전송합니다. {계좌번호} {은행} {예금주} 사용 가능</div>';tools?.after(box);
    $f('settlementBroadcastSend').onclick=async function(){const keys=[...selected],rs=getReceipts().filter(r=>keys.includes(r.key));if(!rs.length)return alert('정산서에서 받을 고객을 먼저 체크해 주세요.');let text=$f('settlementBroadcastText').value||'';const s=state.settings||{};text=text.replaceAll('{계좌번호}',s.account||'').replaceAll('{은행}',s.bank||'').replaceAll('{예금주}',s.holder||'');if(!text.trim())return alert('문자 내용을 입력해 주세요.');this.disabled=true;let ok=0,fail=0;for(const r of rs){const to=r.customer?.phone;if(!to){fail++;continue}try{const x=await fetch('/api/mms/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,text,subject:'땡라이브 안내',date:r.date,nickname:r.nick,name:r.customer?.name||'',total:r.total})});if(x.ok)ok++;else fail++}catch(e){fail++}}this.disabled=false;alert(fail?`전송완료 ${ok}명 · 확인필요 ${fail}명`:`${ok}명 전송 완료`)};
  }

  // New/unregistered customers collected separately for quick entry.
  function mountNewCustomers(){const sec=$f('customers');if(!sec||$f('newCustomerFinal'))return;const box=document.createElement('div');box.id='newCustomerFinal';box.className='card no-print';box.style.margin='12px 0';sec.querySelector('.section-title')?.after(box);renderNewCustomers()}
  window.renderNewCustomers=renderNewCustomers;
  function renderNewCustomers(){const box=$f('newCustomerFinal');if(!box)return;const known=new Set((state.customers||[]).filter(c=>c.active!==false).flatMap(c=>[c.nick,c.nickname,c.name].map(nrm)));const nicks=[...new Set((state.orders||[]).map(o=>String(o.nick||'').trim()).filter(Boolean))].filter(x=>!known.has(nrm(x))).sort();box.innerHTML=`<div class="section-title" style="margin-top:0"><h3>신규 고객 정보입력</h3><span class="muted">미등록 ${nicks.length}명</span></div>${nicks.length?'<div class="actions" style="gap:6px;flex-wrap:wrap">'+nicks.map(x=>`<button class="btn secondary new-customer-final" data-nick="${String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}">${String(x).replace(/</g,'&lt;')}</button>`).join('')+'</div>':'<div class="muted">현재 판매리스트의 신규 미등록 고객이 없습니다.</div>'}`;box.querySelectorAll('.new-customer-final').forEach(b=>b.onclick=()=>{openCustomerModal();setTimeout(()=>{if($f('cNick'))$f('cNick').value=b.dataset.nick||'';if($f('cName')&&!$f('cName').value)$f('cName').focus()},0)})}

  window.addEventListener('load',()=>setTimeout(()=>{mountSettlementBroadcast();mountNewCustomers()},800));
})();

/* ===== 2026-09-04 CUSTOMER 400 + ACCOUNT MMS FINAL PATCH =====
   Source of truth: user-provided 2026-09-04 customer backup (400 records).
   Scope: restore missing customer DB records + force account info into MMS text/image.
*/
(function(){
  'use strict';
  const RECOVERY_URL='/customer_recovery_20260904.json?v=20260904_400';
  const BANK='카카오뱅크';
  const ACCOUNT='3333-06-9851290';
  const HOLDER='김미숙';
  let recoveryCustomers=null;
  let restoreRunning=false;

  const clone=v=>JSON.parse(JSON.stringify(v));
  const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/님$/,'').replace(/[\s\-_.()[\]{}]/g,'');
  const phone=v=>String(v??'').replace(/\D/g,'');
  const key=c=>String(c?.id||'') || [norm(c?.name),norm(c?.nickname||c?.nick),phone(c?.phone)].join('|');
  const looseKey=c=>[norm(c?.name),norm(c?.nickname||c?.nick),phone(c?.phone)].join('|');

  function ensureAccountSettings(){
    try{
      state.settings=state.settings||{};
      state.settings.bank=BANK;
      state.settings.account=ACCOUNT;
      state.settings.holder=HOLDER;
      if(!state.settings.smsTemplate || !String(state.settings.smsTemplate).includes('{계좌번호}')){
        state.settings.smsTemplate='[땡라이브 정산서]\n{고객명}님\n상품합계 {상품합계}\n배송비 {배송비}\n결제금액 {결제금액}\n\n입금계좌: {은행} {계좌번호} {예금주}\n{문의안내}\n감사합니다.';
      }
      try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
    }catch(e){}
  }

  async function loadRecovery(){
    if(recoveryCustomers)return recoveryCustomers;
    const r=await fetch(RECOVERY_URL,{cache:'no-store'});
    if(!r.ok)throw new Error('400명 고객백업 읽기 실패 '+r.status);
    const d=await r.json();
    const list=Array.isArray(d?.customers)?d.customers:(Array.isArray(d?.state?.customers)?d.state.customers:[]);
    if(list.length!==400)throw new Error('고객백업 인원 확인 실패: '+list.length+'명');
    recoveryCustomers=clone(list);
    return recoveryCustomers;
  }

  function putRecoveryOnScreen(){
    if(!recoveryCustomers)return;
    try{
      state.customers=clone(recoveryCustomers).map(c=>({...c,nickname:c.nickname||c.nick||'',nick:c.nick||c.nickname||''}));
      window.state=state;
      ensureAccountSettings();
      try{autoMatchAll()}catch(e){}
      try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
      try{renderCustomers()}catch(e){try{renderAll()}catch(_){} }
    }catch(e){console.warn('400명 화면복구 실패',e)}
  }

  async function restoreMissingCustomers(){
    if(restoreRunning)return;
    restoreRunning=true;
    try{
      await loadRecovery();
      putRecoveryOnScreen();
      const sr=await fetch('/api/customers?ts='+Date.now(),{cache:'no-store'});
      const server=sr.ok?await sr.json():[];
      const byId=new Set((Array.isArray(server)?server:[]).map(c=>String(c?.id||'')).filter(Boolean));
      const byLoose=new Set((Array.isArray(server)?server:[]).map(looseKey));
      const missing=recoveryCustomers.filter(c=>!(c?.id&&byId.has(String(c.id)))&&!byLoose.has(looseKey(c)));
      for(const c of missing){
        try{
          const resp=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});
          if(!resp.ok)console.warn('고객 복구 저장 실패',c?.nickname||c?.name,resp.status);
        }catch(e){console.warn('고객 복구 저장 오류',c?.nickname||c?.name,e)}
      }
      // Save the exact 400-customer state as well, without touching orders/payments/shipping.
      try{
        state.customers=clone(recoveryCustomers);
        ensureAccountSettings();
        await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
      }catch(e){console.warn('전체상태 고객복구 저장 실패',e)}
      const vr=await fetch('/api/customers?ts='+Date.now(),{cache:'no-store'});
      const verified=vr.ok?await vr.json():[];
      console.info('[FIRST OMS] 고객복구 확인',Array.isArray(verified)?verified.length:0,'명 / 백업 400명');
      putRecoveryOnScreen();
    }catch(e){console.warn('400명 고객복구 실패',e);putRecoveryOnScreen()}
    finally{restoreRunning=false}
  }

  // Prevent the legacy customer sync from shrinking the screen back to 345 while recovery is running.
  const oldSync=window.syncServerCustomers;
  window.syncServerCustomers=async function(showMessage=false){
    try{
      await loadRecovery();
      const r=await fetch('/api/customers?ts='+Date.now(),{cache:'no-store'});
      const list=r.ok?await r.json():[];
      const baselineLoose=new Set(recoveryCustomers.map(looseKey));
      const serverLoose=new Set((Array.isArray(list)?list:[]).map(looseKey));
      const hasAll400=[...baselineLoose].every(k=>serverLoose.has(k));
      if(hasAll400){
        // Server now contains the full backup. Keep any legitimately added future customers too.
        state.customers=(Array.isArray(list)?list:[]).map(c=>({...c,nickname:c.nickname||c.nick||'',nick:c.nick||c.nickname||''}));
        window.state=state;ensureAccountSettings();try{autoMatchAll()}catch(e){};try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){};try{renderCustomers()}catch(e){}
      }else{
        putRecoveryOnScreen();
        setTimeout(restoreMissingCustomers,50);
      }
      if(showMessage)alert(`고객DB ${state.customers?.length||0}명을 확인했습니다.`);
      return true;
    }catch(e){
      putRecoveryOnScreen();
      if(showMessage)alert('고객DB 동기화 확인 중입니다. 화면에는 400명 백업본을 유지합니다.');
      return false;
    }
  };

  // Add an account strip to every MMS image, regardless of which legacy sender generated it.
  async function addAccountStrip(base64){
    if(!base64)return base64;
    try{
      const img=new Image();
      img.src='data:image/jpeg;base64,'+base64;
      await new Promise((res,rej)=>{img.onload=res;img.onerror=rej});
      const c=document.createElement('canvas');c.width=img.naturalWidth||794;c.height=img.naturalHeight||1123;
      const x=c.getContext('2d');x.drawImage(img,0,0,c.width,c.height);
      const h=Math.max(86,Math.round(c.height*0.085)),y=c.height-h-8;
      x.fillStyle='#fff3a6';x.fillRect(18,y,c.width-36,h);
      x.strokeStyle='#b79a00';x.lineWidth=2;x.strokeRect(18,y,c.width-36,h);
      x.fillStyle='#111';x.textBaseline='middle';x.textAlign='center';
      x.font=`bold ${Math.max(18,Math.round(c.width*0.028))}px sans-serif`;
      x.fillText(`입금계좌  ${BANK} ${ACCOUNT}  예금주 ${HOLDER}`,c.width/2,y+h/2);
      return c.toDataURL('image/jpeg',0.9).split(',')[1];
    }catch(e){console.warn('계좌 이미지 삽입 실패',e);return base64}
  }

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    try{
      const url=typeof input==='string'?input:(input?.url||'');
      if(url.includes('/api/mms/send') && init?.body && typeof init.body==='string'){
        const data=JSON.parse(init.body);
        const accountLine=`입금계좌: ${BANK} ${ACCOUNT}\n예금주: ${HOLDER}`;
        const text=String(data.text||'');
        if(!text.includes(ACCOUNT))data.text=(text.trim()?text.trim()+'\n\n':'')+accountLine;
        if(data.imageBase64)data.imageBase64=await addAccountStrip(data.imageBase64);
        init={...init,body:JSON.stringify(data)};
      }
    }catch(e){console.warn('MMS 계좌 보강 처리 오류',e)}
    return nativeFetch(input,init);
  };

  // Account text is also added to any direct formatter path.
  const oldFmt2=window.formatSms;
  window.formatSms=function(r){
    let t=typeof oldFmt2==='function'?String(oldFmt2(r)||''):'';
    if(!t.includes(ACCOUNT))t=(t.trim()?t.trim()+'\n\n':'')+`입금계좌: ${BANK} ${ACCOUNT}\n예금주: ${HOLDER}`;
    return t;
  };

  window.addEventListener('load',()=>{
    ensureAccountSettings();
    setTimeout(async()=>{try{await loadRecovery();putRecoveryOnScreen();await restoreMissingCustomers()}catch(e){console.warn(e)}},300);
  });
})();
