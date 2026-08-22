/* OMS v7.65: speed, date isolation, list layout, receipt/shipping clarity, annotation parser */
(()=>{
'use strict';
const $=id=>document.getElementById(id), E=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const N=v=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,'');
const D=v=>String(v??'').replace(/\D/g,'');
const M=v=>Number(v||0).toLocaleString('ko-KR')+'원';
function loading(show,text='엑셀을 빠르게 정리하고 있습니다…'){let x=$('v765Loading');if(!x){x=document.createElement('div');x.id='v765Loading';x.className='v765-loading';x.innerHTML='<div id="v765LoadingText"></div>';document.body.appendChild(x)}$('v765LoadingText').textContent=text;x.classList.toggle('show',!!show)}
window.v765Loading=loading;

/* 고객 매칭 인덱스: 매 주문마다 341명 전체를 다시 훑지 않는다. */
let idxStamp='', exactMap=new Map();
function buildCustomerIndex(){const list=(state.customers||[]).filter(c=>c.active!==false);const stamp=list.map(c=>[c.id,c.name,c.nickname||c.nick,c.phone].join('|')).join('~');if(stamp===idxStamp)return;idxStamp=stamp;exactMap=new Map();for(const c of list){for(const v of [c.name,c.nickname,c.nick]){const k=N(v);if(!k)continue;const a=exactMap.get(k)||[];a.push(c);exactMap.set(k,a)}}}
window.findCustomerByNick=function(nick){buildCustomerIndex();const k=N(nick);if(!k)return {customer:null,status:'unmatched'};const a=exactMap.get(k)||[];if(a.length===1)return {customer:a[0],status:'matched'};if(a.length>1)return {customer:null,status:'duplicate'};const active=(state.customers||[]).filter(c=>c.active!==false),f=active.filter(c=>[c.name,c.nickname,c.nick].some(v=>{const q=N(v);return q&&k.length>=2&&(q.includes(k)||k.includes(q))}));return f.length===1?{customer:f[0],status:'matched-fuzzy'}:{customer:null,status:'unmatched'}};
window.autoMatchAll=function(){buildCustomerIndex();for(const o of (state.orders||[])){const m=window.findCustomerByNick(o.nick);o.customerId=m.customer?.id||null;o.matchStatus=m.status}}

/* () {} [] 코멘트 분리 */
window.parseProductAnnotationsV765=function(item){const s=String(item||'');const groups=[...s.matchAll(/[\(\{\[]([^\)\}\]]+)[\)\}\]]/g)].map(x=>x[1].trim());const comment=groups.join(' / ');const out={comment,random:/랜덤|무작위/i.test(comment),specified:/지정/i.test(comment),size:'',color:'',scent:'',taste:'',setQty:null,setUnit:''};const size=(comment.match(/(?:사이즈|size)\s*[:=]?\s*([0-9A-Za-z가-힣.+-]+)/i)||comment.match(/\b(2[0-9]{2}|S|M|L|XL|XXL|FREE)\b/i));if(size)out.size=size[1];const color=comment.match(/(?:색|색상|컬러|color)\s*[:=]?\s*([^,/|]+)/i);if(color)out.color=color[1].trim();const scent=comment.match(/(?:향|향기|scent)\s*[:=]?\s*([^,/|]+)/i);if(scent)out.scent=scent[1].trim();const taste=comment.match(/(?:맛|flavor)\s*[:=]?\s*([^,/|]+)/i);if(taste)out.taste=taste[1].trim();const pack=comment.match(/(?:1\s*(?:세트|묶음)\s*[=:]?\s*)?(\d+)\s*(개|봉지|봉|켤레|팩|박스)\s*(?:1\s*)?(?:세트|묶음)/i)||comment.match(/(\d+)\s*(개|봉지|봉|켤레|팩|박스)\s*1\s*(?:세트|묶음)/i);if(pack){out.setQty=Number(pack[1]);out.setUnit=pack[2]}return out};
function annText(item){const a=window.parseProductAnnotationsV765(item),x=[];if(a.size)x.push('사이즈 '+a.size);if(a.color)x.push('색상 '+a.color);if(a.scent)x.push('향 '+a.scent);if(a.taste)x.push('맛 '+a.taste);if(a.random)x.push('랜덤');if(a.specified)x.push('지정');return x.join(' · ')||a.comment||'-'}

/* 판매리스트 업로드: 기존 파서를 유지하되 전체화면 렌더는 한번만, 로딩 표시 */
const oldImport=window.importOrders;
if(typeof oldImport==='function')window.importOrders=async function(rows,filename){loading(true,`판매리스트 ${rows.length.toLocaleString()}행 처리 중…`);try{await new Promise(r=>setTimeout(r,20));return await oldImport(rows,filename)}finally{setTimeout(()=>loading(false),120)}};

function phoneIssue(c){const p=D(c?.phone);return !/^01\d{8,9}$/.test(p)}
function issueText(c){const x=[];if(!String(c?.name||'').trim())x.push('실명');if(!String(c?.nickname||c?.nick||'').trim())x.push('닉네임');if(phoneIssue(c))x.push('연락처');if(!String(c?.address||'').trim())x.push('주소');return x.join(' · ')}
window.renderCustomers=function(){const q=N($('customerSearch')?.value||''),list=(state.customers||[]).map((c,i)=>({c,i})).filter(({c})=>c.active!==false&&(!q||[c.name,c.nickname,c.nick,c.phone,c.address,c.detailAddress,c.memo].some(v=>N(v).includes(q))));if($('customerSearchSummary'))$('customerSearchSummary').textContent=`전체 고객 ${(state.customers||[]).filter(c=>c.active!==false).length}명${q?` · 검색 ${list.length}명`:''}`;const box=$('customersTable');if(!box)return;if(!list.length){box.innerHTML='<div class="empty">고객이 없습니다.</div>';return}box.innerHTML=`<div class="scroll"><table><thead><tr><th><input type="checkbox" onchange="document.querySelectorAll('.v765-customer-check').forEach(x=>x.checked=this.checked)"></th><th>실명</th><th>닉네임</th><th>연락처</th><th>주소</th><th>요청사항</th><th>수정 / 삭제</th></tr></thead><tbody>${list.map(({c,i})=>`<tr><td><input class="v765-customer-check" type="checkbox" data-id="${E(c.id||'')}"></td><td><b>${E(c.name||'-')}</b></td><td>${E(c.nickname||c.nick||'-')}</td><td class="${phoneIssue(c)?'v755-badphone':''}">${E(c.phone||'-')}${phoneIssue(c)?'<br><small>⚠ 번호 확인</small>':''}</td><td class="address-cell">${E([c.address,c.detailAddress].filter(Boolean).join(' '))}</td><td>${E(c.memo||'')}</td><td><button class="btn secondary" onclick="editCustomer(${i})">수정</button> <button class="btn bad" onclick="deleteCustomer(${i})">삭제</button></td></tr>`).join('')}</tbody></table></div>`;window.renderCustomerIssuesV755?.()};

/* 정산 목록 순서 + 상세/문자/선택 */
window.renderReceipts=function(){const rs=(typeof filteredReceipts==='function'?filteredReceipts():getReceipts()).sort((a,b)=>String(a.customer?.name||a.nick).localeCompare(String(b.customer?.name||b.nick),'ko'));const matched=rs.filter(r=>r.customer).length;if($('receiptSummary'))$('receiptSummary').textContent=`검색된 정산서 ${rs.length}명 · 고객DB 매칭 ${matched}명 · 정보확인 필요 ${rs.length-matched}명`;const box=$('receiptCards');if(!box)return;if(!rs.length){box.innerHTML='<div class="empty">조건에 맞는 정산서가 없습니다.</div>';return}box.innerHTML=`<div class="scroll"><table class="receipt-list-table"><thead><tr><th><input type="checkbox" onchange="document.querySelectorAll('.v765-receipt-check').forEach(x=>x.checked=this.checked)"></th><th>실명</th><th>닉네임</th><th>연락처</th><th>주소</th><th>합계</th><th>입금대조</th><th>정보수정</th><th>문자전송</th><th>상세</th><th>판매자</th></tr></thead><tbody>${rs.map(r=>{const c=r.customer||{},pay=r.payment||{},seller=[...new Set((r.items||[]).map(x=>x.seller).filter(Boolean))].join(', ')||window.__tenantCompany||'땡라이브';return `<tr><td><input type="checkbox" class="v765-receipt-check v7474-receipt-check" data-key="${E(r.key)}"></td><td><b>${E(c.name||'정보없음')}</b></td><td>${E(r.nick)}</td><td>${E(c.phone||'-')}</td><td class="address-cell">${E([c.address,c.detailAddress].filter(Boolean).join(' ')||'-')}</td><td><b>${M(r.total)}</b></td><td><span class="badge ${pay.status==='paid'?'good':pay.status==='review'||pay.status==='amount-mismatch'?'warn':'bad'}">${E(pay.status==='paid'?'입금완료':pay.status==='review'?'확인필요':pay.status==='amount-mismatch'?'금액불일치':'미입금')}</span></td><td>${c.id?`<button class="btn secondary" onclick="editCustomerById('${E(c.id)}')">정보수정</button>`:`<button class="btn warn" onclick="openCustomerForKey('${E(r.key)}')">정보등록</button>`}</td><td><button class="btn" onclick="sendMmsByKey('${E(r.key)}',this)">이미지 전송</button></td><td><button class="btn secondary" onclick="openReceiptDetail('${E(r.key)}')">상세보기</button></td><td><span class="v765-chip">${E(seller)}</span></td></tr>`}).join('')}</tbody></table></div>`;window.ensureV765ReceiptToolbar?.()};
window.ensureV765ReceiptToolbar=function(){const sec=$('receipts');if(!sec||$('v765ReceiptToolbar'))return;const anchor=sec.querySelector('.section-title');if(!anchor)return;const b=document.createElement('div');b.id='v765ReceiptToolbar';b.className='v765-toolbar';b.innerHTML='<button class="btn" onclick="sendAllMms(this)">전체 정산서 이미지 전송</button><button class="btn secondary" onclick="sendSelectedReceiptsV765(this)">선택 고객 이미지 전송</button><button class="btn secondary" onclick="printAllReceiptsExact(\'all\')">전체 이미지 출력</button><button class="btn secondary" onclick="printSelectedReceiptsV747()">선택 이미지 출력</button><button class="btn secondary" onclick="toggleReceiptsV765(true)">전체선택</button><button class="btn secondary" onclick="toggleReceiptsV765(false)">선택해제</button>';anchor.insertAdjacentElement('afterend',b)};
window.toggleReceiptsV765=v=>document.querySelectorAll('.v765-receipt-check,.v7474-receipt-check').forEach(x=>x.checked=v);
window.sendSelectedReceiptsV765=async function(button){const keys=[...document.querySelectorAll('.v765-receipt-check:checked')].map(x=>x.dataset.key),rs=getReceipts().filter(r=>keys.includes(r.key)&&r.customer?.phone);if(!rs.length)return alert('전송할 고객을 체크해 주세요.');if(!confirm(`선택한 ${rs.length}명에게 정산서 이미지를 전송할까요?`))return;const old=button?.textContent||'선택 고객 이미지 전송';if(button){button.disabled=true}let ok=0,fail=[];for(let i=0;i<rs.length;i++){if(button)button.textContent=`전송 ${i+1}/${rs.length}`;try{await sendMmsByKey(rs[i].key,null,true);ok++}catch(e){fail.push(`${rs[i].nick}: ${e.message}`)}}if(button){button.disabled=false;button.textContent=old}alert(`선택 이미지 전송 완료\n성공 ${ok}명 / 실패 ${fail.length}명${fail.length?'\n'+fail.slice(0,8).join('\n'):''}`)};

/* 다중 정산서: 마지막 장에만 합계/배송비/계좌/닉네임 입금 안내 */
function split8(r){const a=Array.isArray(r.items)?r.items:[],out=[];for(let i=0;i<a.length;i+=8)out.push(a.slice(i,i+8));return out.length?out:[[]]}
function jpg(c){for(const q of [.76,.68,.60,.52,.44]){const b=c.toDataURL('image/jpeg',q).split(',')[1];if(Math.ceil(b.length*3/4)<190*1024)return b}return c.toDataURL('image/jpeg',.40).split(',')[1]}
async function receiptPages765(r){const chunks=split8(r),out=[],seller=[...new Set((r.items||[]).map(x=>x.seller).filter(Boolean))].join(', ')||window.__tenantCompany||'땡라이브';for(let pi=0;pi<chunks.length;pi++){const final=pi===chunks.length-1,W=794,H=1123,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),L=38,R=W-38;const box=(a,b,w,h,f='#fff',s='#777')=>{x.fillStyle=f;x.fillRect(a,b,w,h);x.strokeStyle=s;x.strokeRect(a,b,w,h)},txt=(t,a,b,font='14px sans-serif',align='left',color='#111')=>{x.font=font;x.textAlign=align;x.textBaseline='middle';x.fillStyle=color;x.fillText(String(t??''),a,b)};x.fillStyle='#fff';x.fillRect(0,0,W,H);txt(`${window.__tenantCompany||state.settings?.company||'땡라이브'} 정산서`,L,30,'bold 14px sans-serif');txt(`판매자: ${seller}`,L,54,'bold 13px sans-serif');txt(`${pi+1}/${chunks.length}`,R,32,'bold 13px sans-serif','right');txt('정 산 서',W/2,72,'bold 34px sans-serif','center');let y=104;box(L,y,R-L,46,'#f5f5f5');txt(`${r.customer?.name||r.nick}님 / 닉네임 ${r.nick}`,L+12,y+23,'bold 18px sans-serif');y+=56;box(L,y,R-L,38);txt(`연락처  ${r.customer?.phone||'-'}`,L+12,y+19);y+=38;box(L,y,R-L,52);txt(`주소  ${[r.customer?.address,r.customer?.detailAddress].filter(Boolean).join(' ')||'-'}`,L+12,y+26,'13px sans-serif');y+=64;const ws=[65,320,75,110,120],hs=['품번','상품명 / 옵션','수량','단가','금액'];let cx=L;hs.forEach((h,i)=>{box(cx,y,ws[i],36,'#222','#222');txt(h,cx+ws[i]/2,y+18,'bold 13px sans-serif','center','#fff');cx+=ws[i]});y+=36;for(const it of chunks[pi]){cx=L;const vals=['#'+(it.number||''),it.item,it.qty,M(it.unit),M(it.amount)];for(let j=0;j<vals.length;j++){box(cx,y,ws[j],57);if(j===1){txt(vals[j],cx+6,y+18,'12px sans-serif');const an=annText(it.item);if(an&&an!=='-')txt(an,cx+6,y+40,'11px sans-serif','left','#666')}else txt(vals[j],cx+ws[j]/2,y+28,'13px sans-serif','center');cx+=ws[j]}y+=57}y+=18;if(final){box(L,y,R-L,42,'#f5f5f5');txt('상품합계',L+12,y+21,'bold 14px sans-serif');txt(M(r.subtotal),R-12,y+21,'bold 15px sans-serif','right');y+=42;box(L,y,R-L,42,'#fff7d8','#b18a00');txt('택배비',L+12,y+21,'bold 14px sans-serif');txt(M(r.fee),R-12,y+21,'bold 15px sans-serif','right');y+=50;box(L,y,R-L,58,'#fff','#111');txt('총 결제금액',L+12,y+29,'bold 19px sans-serif');txt(M(r.total),R-12,y+29,'bold 27px sans-serif','right','#c00');y+=72;const bank=state.settings?.bank||'카카오뱅크',acct=state.settings?.account||'계좌번호 미설정',holder=state.settings?.holder||'';box(L,y,R-L,48,'#fff2a8','#ae8c00');txt(`입금계좌  ${bank} ${acct}  예금주 ${holder}`,L+12,y+24,'bold 14px sans-serif');y+=58;box(L,y,R-L,54,'#fff6f6','#d22');txt(`입금자명은 닉네임 “${r.nick}”으로 입금 바랍니다.`,W/2,y+27,'bold 15px sans-serif','center','#b00')}else{box(L,y,R-L,70,'#fff5f5','#d22');txt('다음 장에 계속됩니다.',W/2,y+24,'bold 18px sans-serif','center','#b00');txt('합계 · 택배비 · 계좌번호는 마지막 장에만 표시됩니다.',W/2,y+50,'13px sans-serif','center','#b00')}txt(`${pi+1}/${chunks.length}`,W/2,H-24,'12px sans-serif','center','#777');out.push(jpg(c))}return out}
window.receiptImageBase64Pages=receiptPages765;

/* 정산 엑셀: 주소에 우편번호를 붙이지 않음 */
const oldExport=window.exportReceiptListXlsx||window.exportReceiptsXlsx;
window.exportReceiptListV765=function(){const rows=(typeof filteredReceipts==='function'?filteredReceipts():getReceipts()).map(r=>({'실명':r.customer?.name||'','닉네임':r.nick,'연락처':r.customer?.phone||'','주소':[r.customer?.address,r.customer?.detailAddress].filter(Boolean).join(' '),'합계':r.total,'입금상태':r.payment?.status||'','판매자':[...new Set((r.items||[]).map(x=>x.seller).filter(Boolean))].join(', ')}));if(typeof exportXlsx==='function')exportXlsx(rows,'FIRST_OMS_정산서목록.xlsx','정산서')};

/* 택배실: 정산서처럼 고객별 카드, 생각하지 않게 */
window.renderShipping=function(){
  let rs=getReceipts();
  const filter=$('shippingFilter')?.value||'all';
  if(filter==='paid')rs=rs.filter(r=>r.payment?.status==='paid');
  const arr=rs.filter(r=>r.customer).map((r,i)=>{
    const c=r.customer;
    const seller=[...new Set((r.items||[]).map(x=>x.seller).filter(Boolean))].join(', ')||window.__tenantCompany||'땡라이브';
    const code=typeof shippingCodeFor==='function'?shippingCodeFor({key:r.key,name:c.name,nick:r.nick,phone:c.phone,address:[c.address,c.detailAddress].filter(Boolean).join(' '),dates:new Set([r.date]),items:r.items,subtotal:r.subtotal,fee:r.fee,total:r.total}):r.key;
    return {key:r.key,code,jobNo:String(i+1).padStart(3,'0'),name:c.name,nick:r.nick,phone:c.phone,address:[c.address,c.detailAddress].filter(Boolean).join(' '),seller,items:r.items,subtotal:r.subtotal,fee:r.fee,total:r.total,dates:new Set([r.date])};
  });
  window.currentShipping=arr;
  const box=$('shippingTable'); if(!box)return;
  if(!arr.length){box.innerHTML='<div class="empty">택배 대상이 없습니다.</div>';return}
  let html='<div class="v765-toolbar"><button class="btn" onclick="toggleAllShippingPrintV747(true)">전체선택</button><button class="btn secondary" onclick="toggleAllShippingPrintV747(false)">선택해제</button><button class="btn" onclick="printShippingSelectedV747()">선택 택배리스트 출력</button><button class="btn secondary" onclick="printShipping()">전체 택배리스트 출력</button><button class="btn secondary" onclick="printKimchiListV748()">🥬 김치 전용</button></div>';
  for(const g of arr){
    const st=state.shippingScans?.[g.code]||{};
    const status=st.shipmentScanAt?'🚚 출고준비완료':(st.packingCompletedAt||st.at?'🟢 포장완료':'⏳ 포장대기');
    let items='';
    for(const it of g.items){
      const a=window.parseProductAnnotationsV765(it.item);
      const calc=window.packCalcV750?window.packCalcV750(it):{actualQty:it.qty,actualUnit:'개'};
      const setInfo=a.setQty?'<br><small>1세트='+a.setQty+E(a.setUnit)+'</small>':'';
      items+='<div class="v765-ship-item"><b>#'+E(it.number||'')+'</b><div><b>'+E(it.item)+'</b><br><span class="v765-muted">'+E(annText(it.item))+'</span></div><div><b>실제로 넣기: '+E(calc.actualQty)+E(calc.actualUnit)+'</b>'+setInfo+'</div><div>단가<br><b>'+M(it.unit)+'</b></div><div>수량<br><b>'+E(it.qty)+'</b></div></div>';
    }
    html+='<div class="v765-shipping-card"><div class="v765-shipping-head"><div><input type="checkbox" class="v7474-ship-check v747-ship-check" data-code="'+E(g.code)+'"></div><div><div class="v765-big">'+E(g.jobNo)+'번 · '+E(g.name)+'</div><div class="v765-muted">닉네임 '+E(g.nick)+'</div></div><div><b>판매자: '+E(g.seller)+'</b><br><span class="v765-chip">'+status+'</span></div><div>'+E(g.address)+'<br><b>'+E(g.phone)+'</b></div><div><b>총 '+M(g.total)+'</b><br><small>배송비 '+M(g.fee)+'</small></div><div><button class="btn secondary" onclick="openReceiptDetail(\''+E(g.key)+'\')">정산서 보기</button></div></div><div class="v765-ship-items">'+items+'</div><div class="v765-totals"><span>상품합계 '+M(g.subtotal)+'</span><span>택배비 '+M(g.fee)+'</span><strong>총 결제금액 '+M(g.total)+'</strong></div></div>';
  }
  box.innerHTML=html;
};

/* 김치: 고객 1명당 한번만 + 고객별 품목 합산 */
window.printKimchiListV748=function(){
  window.renderShipping();
  const src=window.currentShipping||[],cust=new Map();
  for(const g of src){
    const items=(g.items||[]).filter(x=>/(김치|깍두기|총각|열무|배추|파김치|갓김치|백김치|동치미|겉절이)/i.test(String(x.item||'')));
    if(!items.length)continue;
    const ck=D(g.phone)||N(g.name)||N(g.nick);
    if(!cust.has(ck))cust.set(ck,{...g,items:[]});
    const z=cust.get(ck), im=new Map(z.items.map(x=>[[x.number,x.item].join('|'),x]));
    for(const it of items){const k=[it.number,it.item].join('|');if(im.has(k)){im.get(k).qty+=Number(it.qty)||0;im.get(k).amount+=Number(it.amount)||0}else{const cp={...it};z.items.push(cp);im.set(k,cp)}}
  }
  const arr=[...cust.values()]; if(!arr.length)return alert('김치 주문이 없습니다.');
  const total=new Map();
  for(const g of arr)for(const it of g.items){const k=N(it.item);const z=total.get(k)||{item:it.item,qty:0,customers:[]};z.qty+=Number(it.qty)||0;z.customers.push(String(g.name||g.nick)+'('+String(g.nick||'')+') '+String(it.qty));total.set(k,z)}
  const totalRows=[...total.values()].map(x=>'<tr><td>'+E(x.item)+'</td><td class="qty">'+x.qty+'</td><td>'+x.customers.map(E).join('<br>')+'</td></tr>').join('');
  const customerSections=arr.map(g=>'<section><h3>'+E(g.name)+' / '+E(g.nick)+'</h3><ul>'+g.items.map(it=>'<li>'+E(it.item)+' × <b>'+E(it.qty)+'</b></li>').join('')+'</ul></section>').join('');
  const html='<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,\'Noto Sans KR\',sans-serif;padding:24px;color:#111}h1{color:#dd5a00}table{width:100%;border-collapse:collapse;margin:12px 0 28px}th,td{border:1px solid #999;padding:9px}th{background:#fff0e0}.qty{font-size:20px;font-weight:900}</style></head><body><h1>🥬 김치 준비 총괄표</h1><table><thead><tr><th>김치</th><th>총 수량</th><th>주문 고객</th></tr></thead><tbody>'+totalRows+'</tbody></table><h2>고객별 김치 주문</h2>'+customerSections+'<script>window.onload=()=>window.print()<\\/script></body></html>';
  const w=window.open('','_blank'); w.document.write(html); w.document.close();
};

/* 오늘은 오늘만: 서버 state를 우선, 고객DB만 영구 유지 */
async function refreshToday(){try{const r=await fetch('/api/state?ts='+Date.now(),{cache:'no-store'}),d=await r.json();if(!r.ok||!d.state)return;const customers=state.customers||[];state={...state,...d.state,customers:Array.isArray(d.state.customers)?d.state.customers:customers};try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}const t=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if($('broadcastDate'))$('broadcastDate').value=t;if($('receiptDate'))$('receiptDate').value=t;if($('recordDate')&&!$('recordDate').value)$('recordDate').value=t;window.autoMatchAll();renderOrders?.();renderCustomers?.();renderReceipts?.();renderPayments?.();renderShipping?.();updateKpi?.()}catch(e){console.warn('오늘 상태 동기화 실패',e)}}
window.addEventListener('load',()=>{setTimeout(()=>{window.ensureV765ReceiptToolbar?.();refreshToday()},900)});
})();
