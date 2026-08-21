OMS v7.50.1 CLEAN DEPLOY PACKAGE
All filenames are short ASCII names to avoid Render checkout errors such as "File name too long".
This package is rebuilt from the latest v7.50 source (the one with packing access-token, packing-unit conversion, QR packing sheets, barcode scan flow, and automatic delivery SMS).
Checks completed:
- server.js syntax: PASS
- verify-v750.js: ALL PASS
IMPORTANT:
1) Do not delete the live Render persistent data directory.
2) Old long/broken filenames that are already tracked in the GitHub repository must be deleted from GitHub. If they remain, Render can fail during git checkout before this new code is even read.
