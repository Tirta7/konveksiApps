const fs = require("fs");
const path = require("path");

// All pages to scan - including non-owner pages
const scanDirs = [
  path.join("src", "app", "(owner)"),
  path.join("src", "app", "cmt"),
  path.join("src", "app", "washing"),
  path.join("src", "app", "finishing"),
  path.join("src", "app", "bersih-benang"),
  path.join("src", "app", "gudang-produksi"),
  path.join("src", "app", "spk"),
];

const pages = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) walk(fp);
    else if (f === "page.tsx") pages.push(fp);
  }
}

for (const d of scanDirs) walk(d);

// All known fetch function patterns to detect
const fnCandidates = [
  "fetchData",
  "loadData",
  "loadList",
  "fetchAll",
  "loadAll",
  "refresh",
];

let patched = 0;
let skipped = 0;

for (const page of pages) {
  let content = fs.readFileSync(page, "utf-8");

  // Skip if already patched
  if (content.includes("konveksi-sync")) {
    console.log("Already patched: " + page.replace(/\\/g, "/").split("src/app/")[1]);
    continue;
  }

  // Find which function handles data loading
  let syncFn = null;
  for (const fn of fnCandidates) {
    // Match: const fetchData = or const fetchData = useCallback or async function fetchData
    if (
      new RegExp("const " + fn + "\\s*=").test(content) ||
      new RegExp("async function " + fn + "\\b").test(content) ||
      new RegExp("function " + fn + "\\b").test(content)
    ) {
      syncFn = fn;
      break;
    }
  }

  if (!syncFn) {
    console.log("SKIP (no fetch fn): " + page.replace(/\\/g, "/").split("src/app/")[1]);
    skipped++;
    continue;
  }

  // Build the sync effect
  const syncEffect = [
    "",
    "  // Real-time sync: auto-refresh when another admin makes a change",
    "  useEffect(() => {",
    "    const handler = () => " + syncFn + "();",
    "    window.addEventListener(\"konveksi-sync\", handler);",
    "    return () => window.removeEventListener(\"konveksi-sync\", handler);",
    "  // eslint-disable-next-line react-hooks/exhaustive-deps",
    "  }, []);"
  ].join("\n");

  // Insert just before the first "return (" in the component
  const returnIdx = content.indexOf("\n  return (");
  if (returnIdx === -1) {
    console.log("SKIP (no return): " + page.replace(/\\/g, "/").split("src/app/")[1]);
    skipped++;
    continue;
  }

  content = content.slice(0, returnIdx) + syncEffect + content.slice(returnIdx);
  fs.writeFileSync(page, content, "utf-8");
  patched++;
  console.log("Patched: " + page.replace(/\\/g, "/").split("src/app/")[1]);
}

console.log("\nDone. Patched: " + patched + ", Skipped: " + skipped);
