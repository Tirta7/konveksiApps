const fs = require("fs");
const path = require("path");

// Scan all pages
const pages = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walk(fp);
    else if (f === "page.tsx") pages.push(fp);
  }
}
walk(path.join("src", "app"));

let fixed = 0;

for (const page of pages) {
  let content = fs.readFileSync(page, "utf-8");
  if (!content.includes("konveksi-sync")) continue;

  // Check if there's an early return BEFORE the konveksi-sync block
  // Pattern: if (...) return (...) appearing before the konveksi-sync useEffect
  
  const syncIdx = content.indexOf("// Real-time sync:");
  if (syncIdx === -1) continue;
  
  // Find any early "return (" that appears before syncIdx
  const beforeSync = content.slice(0, syncIdx);
  
  // Check for early return patterns like: if (loading) return (  or  if (!data) return
  const earlyReturnMatch = beforeSync.match(/\n  if \([^)]+\)\s*return[\s\S]{0,500}?\);\s*\n/);
  if (!earlyReturnMatch) continue;

  // This page has an early return BEFORE the sync useEffect — need to move sync before early return
  // Extract the full sync block
  const syncBlockMatch = content.match(/\n  \/\/ Real-time sync:[\s\S]*?\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\n  \}, \[\]\);\n/);
  if (!syncBlockMatch) {
    // Try alternate pattern
    const altMatch = content.match(/\n  \/\/ Real-time sync:[\s\S]*?\}, \[.*?\]\);\n/);
    if (!altMatch) { console.log("SKIP (cant extract block):", page); continue; }
  }
  
  const syncBlock = syncBlockMatch ? syncBlockMatch[0] : content.match(/\n  \/\/ Real-time sync:[\s\S]*?\}, \[.*?\]\);\n/)[0];
  
  // Remove sync block from current position
  let newContent = content.replace(syncBlock, "\n");
  
  // Find position of the FIRST early return and insert sync block just before it
  const earlyReturnIdx = newContent.search(/\n  if \([^)]+\)\s*return/);
  if (earlyReturnIdx === -1) { console.log("SKIP (no early return found after removal):", page); continue; }
  
  newContent = newContent.slice(0, earlyReturnIdx) + syncBlock + newContent.slice(earlyReturnIdx);
  
  fs.writeFileSync(page, newContent, "utf-8");
  fixed++;
  console.log("Fixed:", page.replace(/\\/g, "/").split("src/app/")[1]);
}

console.log("\nDone. Fixed:", fixed);
