const fs = require("fs");

// Pages with inline fetch (no named function) - need to refactor useEffect
const targets = [
  {
    file: "src/app/(owner)/laporan-spk/page.tsx",
    // useEffect with internal async function "load"
    pattern: /useEffect\(\(\) => \{\s*async function load\(\)/,
    // Wrap the internal load call into a named function
    inject: true,
    fnName: "fetchData",
    wrapInternalLoad: true,
  },
  {
    file: "src/app/(owner)/pelanggan/page.tsx",
    pattern: /fetch\("\/api\/spk"\)/,
    fnName: "fetchData",
    wrapInlineEffect: true,
  },
  {
    file: "src/app/(owner)/piutang/page.tsx",
    pattern: /fetch\("\/api\/returns\/produksi"\)/,
    fnName: "fetchData",
    wrapInlineEffect: true,
  },
  {
    file: "src/app/(owner)/barang-jadi/page.tsx",
    fnName: "fetchData",
    wrapInlineEffect: true,
  },
  {
    file: "src/app/(owner)/karyawan/page.tsx",
    fnName: "fetchData",
    wrapInlineEffect: true,
  },
];

const syncBlock = (fn) => [
  "",
  "  // Real-time sync: auto-refresh when another admin makes a change",
  "  useEffect(() => {",
  "    const handler = () => " + fn + "();",
  "    window.addEventListener(\"konveksi-sync\", handler);",
  "    return () => window.removeEventListener(\"konveksi-sync\", handler);",
  "  // eslint-disable-next-line react-hooks/exhaustive-deps",
  "  }, []);"
].join("\n");

let patched = 0;

for (const target of targets) {
  if (!fs.existsSync(target.file)) { console.log("NOT FOUND: " + target.file); continue; }
  let content = fs.readFileSync(target.file, "utf-8");
  
  if (content.includes("konveksi-sync")) { console.log("Already done: " + target.file); continue; }

  // Strategy: find the FIRST useEffect that does a fetch, extract its body into fetchData, 
  // replace original useEffect, and add sync listener
  
  // Simple approach: find first useEffect(() => { ... }, []) block
  // and wrap it in a named fetchData function
  const match = content.match(/(\n  useEffect\(\(\) => \{)([\s\S]*?)(\n  \}, \[\]\);)/);
  if (!match) { console.log("SKIP no useEffect: " + target.file); continue; }
  
  const originalEffect = match[0];
  const effectBody = match[2];
  
  const namedFn = "\n  const " + target.fnName + " = () => {" + effectBody + "\n  };\n" +
                  "\n  useEffect(() => { " + target.fnName + "(); }, []);\n" +
                  syncBlock(target.fnName);
  
  content = content.replace(originalEffect, namedFn);
  fs.writeFileSync(target.file, content, "utf-8");
  patched++;
  console.log("Patched: " + target.file);
}

console.log("Done. Patched: " + patched);
