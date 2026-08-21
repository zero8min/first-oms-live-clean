OMS v7.63 긴급 문자 수정
- SOLAPI Authorization 헤더 생성 직전 실제 ASCII 키 재검증
- 마스킹 값(••••••)이 들어오면 ByteString 오류 대신 명확한 설정 오류로 차단
- 거래처/구버전/백업/환경변수에서 정상 SOLAPI 키 자동 복구 검색
- 정상 키 발견 시 거래처 solapi-settings.json 자동 복구 저장
- /api/solapi/diagnose 추가
- 기존 고객DB/정산/택배 기능 유지
주의: 정상 API Key/Secret이 서버 어느 곳에도 없으면 실제 키를 솔라피 설정에 한 번 입력해야 합니다.
