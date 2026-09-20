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
walk(path.join("src", "app"));

let issues = 0;

for (const page of pages) {
  const content = fs.readFileSync(page, "utf-8");
  if (!content.includes("konveksi-sync")) continue;

  const syncIdx = content.indexOf("konveksi-sync");
  if (syncIdx === -1) continue;

  // Find which function scope contains the sync block
  const before = content.slice(0, syncIdx);
  const fnMatches = [...before.matchAll(/^(?:export default )?(?:async )?function\s+(\w+)/mg)];
  if (fnMatches.length === 0) continue;

  const lastFn = fnMatches[fnMatches.length - 1];
  const isDefault = lastFn[0].includes("default");
  const fnName = lastFn[1];

  // If it's inside a small helper function (not the page component), it's wrong
  if (!isDefault && !fnName.includes("Page") && !fnName.includes("Layout") && !fnName.includes("Component")) {
    console.log("ISSUE: " + path.relative("src", page) + " -> inside '" + fnName + "'");
    issues++;
  }
}

console.log(issues === 0 ? "All OK - no misplaced hooks" : "\nTotal issues: " + issues);
