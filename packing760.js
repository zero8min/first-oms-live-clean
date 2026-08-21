(()=>{
'use strict';
let shipmentRefreshTimer=null;
const E760=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function stopShipmentRefresh760(){if(shipmentRefreshTimer){clearTimeout(shipmentRefreshTimer);shipmentRefreshTimer=null}}
async function refreshShipment760(silent=false){
 stopShipmentRefresh760();
 try{
  const u='/api/public/packing?tenant='+encodeURIComponent(job?.tenantCode||tenant)+'&code='+encodeURIComponent(job?.code||'')+'&token='+encodeURIComponent(token)+'&ts='+Date.now();
  const r=await fetch(u,{cache:'no-store'}),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'송장정보 조회 실패');job=d.job||job;
  showScanner();
 }catch(e){if(!silent)alert(e.message)}
}
window.refreshShipment760=refreshShipment760;
window.showScanner=function(){
 stopScan?.();stopShipmentRefresh760();const app=document.getElementById('app');if(!job)return loadJob();
 const tracking=String(job.trackingNumber||'').trim(),courier=String(job.courier||'CJ대한통운').trim()||'CJ대한통운';
 if(!tracking){
  app.innerHTML=`<div class="top"><div class="worker">${E760(worker)}님</div><button class="change" onclick="changeWorker()" disabled>포장 진행중</button></div><div style="text-align:center;padding:28px 8px"><div style="font-size:38px;font-weight:950">📦 포장완료</div><div style="font-size:22px;font-weight:900;margin:15px 0">${E760(job.jobNo||'')}번 / ${E760(job.name||job.nick||'고객')}</div><div class="notice warn"><b>송장정보를 기다리는 중입니다.</b><br>관리자가 발급된 송장 엑셀을 업로드하면 이 고객의 송장번호가 자동으로 표시됩니다.</div><button class="btn primary" onclick="refreshShipment760(false)">송장 다시 확인</button><div class="small">자동으로도 계속 확인합니다. 고객 검색이나 송장번호 입력은 하지 않아도 됩니다.</div></div>`;
  shipmentRefreshTimer=setTimeout(()=>refreshShipment760(true),3000);return;
 }
 app.innerHTML=`<div class="top"><div class="worker">${E760(worker)}님</div><button class="change" onclick="changeWorker()" disabled>포장 진행중</button></div><div style="text-align:center;padding:22px 6px"><div style="font-size:28px;font-weight:950;color:#14713b">✅ 송장 자동 대조완료</div><div style="font-size:22px;font-weight:900;margin:14px 0">${E760(job.jobNo||'')}번 / ${E760(job.name||job.nick||'고객')}</div><div class="notice ok" style="font-size:20px;line-height:1.7"><b>${E760(job.name||job.nick)}님 송장번호</b><br><span style="font-size:30px;font-weight:950">${E760(tracking)}</span><br>택배사: <b>${E760(courier)}</b></div><button class="btn good" style="font-size:26px" onclick="confirmShipment760(this)">포장완료 문자 전송</button><div class="small">누르면 송장번호가 저장되고 고객에게 배송안내 문자가 1회만 전송됩니다.</div></div>`;
};
window.confirmShipment760=async function(btn){
 if(locked)return;locked=true;stopShipmentRefresh760();const old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='문자 전송 중...'}
 try{
  const r=await fetch('/api/public/packing/confirm-shipment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantCode:job.tenantCode||tenant,code:job.code,worker,token})}),d=await r.json();
  if(!r.ok||!d.ok)throw new Error(d.error||'처리 실패');
  const msg=d.smsFailed?`<div class="notice smsfail">⚠️ 배송문자 발송실패<br>포장과 송장 연결은 완료되었습니다. 관리자가 나중에 재발송할 수 있습니다.</div>`:`<div class="notice ok">${d.already?'이미 발송된 주문이라 문자를 중복 발송하지 않았습니다.':'문자까지 발송되었습니다.'}</div>`;
  document.getElementById('app').innerHTML=`<div style="text-align:center;padding:28px 6px"><div class="done">✅ 완료!</div><p style="font-size:20px"><b>${E760(job.name||job.nick)}</b><br>송장번호 ${E760(d.trackingNumber)}<br>${E760(d.courier||'CJ대한통운')}</p>${msg}<div class="small">잠시 후 다음 포장 주문이 자동으로 표시됩니다.</div></div>`;
  setTimeout(()=>{job=null;locked=false;loadJob()},1400);
 }catch(e){alert(e.message);locked=false;if(btn){btn.disabled=false;btn.textContent=old||'포장완료 문자 전송'};refreshShipment760(true)}
};
window.addEventListener('pagehide',stopShipmentRefresh760);
})();
