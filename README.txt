OMS v7.50.1 CLEAN DEPLOY PACKAGE
All filenames are short ASCII names to avoid Render checkout errors such as "File name too long".
This package is rebuilt from the latest v7.50 source (the one with packing access-token, packing-unit conversion, QR packing sheets, barcode scan flow, and automatic delivery SMS).
Checks completed:
- server.js syntax: PASS
- verify-v750.js: ALL PASS
IMPORTANT:
1) Do not delete the live Render persistent data directory.
2) Old long/broken filenames that are already tracked in the GitHub repository must be deleted from GitHub. If they remain, Render can fail during git checkout before this new code is even read.

v7.60 추가
- 발급된 고객 송장 엑셀 업로드 시 날짜별 서버 저장
- 고객명/연락처/주소/택배코드로 자동 대조
- 택배팀은 상품 체크 후 [다 넣었어요]만 누르면 해당 고객 송장번호 자동 표시
- [포장완료 문자 전송] 버튼으로 송장번호/CJ대한통운 배송문자 1회 전송
- 같은 주문 문자 중복 발송 방지
- 문자 실패해도 포장/송장 연결은 완료, 관리자에서 재발송 가능
