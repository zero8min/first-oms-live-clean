OMS767 긴급 수정
- 대시보드 하단 코드 노출 원인 제거
- 인라인 스크립트를 끊던 출력용 HTML 내부 script 종료태그 문제 수정
- 깨진 printOne 문자열 수정
- 버튼 이벤트를 막던 JavaScript 문법 오류 제거
- 기존 OMS766 기능/데이터 구조 유지
- Render persistent data 폴더를 삭제하거나 덮어쓰지 말 것
검사: index.html의 모든 인라인 script node --check 통과, server.js 및 외부 JS node --check 통과
