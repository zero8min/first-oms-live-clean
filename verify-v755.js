const fs=require('fs');
const checks=[
 ['index.html','v755.js'],['index.html','v755.css'],
 ['v755.js','renderCustomerIssuesV755'],['v755.js','inferPackingRulesV755'],['v755.js','문자 전송 전 확인'],
 ['v755.js','전체 택배리스트 인쇄'],['v755.js','김치 준비 총괄표'],['v755.js','정산서 보관함'],
 ['packing.html','packing755.js'],['packing755.js','재고부족'],['server.js','/api/public/packing/item-status']
];
let bad=0;for(const [f,t] of checks){const ok=fs.existsSync(f)&&fs.readFileSync(f,'utf8').includes(t);console.log(ok?'PASS':'FAIL',f,t);if(!ok)bad++}process.exit(bad?1:0);
