const fs = require('fs');
const lines = fs.readFileSync('C:/Users/tirta/.gemini/antigravity-ide/brain/32cb0249-3707-47c8-b351-fd110e394c26/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');
let codeToInsert = '';
for(let l of lines) {
  if(l.includes('Laporan Vendor Washing / Laundry')) {
    const j = JSON.parse(l);
    if(j.content && j.content.includes('activeTab === "washing"')) {
      const match = j.content.substring(j.content.indexOf('{/* TAB: Laporan Washing */}'));
      codeToInsert = match;
      break;
    }
  }
}
if(codeToInsert) {
  let file = fs.readFileSync('src/app/(owner)/buat-spk/page.tsx', 'utf8');
  if(!file.includes('TAB: Laporan Washing')) {
    file = file.replace('        </div>\r\n      )}', '        </div>\r\n      )}\n\n' + codeToInsert);
    fs.writeFileSync('src/app/(owner)/buat-spk/page.tsx', file);
    console.log("Restored washing tab!");
  } else {
    console.log("Already there.");
  }
}