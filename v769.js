/* OMS v7.69 - fixed receipt/packing sheets + kimchi separation */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const clean=v=>String(v??'').normalize('NFKC').replace(/�+/g,'').replace(/[\u0000-\u001F]/g,'').replace(/\s{2,}/g,' ').trim();
const digits=v=>String(v??'').replace(/\D/g,'');
const norm=v=>clean(v).toLowerCase().replace(/[\s\-_.(){}\[\]\/]+/g,'');
const money=v=>(Number(v)||0).toLocaleString('ko-KR')+'원';
const kimchiRE=/(김치|깍두기|총각김치|총각|열무김치|열무|배추김치|배추|파김치|갓김치|백김치|동치미|겉절이|석박지|나박김치|오이소박이)/i;
const isKimchi=x=>kimchiRE.test(String(x?.item||x?.productName||''));
const sellerOf=items=>[...new Set((items||[]).map(x=>clean(x.seller||x.vendor||x['판매자'])).filter(Boolean))].join(', ')||clean(window.__tenantCompany||state?.settings?.company||'땡라이브');
function annotation(x){
  try{const a=window.parseProductAnnotationsV765?.(x?.item||'')||{};const out=[];if(a.taste)out.push(a.taste);if(a.scent)out.push(a.scent);if(a.color)out.push(a.color);if(a.size)out.push(a.size);if(a.random)out.push('랜덤');if(a.specified)out.push('지정');if(a.comment&&!out.length)out.push(a.comment);return out.join(' · ')||'-'}catch(e){return '-'}
}
function pack(x){try{return window.packCalcV750?.(x)||{actualQty:Number(x?.qty)||0,actualUnit:'개',componentTotal:Number(x?.qty)||0,componentUnit:'개'}}catch(e){return {actualQty:Number(x?.qty)||0,actualUnit:'개',componentTotal:Number(x?.qty)||0,componentUnit:'개'}}}
function customerKey(g){return digits(g.phone)||norm(g.name)||norm(g.nick)}

// 1) 고객DB ↔ 주문 재대조 강화: ID > 전화번호 > 닉네임/실명 유일일치
window.autoMatchAll=function(){
 const active=(state.customers||[]).filter(c=>c.active!==false), byId=new Map(), byPhone=new Map(), byName=new Map();
 for(const c of active){
   if(c.id)byId.set(String(c.id),c);
   const p=digits(c.phone);if(p){const a=byPhone.get(p)||[];a.push(c);byPhone.set(p,a)}
   for(const v of [c.nickname,c.nick,c.name]){const k=norm(v);if(!k)continue;const a=byName.get(k)||[];a.push(c);byName.set(k,a)}
 }
 for(const o of (state.orders||[])){
   let c=o.customerId?byId.get(String(o.customerId)):null;
   if(!c){const p=digits(o.phone||o.customerPhone);const a=p?(byPhone.get(p)||[]):[];if(a.length===1)c=a[0]}
   if(!c){for(const v of [o.nick,o.nickname,o.name]){const a=byName.get(norm(v))||[];if(a.length===1){c=a[0];break}}}
   o.customerId=c?.id||null;o.matchStatus=c?'matched':'unmatched';
 }
 try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
};

function currentGroups(){window.autoMatchAll();let rs=typeof getReceipts==='function'?getReceipts():[];const f=$('shippingFilter')?.value||'all';if(f==='paid')rs=rs.filter(r=>r.payment?.status==='paid');return rs.filter(r=>r.customer).map((r,i)=>{const c=r.customer||{};const code=typeof shippingCodeFor==='function'?shippingCodeFor({key:r.key,name:c.name,nick:r.nick,phone:c.phone,address:[c.address,c.detailAddress].filter(Boolean).join(' '),dates:new Set([r.date]),items:r.items,subtotal:r.subtotal,fee:r.fee,total:r.total}):r.key;return {key:r.key,code,jobNo:String(i+1).padStart(3,'0'),name:clean(c.name),nick:clean(r.nick),phone:clean(c.phone),address:clean([c.address,c.detailAddress].filter(Boolean).join(' ')),seller:sellerOf(r.items),items:r.items||[],subtotal:r.subtotal,fee:r.fee,total:r.total,date:r.date};});}

// 2) 택배실 메인은 핵심 기능만 단순화
window.renderShipping=function(){
 const arr=currentGroups();window.currentShipping=arr;const box=$('shippingTable');if(!box)return;
 const toolbar=`<div class="v769-toolbar">
  <button class="btn" onclick="printTotalPrepSummaryV769()">📋 총계표 출력</button>
  <button class="btn" onclick="printShippingV769()">📦 택배리스트 출력</button>
  <button class="btn secondary" onclick="printKimchiListV769()">🥬 김치리스트 출력</button>
  <button class="btn secondary" onclick="downloadKimchiExcelV769()">🥬 김치 엑셀 받기</button>
  <button class="btn secondary" onclick="toggleCourierDockV768?.()">🚚 택배사/송장 자동화</button>
 </div>`;
 if(!arr.length){box.innerHTML=toolbar+'<div class="empty">택배 대상이 없습니다.</div>';return}
 box.innerHTML=toolbar+`<div class="v769-simple-note"><b>택배실은 출력 중심입니다.</b> 총계표로 상품을 준비하고, 고객별 택배리스트의 노란색 ‘총 담아야 하는 수량’만 보고 포장하세요.</div>`+arr.map(g=>`<div class="v769-customer-mini"><b>${esc(g.jobNo)}번 · ${esc(g.nick)}</b><span>${esc(g.name)}</span><span>판매자 ${esc(g.seller)}</span><span>${esc(g.phone)}</span></div>`).join('');
};

function totalWork(items){return (items||[]).reduce((a,x)=>a+(Number(pack(x).actualQty)||0),0)}
function itemRows(g, kimchiOnly=false){return (g.items||[]).filter(x=>!kimchiOnly||isKimchi(x)).map(it=>{const c=pack(it),opt=annotation(it);return {number:String(it.number||'').replace(/^#/,'')||'-',item:clean(it.item),option:opt,qty:Number(it.qty)||0,unit:Number(it.unit)||0,actualQty:Number(c.actualQty)||0,actualUnit:c.actualUnit||'개',componentTotal:Number(c.componentTotal)||0,componentUnit:c.componentUnit||'개',kimchi:isKimchi(it)}})}

async function packBase(){let base=location.origin+'/packing.html?tenant='+encodeURIComponent(window.__tenantCode||'FIRST-0001');try{const d=await fetch('/api/packing/access-link',{cache:'no-store'}).then(r=>r.json());if(d.ok&&d.url)base=location.origin+d.url}catch(e){}return base}

// 3) 고정 택배리스트 출력 시트: 검정헤더/노랑 작업수량/QR/송장붙이는칸, 합계·계좌 제거
async function printPackingSheets(arr,{kimchiOnly=false,title='택 배 리 스 트'}={}){
 if(!arr.length)return alert('출력할 고객이 없습니다.');const base=await packBase();const qs=[];
 const pages=arr.map((g,i)=>{const rows=itemRows(g,kimchiOnly);if(!rows.length)return '';qs.push({id:'qr769-'+i,url:base+'&code='+encodeURIComponent(g.code)});const scan=state.shippingScans?.[g.code]||{};const body=rows.map(x=>`<tr class="${x.kimchi?'kimchi-row':''}"><td>${esc(x.number)}</td><td>${esc(x.item)}</td><td>${esc(x.option)}</td><td>${esc(x.qty)}</td><td>${money(x.unit)}</td><td class="work"><strong>${esc(x.actualQty)}</strong> ${esc(x.actualUnit)}${x.actualUnit==='묶음'&&x.componentTotal?`<small>(총 ${esc(x.componentTotal)}${esc(x.componentUnit)})</small>`:''}</td></tr>`).join('');const work=rows.reduce((a,x)=>a+x.actualQty,0);
 return `<section class="sheet"><div class="pageNo">${i+1}/${arr.length}</div><h1>${title}</h1><div class="top"><b>판매자 : ${esc(g.seller||'미지정')}</b><span>주문일자 : ${esc(g.date||'')}</span></div><div class="customer"><div class="label">고객정보</div><div class="nickname">닉네임: <strong>${esc(g.nick)}</strong> <span>/ ${esc(g.name||'')}님</span></div><div class="contact">☎ 연락처 : ${esc(g.phone||'-')}<br>⌖ 주소 : ${esc(g.address||'-')}</div></div><table><thead><tr><th>품번</th><th>품명</th><th>옵션<br><small>(포장단위)</small></th><th>수량<br><small>(주문수량)</small></th><th>단가</th><th class="workHead">총 담아야 하는 수량<br><em>(작업 단위)</em></th></tr></thead><tbody>${body}</tbody></table><div class="totalwork">📦 이 고객 총 담기 <strong>${esc(work)}</strong> 작업 단위 <small>(세트/봉지/묶음/개 기준)</small></div><div class="bottom"><div class="qrbox"><h3>QR코드 스캔 후 작업 바랍니다</h3><div id="qr769-${i}" class="qr"></div><p>📱 핸드폰 카메라로 QR코드를 스캔해주세요!<br>(포장 완료 처리 및 상태 업데이트)</p></div><div class="labelbox"><h3>🚚 고객님 송장 붙혀놓는 칸</h3>${scan.trackingNumber?`<div class="tracking">송장번호 ${esc(scan.trackingNumber)}</div>`:''}<div class="labelarea">작업 후 박스에<br>송장 스티커 붙혀주세요</div></div></div><div class="footer">♥ 오늘도 안전하고 빠른 배송을 위해 잘 포장해 주세요!</div></section>`}).filter(Boolean).join('');
 const w=window.open('','_blank');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;color:#111;background:#fff}.sheet{position:relative;width:210mm;min-height:297mm;padding:8mm;page-break-after:always}.sheet:last-child{page-break-after:auto}.pageNo{position:absolute;right:9mm;top:8mm}h1{text-align:center;font-size:34px;letter-spacing:8px;margin:0 0 9px}.top{display:flex;justify-content:space-between;border:1px solid #999;padding:9px 12px;margin-bottom:10px}.customer{display:grid;grid-template-columns:25mm 1fr 94mm;border:1px solid #aaa;margin-bottom:10px;min-height:25mm}.customer>div{padding:10px;border-right:1px solid #aaa}.customer>div:last-child{border-right:0}.label{display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900}.nickname{display:flex;align-items:center;font-size:19px}.nickname strong{font-size:29px;margin:0 5px}.nickname span{font-size:16px}.contact{line-height:1.8;font-size:15px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #bbb;padding:9px 6px;text-align:center;vertical-align:middle}th{background:#242424;color:#fff;font-size:17px}th:nth-child(1){width:11%}th:nth-child(2){width:19%}th:nth-child(3){width:21%}th:nth-child(4){width:15%}th:nth-child(5){width:16%}th:nth-child(6){width:18%}.workHead{background:#ffeb88!important;color:#111!important}.workHead em{color:#d40000;font-style:normal}.work{background:#fff2a8;font-size:18px}.work strong{font-size:28px;color:#c60000}.work small{display:block;font-size:12px;color:#222}.kimchi-row td:first-child,.kimchi-row td:nth-child(2),.kimchi-row .work{color:#d00000;font-weight:900}.totalwork{border:1px solid #aaa;margin-top:10px;padding:10px;text-align:center;font-size:20px}.totalwork strong{font-size:34px;color:#c60000;margin:0 8px}.totalwork small{font-size:12px}.bottom{display:grid;grid-template-columns:43% 57%;gap:10px;margin-top:10px}.qrbox,.labelbox{border:1px solid #aaa;min-height:67mm;text-align:center}.qrbox h3,.labelbox h3{margin:0;padding:8px;background:#f1f1f1;border-bottom:1px solid #bbb}.qr{width:36mm;height:36mm;margin:8px auto}.qr img,.qr canvas{width:36mm!important;height:36mm!important}.qrbox p{font-size:12px}.labelarea{margin:10px;border:1.5px dashed #888;min-height:43mm;display:flex;align-items:center;justify-content:center;color:#777;font-size:18px;line-height:1.7}.tracking{font-weight:900;margin-top:8px}.footer{margin-top:10px;border:1px solid #bbb;padding:9px;text-align:center;font-size:18px}.kimchi-row{background:#fff} @page{size:A4 portrait;margin:0}</style></head><body>${pages}<script>const qs=${JSON.stringify(qs)};window.onload=()=>{qs.forEach(x=>new QRCode(document.getElementById(x.id),{text:x.url,width:180,height:180}));setTimeout(()=>window.print(),650)};<\/script></body></html>`);w.document.close();
}
window.printShippingV769=async()=>{const a=currentGroups();window.currentShipping=a;await printPackingSheets(a)};
window.printShipping=window.printShippingV769;
window.printKimchiListV769=async()=>{const a=consolidatedKimchiGroups();if(!a.length)return alert('김치 주문이 없습니다.');await printPackingSheets(a,{kimchiOnly:true,title:'김 치 포 장 리 스 트'})};
window.printKimchiListV748=window.printKimchiListV769;

// 4) 김치: 엑셀 품명에 김치명이 있으면 종류 불문 분리 + 고객중복/품목중복 합산
function consolidatedKimchiGroups(){const out=new Map();for(const g of currentGroups()){const ki=(g.items||[]).filter(isKimchi);if(!ki.length)continue;const ck=customerKey(g);let z=out.get(ck);if(!z){z={...g,items:[]};out.set(ck,z)}const im=new Map(z.items.map(x=>[String(x.number||'')+'|'+norm(x.item)+'|'+annotation(x),x]));for(const x of ki){const key=String(x.number||'')+'|'+norm(x.item)+'|'+annotation(x);if(im.has(key)){const e=im.get(key);e.qty=(Number(e.qty)||0)+(Number(x.qty)||0);e.amount=(Number(e.amount)||0)+(Number(x.amount)||0)}else{const cp={...x};z.items.push(cp);im.set(key,cp)}}}return [...out.values()]}
window.downloadKimchiExcelV769=function(){const arr=consolidatedKimchiGroups();if(!arr.length)return alert('김치 주문이 없습니다.');const rows=[];for(const g of arr)for(const x of g.items){const c=pack(x);rows.push({'판매자':g.seller,'닉네임':g.nick,'실명':g.name,'연락처':g.phone,'주소':g.address,'품번':String(x.number||'').replace(/^#/,''),'김치종류':clean(x.item),'옵션':annotation(x),'주문수량':Number(x.qty)||0,'총 준비수량':Number(c.actualQty)||0,'준비단위':c.actualUnit||'개'})}if(typeof exportXlsx==='function')exportXlsx(rows,'FIRST_OMS_김치전용.xlsx','김치리스트');else alert('엑셀 내보내기 기능을 찾을 수 없습니다.')};

// 5) 총계표: 일반 + 하단 누락 + 김치 종류별, 옵션/포장단위별 합산
function prepRows(){const mp=new Map();for(const g of currentGroups())for(const x of g.items||[]){if(/^N\d+/i.test(String(x.number||''))||x.omission)continue;const c=pack(x), key=[String(x.number||''),norm(x.item),annotation(x),c.actualUnit].join('|');let z=mp.get(key);if(!z){z={number:String(x.number||'').replace(/^#/,''),item:clean(x.item),option:annotation(x),unit:Number(x.unit)||0,qty:0,actualUnit:c.actualUnit||'개',kimchi:isKimchi(x)};mp.set(key,z)}z.qty+=Number(c.actualQty)||0}return [...mp.values()]}
window.printTotalPrepSummaryV769=function(){const rows=prepRows(),om=state.shippingOmissions||[],kim=rows.filter(x=>x.kimchi);const main=rows.filter(x=>!x.kimchi);const tr=a=>a.map(x=>`<tr><td class="${x.kimchi?'red':''}">${esc(x.number)}</td><td class="${x.kimchi?'red':''}">${esc(x.item)}</td><td>${esc(x.option)}</td><td>${money(x.unit)}</td><td class="ready ${x.kimchi?'red':''}">${esc(x.qty)}${esc(x.actualUnit)}</td></tr>`).join('');const w=window.open('','_blank');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:Arial,'Noto Sans KR',sans-serif;margin:0}.page{width:210mm;min-height:297mm;padding:10mm}h1{font-size:28px;margin:0 0 12px}.guide{padding:10px;border:2px solid #111;margin-bottom:12px;font-weight:900}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #888;padding:8px}th{background:#222;color:#fff}.ready{font-size:21px;font-weight:950;text-align:center}.section{font-size:20px;font-weight:950;margin:18px 0 7px}.red{color:#d00000!important;font-weight:950}.omit td:nth-child(1),.omit td:nth-child(2),.omit td:nth-child(4){color:#d00000;font-weight:900}@page{size:A4;margin:0}</style></head><body><section class="page"><h1>${esc(window.__tenantCompany||'땡라이브')} 상품 준비 총계표</h1><div class="guide">택배 총괄자는 ‘총 준비수량’만 보고 상품을 꺼내세요. 색상·맛·사이즈·향·랜덤/지정·포장단위가 다르면 각각 분리됩니다.</div><table><thead><tr><th>품번</th><th>품명</th><th>옵션</th><th>단가</th><th>총 준비수량</th></tr></thead><tbody>${tr(main)}</tbody></table><div class="section red">🚨 누락건 총 ${om.reduce((a,x)=>a+(Number(x.qty)||0),0)}개</div><table class="omit"><thead><tr><th>품번</th><th>품명</th><th>옵션/메모</th><th>수량</th></tr></thead><tbody>${om.length?om.map(x=>`<tr><td>#${esc(x.number||'')}</td><td>${esc(x.item||'')}</td><td>${esc(x.note||'-')}</td><td>${esc(x.qty||0)}</td></tr>`).join(''):'<tr><td colspan="4">누락건 없음</td></tr>'}</tbody></table><div class="section red">🥬 김치 종류별 준비수량</div><table><thead><tr><th>품번</th><th>김치종류</th><th>옵션</th><th>단가</th><th>총 준비수량</th></tr></thead><tbody>${kim.length?tr(kim):'<tr><td colspan="5">김치 주문 없음</td></tr>'}</tbody></table></section><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()};
window.printTotalPrepSummaryV768=window.printTotalPrepSummaryV769;

function boot769(){try{window.autoMatchAll();window.renderReceipts?.();window.renderShipping?.()}catch(e){console.error('v769 boot',e)}}
window.addEventListener('load',()=>setTimeout(boot769,1600));
})();
