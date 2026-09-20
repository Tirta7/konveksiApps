const fs = require("fs");
const path = require("path");

const pagesDir = path.join("src", "app", "(owner)");
const pages = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) walk(fp);
    else if (f === "page.tsx") pages.push(fp);
  }
}
walk(pagesDir);

let patched = 0;
for (const page of pages) {
  let content = fs.readFileSync(page, "utf-8");
  
  // Skip if already patched
  if (content.includes("konveksi-sync")) continue;
  
  // Find the main data-fetch function name
  let syncFn = null;
  if (/const fetchData\s*=/.test(content)) syncFn = "fetchData";
  else if (/const loadData\s*=/.test(content)) syncFn = "loadData";
  else if (/const loadList\s*=/.test(content)) syncFn = "loadList";
  else if (/const fetchAll\s*=/.test(content)) syncFn = "fetchAll";
  else if (/const load\s*=\s*useCallback/.test(content)) syncFn = "load";
  
  if (!syncFn) continue;
  
  // Inject a new useEffect that listens to konveksi-sync
  const syncEffect = [
    "",
    "  // Real-time sync: refresh data when another admin makes changes",
    "  useEffect(() => {",
    "    window.addEventListener(\"konveksi-sync\", " + syncFn + ");",
    "    return () => window.removeEventListener(\"konveksi-sync\", " + syncFn + ");",
    "  }, [" + syncFn + "]);"
  ].join("\n");
  
  // Find the first return ( and inject just before it
  const returnIdx = content.indexOf("\n  return (");
  if (returnIdx === -1) continue;
  
  content = content.slice(0, returnIdx) + syncEffect + content.slice(returnIdx);
  fs.writeFileSync(page, content, "utf-8");
  patched++;
  console.log("Patched: " + path.basename(path.dirname(page)) + "/" + path.basename(page));
}
console.log("Done. Patched " + patched + " files.");
