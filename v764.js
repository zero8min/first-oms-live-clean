/* OMS v7.64 FINAL MULTI-PAGE MMS FIX */
(()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const money=v=>Number(v||0).toLocaleString('ko-KR')+'원';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function splitPages(r){
    const items=Array.isArray(r?.items)?r.items:[];
    const per=8; // 긴 상품명/옵션까지 고려해 A4 한 장에 안전하게 8행
    const pages=[];
    for(let i=0;i<items.length;i+=per) pages.push(items.slice(i,i+per));
    if(!pages.length) pages.push([]);
    return pages;
  }

  function jpegFromCanvas(c){
    for(const q of [.78,.70,.62,.54,.46]){
      const b64=c.toDataURL('image/jpeg',q).split(',')[1];
      if(Math.ceil(b64.length*3/4)<190*1024) return b64;
    }
    return c.toDataURL('image/jpeg',.42).split(',')[1];
  }

  function wrapText(ctx,text,maxWidth){
    text=String(text||''); const out=[]; let line='';
    for(const ch of text){ const t=line+ch; if(ctx.measureText(t).width>maxWidth&&line){out.push(line);line=ch}else line=t; }
    if(line) out.push(line); return out.slice(0,2);
  }

  async function renderPage(r,items,page,pages){
    const final=page===pages;
    const W=794,H=1123,c=document.createElement('canvas'); c.width=W;c.height=H;
    const x=c.getContext('2d'), L=38,R=W-38;
    const box=(a,b,w,h,fill='#fff',stroke='#777')=>{x.fillStyle=fill;x.fillRect(a,b,w,h);x.strokeStyle=stroke;x.strokeRect(a,b,w,h)};
    const text=(t,a,b,font='14px sans-serif',align='left',color='#111')=>{x.font=font;x.textAlign=align;x.textBaseline='middle';x.fillStyle=color;x.fillText(String(t??''),a,b)};
    x.fillStyle='#fff';x.fillRect(0,0,W,H);
    text(window.__tenantCompany||state?.settings?.company||'땡라이브',L,28,'bold 13px sans-serif');
    text('정 산 서',W/2,64,'bold 34px sans-serif','center');
    text(`${r.date||''} · ${page}/${pages}`,R,30,'13px sans-serif','right');
    let y=102;
    box(L,y,R-L,48,'#f5f5f5');text(`${r.customer?.name||r.nick}님 (${r.nick})`,L+12,y+24,'bold 19px sans-serif');y+=58;
    box(L,y,R-L,38);text(`연락처  ${r.customer?.phone||'미등록'}`,L+12,y+19);y+=38;
    box(L,y,R-L,54);text(`주소  ${[r.customer?.address,r.customer?.detailAddress].filter(Boolean).join(' ')||'미등록'}`,L+12,y+27,'13px sans-serif');y+=66;
    const widths=[65,325,75,110,115],heads=['품번','상품명/옵션','수량','단가','금액'];let cx=L;
    heads.forEach((h,i)=>{box(cx,y,widths[i],36,'#222','#222');text(h,cx+widths[i]/2,y+18,'bold 13px sans-serif','center','#fff');cx+=widths[i]});y+=36;
    items.forEach((it,i)=>{
      cx=L;const vals=['#'+(it.number||i+1),it.item,it.qty,money(it.unit),money(it.amount)];
      vals.forEach((v,j)=>{box(cx,y,widths[j],58);if(j===1){x.font='12px sans-serif';const lines=wrapText(x,v,widths[j]-12);lines.forEach((ln,k)=>text(ln,cx+6,y+20+k*18,'12px sans-serif','left'));}else{text(v,cx+widths[j]/2,y+29,'13px sans-serif','center')}cx+=widths[j]});y+=58;
    });
    y+=18;
    if(final){
      box(L,y,R-L,44,'#f7f7f7');text('상품합계',L+12,y+22,'bold 15px sans-serif');text(money(r.subtotal),R-12,y+22,'bold 16px sans-serif','right');y+=44;
      box(L,y,R-L,44,'#fff7d6','#b59600');text('배송비',L+12,y+22,'bold 15px sans-serif');text(money(r.fee),R-12,y+22,'bold 16px sans-serif','right');y+=54;
      box(L,y,R-L,62,'#fff','#111');text('총 결제금액',L+12,y+31,'bold 20px sans-serif');text(money(r.total),R-12,y+31,'bold 28px sans-serif','right','#c00');
    }else{
      box(L,y,R-L,76,'#fff2f2','#d22');text('다음 장에 계속됩니다.',W/2,y+25,'bold 19px sans-serif','center','#b00');text('배송비와 총 결제금액은 마지막 장에만 표시됩니다.',W/2,y+53,'bold 14px sans-serif','center','#b00');
    }
    text(`${page}/${pages}`,W/2,H-25,'12px sans-serif','center','#777');
    return jpegFromCanvas(c);
  }

  async function pageImages(r){
    const chunks=splitPages(r), out=[];
    for(let i=0;i<chunks.length;i++) out.push(await renderPage(r,chunks[i],i+1,chunks.length));
    return out;
  }
  window.receiptImageBase64Pages=pageImages;

  function preview(r,imgs){
    return new Promise(resolve=>{
      const back=document.createElement('div');back.className='v755-preview-back';
      back.innerHTML=`<div class="v755-preview" style="max-width:920px"><h2>정산서 문자 전송 확인 · 총 ${imgs.length}장</h2><p><b>${esc(r.customer?.name||r.nick)}</b> · ${esc(r.customer?.phone||'')}<br><b>${imgs.length}장의 이미지가 각각 MMS로 전송됩니다.</b><br>배송비와 총 결제금액은 마지막 장에만 표시됩니다.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;max-height:58vh;overflow:auto">${imgs.map((im,i)=>`<div><b>${i+1}/${imgs.length}장</b><img style="width:100%;display:block;margin-top:5px" src="data:image/jpeg;base64,${im}"></div>`).join('')}</div><div class="v755-preview-actions"><button class="btn secondary" id="v764cancel">취소</button><button class="btn" id="v764send">${imgs.length}장 모두 전송</button></div></div>`;
      document.body.appendChild(back);
      back.querySelector('#v764cancel').onclick=()=>{back.remove();resolve(false)};
      back.querySelector('#v764send').onclick=()=>{back.remove();resolve(true)};
    });
  }

  window.sendMmsByKey=async function(key,button,skipConfirm=false){
    const r=(typeof getReceipts==='function'?getReceipts():[]).find(x=>x.key===key);
    if(!r) throw new Error('정산서를 찾을 수 없습니다.');
    const cu=r.customer;if(!cu?.phone) throw new Error('고객 연락처가 없습니다.');
    const old=button?.textContent||'문자전송'; if(button){button.disabled=true;button.textContent='이미지 준비 중...'}
    try{
      const imgs=await pageImages(r);
      if(!skipConfirm){const ok=await preview(r,imgs);if(!ok)return false;}
      for(let i=0;i<imgs.length;i++){
        if(button)button.textContent=`전송 ${i+1}/${imgs.length}`;
        const final=i===imgs.length-1;
        const payload={
          to:cu.phone,
          imageBase64:imgs[i],
          subject:`${window.__tenantCompany||'땡라이브'} 정산서 ${i+1}/${imgs.length}`,
          text:final?`${r.nick}님 정산서 마지막 장입니다. 총 결제금액 ${money(r.total)} (배송비 ${money(r.fee)} 포함)`:`${r.nick}님 정산서 ${i+1}/${imgs.length}장입니다. 다음 장이 이어집니다.`,
          date:r.date,nickname:r.nick,name:cu.name||'',total:final?r.total:0,page:i+1,pages:imgs.length,finalPage:final
        };
        const resp=await fetch('/api/mms/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const d=await resp.json().catch(()=>({}));
        if(!resp.ok||d.ok===false) throw new Error(`${i+1}/${imgs.length}장 전송 실패: ${d.error||('HTTP '+resp.status)}`);
        if(i<imgs.length-1) await sleep(1400);
      }
      if(!skipConfirm) alert(`${r.nick}님 정산서 ${imgs.length}장 모두 전송 완료\n배송비와 총 결제금액은 마지막 장에만 표시됩니다.`);
      return true;
    } finally { if(button){button.disabled=false;button.textContent=old;} }
  };

  // 테스트 전송도 여러 장이면 전부 발송
  window.sendTestReceiptMmsV747=async function(button){
    const phone=(document.getElementById('testSmsPhone')?.value||'').trim();
    const key=document.getElementById('testReceiptKey')?.value;
    if(!phone)return alert('테스트 받을 연락처를 입력해 주세요.');
    const r=(typeof getReceipts==='function'?getReceipts():[]).find(x=>x.key===key);if(!r)return alert('테스트할 정산서를 선택해 주세요.');
    const imgs=await pageImages(r);const old=button?.textContent||'테스트 전송';if(button){button.disabled=true;button.textContent='전송 중...'}
    try{for(let i=0;i<imgs.length;i++){const final=i===imgs.length-1;const resp=await fetch('/api/mms/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:phone,imageBase64:imgs[i],subject:`[테스트] ${window.__tenantCompany||'땡라이브'} 정산서 ${i+1}/${imgs.length}`,text:final?`테스트 정산서 마지막 장 · 총 결제금액 ${money(r.total)}`:`테스트 정산서 ${i+1}/${imgs.length}장`,date:r.date,nickname:r.nick,name:r.customer?.name||'',total:final?r.total:0,test:true,page:i+1,pages:imgs.length,finalPage:final})});const d=await resp.json().catch(()=>({}));if(!resp.ok||d.ok===false)throw new Error(`${i+1}장 실패: ${d.error||resp.status}`);if(i<imgs.length-1)await sleep(1400)}alert(`테스트 정산서 ${imgs.length}장 전송 완료`)}catch(e){alert('테스트 전송 실패: '+e.message)}finally{if(button){button.disabled=false;button.textContent=old}}
  };
})();
