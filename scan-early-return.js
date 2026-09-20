const fs = require("fs");
const path = require("path");

const pages = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walk(fp);
    else if (f === "page.tsx") pages.push(fp);
  }
}
walk(path.join("src","app"));

let issues = 0;

for (const page of pages) {
  let content = fs.readFileSync(page, "utf-8");
  if (!content.includes("konveksi-sync")) continue;

  // Find index of first early return (return <... before return ())
  const syncIdx = content.indexOf("konveksi-sync");
  
  // Find all "return <" patterns (early returns) before the sync block
  const earlyReturnPattern = /if\s*\([^)]+\)\s*return\s*</g;
  let earlyReturnIdx = -1;
  let m;
  while ((m = earlyReturnPattern.exec(content)) !== null) {
    if (m.index < syncIdx) earlyReturnIdx = m.index;
  }

  if (earlyReturnIdx !== -1 && earlyReturnIdx < syncIdx) {
    console.log("ISSUE (early return before sync): " + path.relative("src/app", page));
    issues++;
    
    // Auto fix: remove sync block from current position and find a better spot
    const syncBlockPattern = /\n  \/\/ Real-time sync[^\n]*\n  useEffect\(\(\) => \{\n    const handler = \(\) => \w+\(\);\n    window\.addEventListener\("konveksi-sync", handler\);\n    return \(\) => window\.removeEventListener\("konveksi-sync", handler\);\n  \/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\n  }, \[\]\);\n/;
    const syncMatch = content.match(syncBlockPattern);
    if (!syncMatch) { console.log("  SKIP: block pattern not found"); continue; }
    
    const syncBlock = syncMatch[0];
    // Remove from wrong position
    content = content.replace(syncBlock, "\n");
    
    // Find the last useEffect before earlyReturn (now position shifted)
    const newEarlyIdx = content.search(/if\s*\([^)]+\)\s*return\s*</);
    if (newEarlyIdx === -1) { console.log("  SKIP: no early return found after remove"); continue; }
    
    // Insert before the early return
    const lineStart = content.lastIndexOf("\n", newEarlyIdx);
    content = content.slice(0, lineStart) + syncBlock.trimEnd() + "\n" + content.slice(lineStart);
    
    fs.writeFileSync(page, content, "utf-8");
    console.log("  Fixed!");
  }
}

if (issues === 0) console.log("All OK - no early-return-before-sync issues");
else console.log("\nTotal fixed:", issues);
