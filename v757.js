/* OMS v7.57 hotfix: true product aggregation, one customer action column, multi-page MMS */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const won=v=>(Number(v)||0).toLocaleString('ko-KR')+'원';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* 1) 고객DB 수정/삭제 열은 딱 하나만: 왼쪽 고정 열 유지, 원래 오른쪽 관리 열 제거 */
function fixCustomerActionDup(){
 const table=$('customersTable')?.querySelector('table'); if(!table)return;
 const rows=[...table.querySelectorAll('tbody tr')];
 rows.forEach(tr=>{
   const keep=tr.querySelector('.v756-manage-cell');
   if(!keep)return;
   [...tr.querySelectorAll('td.action-cell')].forEach(td=>{if(td!==keep)td.remove()});
   const actionCells=[...tr.children].filter(td=>td!==keep && (td.querySelector?.('button[onclick*="editCustomer"]')||td.querySelector?.('button[onclick*="deleteCustomer"]')));
   actionCells.forEach(td=>td.remove());
 });
 const hr=table.querySelector('thead tr');
 if(hr){
   [...hr.children].forEach(th=>{const t=th.textContent.trim();if((t==='관리'||t==='수정/삭제'||t==='수정 / 삭제')&&!th.classList.contains('v756-manage-head'))th.remove()});
 }
}
const prevRenderCustomers=window.renderCustomers;
window.renderCustomers=function(){const r=prevRenderCustomers?.apply(this,arguments);setTimeout(fixCustomerActionDup,35);return r};

/* 2) 총괄표: 품번이 달라도 상품명이 같으면 한 줄로 묶고, 상품명 속 3개/6개 같은 포장수량도 자동환산 */
function cleanName57(item){
 let s=String(item||'').trim().replace(/\s+/g,' ');
 // 괄호 안 옵션만 제거
 s=s.replace(/[（(]([^）)]*(?:색상|향|사이즈|size|랜덤|지정|블랙|화이트|핑크|레드|블루|그린|베이지|\d{2,3}\s*(?:mm|호)?)[^）)]*)[）)]/ig,' ').trim();
 // 슬래시 뒤 옵션 제거
 if(s.includes('/')){const p=s.split('/');const tail=p.slice(1).join('/');if(/색상|향|사이즈|랜덤|지정|블랙|화이트|핑크|레드|블루|그린|베이지|\b\d{2,3}\b/i.test(tail))s=p[0].trim()}
 // 끝의 포장수량 표기 제거: '어포튀각 3개', '만두 3봉', '양말 6켤레' => 같은 상품으로 묶기
 s=s.replace(/\s*[-·xX×*]?\s*\d+\s*(개|봉지?|팩|켤레|묶음|박스|세트)\s*$/i,'').trim();
 return s.replace(/\s{2,}/g,' ').trim();
}
function inferredPack57(x){
 const q=Math.max(0,Number(x?.qty)||0),name=String(x?.item||'');
 // 수기/자동 포장규칙이 있으면 그것을 최우선
 try{if(typeof window.packCalcV750==='function'){
   const c=window.packCalcV750(x);
   if(c?.rule)return {...c,source:'rule'};
 }}catch(e){}
 // 상품명 끝의 '3개/6봉/2팩...' 자동 감지
 const m=name.match(/(?:^|\s|[-·xX×*])\s*(\d+)\s*(개|봉지?|팩|켤레|묶음|박스|세트)\s*$/i);
 if(m){const mult=Math.max(1,Number(m[1])||1),u=m[2]==='봉지'?'봉지':m[2];return {orderQty:q,saleUnit:'세트',componentQty:mult,componentUnit:u,actualQty:q*mult,actualUnit:u,componentTotal:q*mult,source:'name'}}
 try{if(typeof window.packCalcV750==='function')return window.packCalcV750(x)}catch(e){}
 return {orderQty:q,saleUnit:'개',componentQty:1,componentUnit:'개',actualQty:q,actualUnit:'개',componentTotal:q,source:'default'};
}
function grouped57(arr){
 const mp=new Map();
 arr.forEach(g=>(g.items||[]).forEach(x=>{
   const name=cleanName57(x.item)||String(x.item||'').trim();
   // 상품명 우선. 같은 상품은 품번이 달라도 합산.
   const key=name.toLowerCase(); const c=inferredPack57(x); const no=String(x.number||'').replace(/^#/,'').trim();
   if(!mp.has(key))mp.set(key,{name,numbers:new Set(),orderQty:0,units:new Map(),customers:new Set()});
   const z=mp.get(key);if(no)z.numbers.add(no);z.orderQty+=Number(x.qty)||0;z.units.set(c.actualUnit||'개',(z.units.get(c.actualUnit||'개')||0)+(Number(c.actualQty)||0));z.customers.add(g.name||g.nick||'');
 }));
 return [...mp.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko'));
}
function numLabel57(set){const a=[...set];if(!a.length)return '-';if(a.length===1)return '#'+a[0];return '#'+a[0]+' 외 '+(a.length-1)+'개 품번'}
function simplePages57(arr){return arr.map((g,i)=>`<section class="page"><h1>${E(g.jobNo||String(i+1).padStart(3,'0'))}번 / ${E(g.name||g.nick)}</h1><div class="meta">${E(g.phone||'')} · ${E(g.address||'')}</div><table><thead><tr><th>품번</th><th>상품명/옵션</th><th>실제 넣을 수량</th></tr></thead><tbody>${(g.items||[]).map(x=>{const c=inferredPack57(x);return `<tr><td>#${E(x.number||'-')}</td><td>${E(x.item)}</td><td class="qty">${Number(c.actualQty)||0}${E(c.actualUnit||'개')}</td></tr>`}).join('')}</tbody></table></section>`).join('')}
window.printPackingSummaryV748=function(){
 window.renderShipping?.();const arr=[...(window.currentShipping||[])];if(!arr.length)return alert('출력할 택배 대상이 없습니다.');
 const rows=grouped57(arr),company=window.__tenantCompany||state.settings?.company||'땡라이브';
 const summary=`<section class="page"><h1>${E(company)} 상품 준비 총괄표</h1><p><b>같은 상품명은 품번이 달라도 한 줄로 합산</b>했습니다.</p><table><thead><tr><th>품번</th><th>상품명</th><th>총 주문수량</th><th>총 준비/수령수량</th><th>주문 고객수</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${E(numLabel57(x.numbers))}</b></td><td><b>${E(x.name)}</b></td><td class="qty">${x.orderQty}</td><td class="qty">${[...x.units].map(([u,q])=>`${q}${E(u)}`).join(' + ')}</td><td>${x.customers.size}명</td></tr>`).join('')}</tbody></table></section>`;
 const w=window.open('','_blank');if(!w)return alert('팝업 차단을 해제해 주세요.');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>상품 준비 총괄표</title><style>*{box-sizing:border-box}body{font-family:Arial,'Noto Sans KR',sans-serif;margin:0;color:#111}.page{width:210mm;min-height:297mm;padding:12mm;page-break-after:always}.page:last-child{page-break-after:auto}h1{font-size:28px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #777;padding:10px 8px}th{background:#eee}.qty{font-size:21px;font-weight:900;text-align:center}.meta{margin:8px 0 15px;color:#555}@page{size:A4;margin:0}</style></head><body>${summary}${simplePages57(arr)}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);w.document.close();
};

/* 3) 여러 장 정산서는 실제로 여러 MMS로 순차 전송. 마지막 장에만 배송비/합계 */
function splitReceipt57(r){const per=9,a=[];const items=r.items||[];for(let i=0;i<items.length;i+=per)a.push(items.slice(i,i+per));if(!a.length)a.push([]);return a}
function canvasJpeg57(c){for(const q of [.78,.68,.58,.5,.44]){const d=c.toDataURL('image/jpeg',q).split(',')[1];if(Math.ceil(d.length*3/4)<190*1024)return d}return c.toDataURL('image/jpeg',.4).split(',')[1]}
async function pageImage57(r,items,page,pages,final){
 const W=794,H=1123,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),L=38,R=W-38;
 const box=(a,b,w,h,fill='#fff',stroke='#888')=>{x.fillStyle=fill;x.fillRect(a,b,w,h);x.strokeStyle=stroke;x.strokeRect(a,b,w,h)};
 const text=(t,a,b,font='14px sans-serif',align='left',color='#111')=>{x.font=font;x.textAlign=align;x.textBaseline='middle';x.fillStyle=color;x.fillText(String(t??''),a,b)};
 x.fillStyle='#fff';x.fillRect(0,0,W,H);text(window.__tenantCompany||state.settings?.company||'땡라이브',L,30,'bold 13px sans-serif');text('정 산 서',W/2,66,'bold 34px sans-serif','center');text(`${r.date||''} · ${page}/${pages}장`,R,32,'13px sans-serif','right');
 let y=105;box(L,y,R-L,48,'#f5f5f5');text(`${r.customer?.name||r.nick} (${r.nick})`,L+12,y+24,'bold 19px sans-serif');y+=58;box(L,y,R-L,40);text(r.customer?.phone||'연락처 미등록',L+12,y+20);y+=40;box(L,y,R-L,54);text([r.customer?.address,r.customer?.detailAddress].filter(Boolean).join(' ')||'주소 미등록',L+12,y+27,'13px sans-serif');y+=66;
 const widths=[65,325,75,110,115],heads=['품번','상품명/옵션','수량','단가','금액'];let cx=L;heads.forEach((h,i)=>{box(cx,y,widths[i],36,'#222','#222');text(h,cx+widths[i]/2,y+18,'bold 13px sans-serif','center','#fff');cx+=widths[i]});y+=36;
 items.forEach((it,i)=>{cx=L;const vals=['#'+(it.number||i+1),it.item,it.qty,won(it.unit),won(it.amount)];vals.forEach((v,j)=>{box(cx,y,widths[j],48);text(v,j===1?cx+6:cx+widths[j]/2,y+24,j===1?'12px sans-serif':'13px sans-serif',j===1?'left':'center');cx+=widths[j]});y+=48});
 y+=18;if(final){box(L,y,R-L,44,'#f7f7f7');text('상품합계',L+12,y+22,'bold 15px sans-serif');text(won(r.subtotal),R-12,y+22,'bold 16px sans-serif','right');y+=44;box(L,y,R-L,44,'#fff7d6','#b59600');text('배송비 (마지막 장 1회)',L+12,y+22,'bold 15px sans-serif');text(won(r.fee),R-12,y+22,'bold 16px sans-serif','right');y+=56;box(L,y,R-L,62,'#fff','#111');text('총 결제금액',L+12,y+31,'bold 20px sans-serif');text(won(r.total),R-12,y+31,'bold 28px sans-serif','right')}else{box(L,y,R-L,72,'#fff2f2','#d22');text('다음 장에 계속됩니다.',W/2,y+24,'bold 18px sans-serif','center','#b00');text('배송비와 총 결제금액은 마지막 장에만 표시됩니다.',W/2,y+50,'bold 14px sans-serif','center','#b00')}
 text(`${page}/${pages}`,W/2,H-26,'12px sans-serif','center','#777');return canvasJpeg57(c)
}
async function images57(r){const ch=splitReceipt57(r),out=[];for(let i=0;i<ch.length;i++)out.push(await pageImage57(r,ch[i],i+1,ch.length,i===ch.length-1));return out}
function preview57(r,imgs){return new Promise(resolve=>{const back=document.createElement('div');back.className='v755-preview-back';back.innerHTML=`<div class="v755-preview" style="max-width:900px"><h2>문자 전송 전 확인 · 총 ${imgs.length}장</h2><p><b>${E(r.customer?.name||r.nick)}</b> · ${E(r.customer?.phone||'')}<br>여러 장이면 아래 이미지가 모두 각각 전송됩니다. 배송비/총액은 마지막 장에만 표시됩니다.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;max-height:60vh;overflow:auto">${imgs.map((im,i)=>`<div><b>${i+1}/${imgs.length}장</b><img style="width:100%;display:block;margin-top:4px" src="data:image/jpeg;base64,${im}"></div>`).join('')}</div><div class="v755-preview-actions"><button class="btn secondary" id="c57">취소</button><button class="btn" id="s57">${imgs.length}장 모두 전송</button></div></div>`;document.body.appendChild(back);back.querySelector('#c57').onclick=()=>{back.remove();resolve(false)};back.querySelector('#s57').onclick=()=>{back.remove();resolve(true)}})}
window.sendMmsByKey=async function(key,button,skipConfirm=false){
 const r=(typeof getReceipts==='function'?getReceipts():[]).find(x=>x.key===key);if(!r)return alert('정산서를 찾을 수 없습니다.');const cu=r.customer;if(!cu?.phone)return alert('고객 연락처가 없습니다.');
 const old=button?.textContent||'정산서 이미지 전송';if(button){button.disabled=true;button.textContent='이미지 준비 중...'}
 try{
   const imgs=await images57(r);if(!skipConfirm){const go=await preview57(r,imgs);if(!go)return false}
   for(let i=0;i<imgs.length;i++){
     if(button)button.textContent=`전송 ${i+1}/${imgs.length}`;const final=i===imgs.length-1;
     const resp=await fetch('/api/mms/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:cu.phone,imageBase64:imgs[i],subject:`${window.__tenantCompany||'땡라이브'} 정산서 ${i+1}/${imgs.length}`,text:final?`${r.nick}님 정산서 마지막 장입니다. 총 결제금액 ${won(r.total)} (배송비 ${won(r.fee)} 포함)`:`${r.nick}님 정산서 ${i+1}/${imgs.length}장입니다. 다음 장이 이어집니다.`,date:r.date,nickname:r.nick,name:cu.name||'',total:final?r.total:0,page:i+1,pages:imgs.length,finalPage:final})});
     const d=await resp.json().catch(()=>({}));if(!resp.ok||d.ok===false)throw new Error(`${i+1}/${imgs.length}장 전송 실패: ${d.error||resp.status}`);if(i<imgs.length-1)await sleep(900);
   }
   if(!skipConfirm)alert(`${r.nick}님 정산서 ${imgs.length}장 전송 완료\n배송비와 총액은 마지막 장에만 표시됩니다.`);return true;
 }catch(e){if(!skipConfirm)alert('정산서 이미지 전송 실패: '+e.message);throw e}finally{if(button){button.disabled=false;button.textContent=old}}
};

setTimeout(()=>{try{fixCustomerActionDup();window.renderShipping?.()}catch(e){console.warn('v757 init',e)}},350);
})();
