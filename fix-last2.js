const fs = require("fs");

const files = [
  "src/app/(owner)/laporan-spk/[batchId]/page.tsx",
  "src/app/cmt/[id]/page.tsx"
];

for (const file of files) {
  let content = fs.readFileSync(file, "utf-8");
  
  // Remove any sync block inside a helper function (non-component)
  // Match pattern: useEffect inside a function that appears before export default
  const exportIdx = content.indexOf("export default function");
  if (exportIdx === -1) continue;
  
  const beforeExport = content.slice(0, exportIdx);
  const afterExport = content.slice(exportIdx);
  
  // Remove sync blocks from the beforeExport section
  const syncBlockPattern = /\n  \/\/ Real-time sync[^\n]*\n  useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);\n/g;
  const cleanedBefore = beforeExport.replace(syncBlockPattern, "\n");
  const cleanedBefore2 = cleanedBefore.replace(/\n  \/\/ Real-time sync[^\n]*\n  useEffect\(\(\) => \{[\s\S]*?\}, \[\w+\]\);\n/g, "\n");

  if (cleanedBefore !== beforeExport) {
    content = cleanedBefore + afterExport;
    // If afterExport doesn't have sync yet, add it before return (
    if (!afterExport.includes("konveksi-sync")) {
      const fnMatch = content.match(/const (fetchData|loadData|fetchAll|load) =/);
      const syncFn = fnMatch ? fnMatch[1] : "fetchData";
      const returnIdx = content.indexOf("\n  return (", exportIdx);
      if (returnIdx !== -1) {
        const syncBlock = [
          "",
          "  // Real-time sync: auto-refresh when another admin makes a change",
          "  useEffect(() => {",
          "    const handler = () => " + syncFn + "();",
          "    window.addEventListener(\"konveksi-sync\", handler);",
          "    return () => window.removeEventListener(\"konveksi-sync\", handler);",
          "  // eslint-disable-next-line react-hooks/exhaustive-deps",
          "  }, []);"
        ].join("\n");
        content = content.slice(0, returnIdx) + syncBlock + content.slice(returnIdx);
      }
    }
    fs.writeFileSync(file, content, "utf-8");
    console.log("Fixed: " + file);
  } else {
    console.log("No change needed (before export clean): " + file);
  }
}
