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


})();
