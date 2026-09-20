const fs = require("fs");
const path = require("path");

// Pages that were skipped because they use non-standard function names
// Map: page path -> fetch function name
const manualMap = {
  "(owner)/atur-vendor/page.tsx": "load",
  "(owner)/gudang/page.tsx": null,        // will auto-detect
  "(owner)/laporan-spk/page.tsx": null,
  "(owner)/mutasi-stok/page.tsx": null,
  "(owner)/pelanggan/page.tsx": null,
  "(owner)/penjualan/page.tsx": null,
  "(owner)/piutang/page.tsx": null,
  "(owner)/retail-offline/page.tsx": null,
  "(owner)/retur-produksi/page.tsx": null,
  "(owner)/barang-jadi/page.tsx": null,
  "(owner)/karyawan/page.tsx": null,
};

// More patterns to detect
const fnPatterns = [
  /const (load)\s*=/,
  /const (get\w+)\s*=\s*(?:async|useCallback)/,
  /const (fetch\w+)\s*=/,
  /const (load\w+)\s*=/,
  /const (refresh\w*)\s*=/,
];

let patched = 0;

for (const [relPath, forcedFn] of Object.entries(manualMap)) {
  const filePath = path.join("src", "app", relPath);
  if (!fs.existsSync(filePath)) { console.log("NOT FOUND: " + relPath); continue; }

  let content = fs.readFileSync(filePath, "utf-8");

  if (content.includes("konveksi-sync")) {
    console.log("Already done: " + relPath);
    continue;
  }

  let syncFn = forcedFn;

  if (!syncFn) {
    // Try to auto-detect
    for (const pat of fnPatterns) {
      const m = content.match(pat);
      if (m) { syncFn = m[1]; break; }
    }
  }

  if (!syncFn) {
    // Last resort: check if there's a useEffect(() => { someFunc(); }, [])
    const m = content.match(/useEffect\(\(\)\s*=>\s*\{\s*(\w+)\(\)/);
    if (m) syncFn = m[1];
  }

  if (!syncFn) {
    console.log("SKIP (still no fn): " + relPath);
    continue;
  }

  // Check if the function is actually defined in the file
  if (!content.includes("const " + syncFn) && !content.includes("function " + syncFn)) {
    console.log("SKIP (fn " + syncFn + " not defined): " + relPath);
    continue;
  }

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

  const returnIdx = content.indexOf("\n  return (");
  if (returnIdx === -1) { console.log("SKIP (no return): " + relPath); continue; }

  content = content.slice(0, returnIdx) + syncEffect + content.slice(returnIdx);
  fs.writeFileSync(filePath, content, "utf-8");
  patched++;
  console.log("Patched [" + syncFn + "]: " + relPath);
}

console.log("\nDone. Patched: " + patched);
