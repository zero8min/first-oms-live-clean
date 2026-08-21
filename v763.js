/* OMS v7.63 SOLAPI hard-fail/auto-recovery diagnostic */
(()=>{
 const $=id=>document.getElementById(id);
 window.testSolapiConnection=async function(){
  try{
   const r=await fetch('/api/solapi/diagnose?ts='+Date.now(),{cache:'no-store'}),d=await r.json();
   if(!r.ok)throw new Error(d.error||'진단 실패');
   if(!d.configured)throw new Error('실제 SOLAPI API Key/Secret/발신번호를 찾지 못했습니다. 솔라피 API 입력·연결에서 실제 키를 한 번 입력해 주세요.');
   alert(`SOLAPI 설정 확인 완료\n키 출처: ${d.source}\nAPI Key: ${d.apiKeyPrefix}****\n발신번호: ${d.sender}`);
  }catch(e){alert('SOLAPI 설정 확인 필요: '+e.message)}
 };
})();
