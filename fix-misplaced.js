const fs = require("fs");
const path = require("path");

const problematic = [
  { file: "src/app/(owner)/barang-jadi/page.tsx",           helperFn: "fmtDT" },
  { file: "src/app/(owner)/daftar-spk/page.tsx",            helperFn: "formatTgl" },
  { file: "src/app/(owner)/gudang/page.tsx",                helperFn: "formatTgl" },
  { file: "src/app/(owner)/laporan-spk/[batchId]/page.tsx", helperFn: "fmtDT" },
  { file: "src/app/(owner)/peta-perjalanan/page.tsx",       helperFn: "fmtDate" },
  { file: "src/app/(owner)/retail-offline/page.tsx",        helperFn: "formatTgl" },
  { file: "src/app/(owner)/retur-produksi/page.tsx",        helperFn: "formatTgl" },
  { file: "src/app/cmt/[id]/page.tsx",                      helperFn: "RadialProgress" },
];

// The sync block pattern to find and remove
const syncComment = "// Real-time sync: auto-refresh when another admin makes a change";
const syncCommentAlt = "// Real-time sync:";

let fixed = 0;

for (const { file, helperFn } of problematic) {
  if (!fs.existsSync(file)) { console.log("NOT FOUND: " + file); continue; }
  
  let content = fs.readFileSync(file, "utf-8");
  
  // Find and extract the misplaced sync block (it has 2 patterns)
  // Pattern 1: with eslint-disable comment
  const syncPattern = /\n  \/\/ Real-time sync[^\n]*\n  useEffect\(\(\) => \{\n    const handler = \(\) => \w+\(\);\n    window\.addEventListener\("konveksi-sync", handler\);\n    return \(\) => window\.removeEventListener\("konveksi-sync", handler\);\n  \/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\n  }, \[\]\);\n/;
  
  // Pattern 2: with [fn] deps
  const syncPattern2 = /\n  \/\/ Real-time sync[^\n]*\n  useEffect\(\(\) => \{\n    window\.addEventListener\("konveksi-sync", \w+\);\n    return \(\) => window\.removeEventListener\("konveksi-sync", \w+\);\n  }, \[\w+\]\);\n/;

  let syncBlock = null;
  if (syncPattern.test(content)) {
    syncBlock = content.match(syncPattern)[0];
  } else if (syncPattern2.test(content)) {
    syncBlock = content.match(syncPattern2)[0];
  }

  if (!syncBlock) { console.log("SKIP (block not found): " + file); continue; }

  // Remove sync block from wrong position
  content = content.replace(syncBlock, "\n");
  
  // Now find the correct position: just before the first "return (" in the main component
  // The main component return should come after all the hooks
  // Strategy: find the last useEffect before the first return (
  const returnIdx = content.search(/\n  return \(/);
  if (returnIdx === -1) { console.log("SKIP (no return): " + file); continue; }
  
  // Build a clean sync block
  // Extract the function name from the sync block
  const fnMatch = syncBlock.match(/const handler = \(\) => (\w+)\(\)/) || syncBlock.match(/window\.addEventListener\("konveksi-sync", (\w+)\)/);
  const syncFn = fnMatch ? fnMatch[1] : "fetchData";
  
  const newSyncBlock = [
    "",
    "  // Real-time sync: auto-refresh when another admin makes a change",
    "  useEffect(() => {",
    "    const handler = () => " + syncFn + "();",
    "    window.addEventListener(\"konveksi-sync\", handler);",
    "    return () => window.removeEventListener(\"konveksi-sync\", handler);",
    "  // eslint-disable-next-line react-hooks/exhaustive-deps",
    "  }, []);"
  ].join("\n");
  
  // Insert just before return (
  content = content.slice(0, returnIdx) + newSyncBlock + content.slice(returnIdx);
  
  fs.writeFileSync(file, content, "utf-8");
  fixed++;
  console.log("Fixed [" + syncFn + "]: " + file);
}

console.log("\nDone. Fixed: " + fixed);
