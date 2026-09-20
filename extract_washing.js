const fs = require('fs');
const lines = fs.readFileSync('C:/Users/tirta/.gemini/antigravity-ide/brain/32cb0249-3707-47c8-b351-fd110e394c26/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');
for(let l of lines) {
  if(l.includes('Laporan Vendor Washing / Laundry')) {
    const j = JSON.parse(l);
    if(j.content && j.content.includes('activeTab === "washing"')) {
      const match = j.content.substring(j.content.indexOf('Laporan Washing'));
      fs.writeFileSync('washing_tab_code.txt', match);
      break;
    }
  }
}