/* OMS v7.58: seller labels + strict daily workspace + richer date archive */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function setTodayInputs(){const d=today();['broadcastDate','receiptDate'].forEach(id=>{const el=$(id);if(el)el.value=d});}
function sellerOfItems(items){const a=[...new Set((items||[]).map(x=>String(x.seller||'').trim()).filter(Boolean))];return a.join(' / ')||(window.__tenantCompany||state?.settings?.company||'미지정')}
window.sellerOfItemsV758=sellerOfItems;

/* 서버의 오늘 상태를 최종 기준으로 다시 받아 오래된 localStorage 화면이 재등장하지 않게 함 */
async function forceTodayState(){
 try{
  const r=await fetch('/api/state?today=1&ts='+Date.now(),{cache:'no-store'});if(!r.ok)return;
  const d=await r.json(),remote=d.state;if(!remote)return;
  state={...state,...remote,settings:{...state.settings,...(remote.settings||{})}};
  try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
  setTodayInputs();window.renderAll?.();
 }catch(e){console.warn('오늘 업무상태 동기화 실패',e)}
}

/* 날짜별 기록실: 판매리스트/정산/택배 상태까지 한 번에 다시 확인 */
const oldLoad=window.loadRecordsV747;
if(typeof oldLoad==='function')window.loadRecordsV747=async function(){
 await oldLoad.apply(this,arguments);
 const d=$('recordDate')?.value||today();
 try{
  const a=await fetch('/api/archive?date='+encodeURIComponent(d)+'&ts='+Date.now(),{cache:'no-store'}).then(r=>r.json());
  const st=a.archive?.state||a.state;if(!st)return;
  let box=$('v758FullArchive');if(!box){box=document.createElement('div');box.id='v758FullArchive';box.className='card';$('v755ArchiveReceipts')?.insertAdjacentElement('afterend',box)||$('archiveSummary')?.insertAdjacentElement('afterend',box)}
  const orders=Array.isArray(st.orders)?st.orders:[], scans=st.shippingScans||{};
  const groups=new Map();orders.forEach(o=>{const k=(o.customerId||o.nick)+'|'+(o.date||d);if(!groups.has(k))groups.set(k,{nick:o.nick,name:'',seller:new Set(),items:[],date:o.date||d});const g=groups.get(k);if(o.seller)g.seller.add(o.seller);g.items.push(o)});
  const customers=st.customers||[];for(const g of groups.values()){const first=g.items[0]||{};const c=customers.find(x=>x.id===first.customerId)||{};g.name=c.name||g.nick}
  box.innerHTML=`<h3>${E(d)} 전체 업무기록</h3>
  <div style="margin:8px 0 14px"><b>판매리스트 ${orders.length}행</b> · 고객별 주문 ${groups.size}건 · 택배상태 ${Object.keys(scans).length}건</div>
  <div class="scroll"><table><thead><tr><th>날짜</th><th>판매자</th><th>고객</th><th>품번</th><th>상품</th><th>수량</th><th>금액</th></tr></thead><tbody>${orders.length?orders.map(o=>`<tr><td>${E(o.date||d)}</td><td><b>${E(o.seller||'미지정')}</b></td><td>${E(o.nick||'')}</td><td>#${E(o.number||'')}</td><td>${E(o.item||'')}</td><td>${Number(o.qty)||0}</td><td>${(Number(o.amount)||0).toLocaleString()}원</td></tr>`).join(''):'<tr><td colspan="7">저장된 판매내역이 없습니다.</td></tr>'}</tbody></table></div>
  <h4 style="margin-top:18px">고객별 과거 주문</h4><div class="scroll"><table><thead><tr><th>판매자</th><th>고객</th><th>상품수</th><th>상품내역</th></tr></thead><tbody>${[...groups.values()].map(g=>`<tr><td>${E([...g.seller].join(' / ')||'미지정')}</td><td><b>${E(g.name)}</b><br>${E(g.nick)}</td><td>${g.items.length}</td><td>${g.items.map(x=>`#${E(x.number)} ${E(x.item)} ×${Number(x.qty)||0}`).join('<br>')}</td></tr>`).join('')}</tbody></table></div>`;
 }catch(e){console.warn('전체 과거기록 표시 실패',e)}
};

/* 기록실은 기본 오늘, 과거 날짜를 사용자가 선택하면 그 날짜 조회 */
window.addEventListener('load',()=>{setTodayInputs();setTimeout(forceTodayState,350);if($('recordDate')&&!$('recordDate').value)$('recordDate').value=today();});
})();
