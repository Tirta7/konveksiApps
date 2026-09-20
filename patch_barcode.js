const fs = require('fs');
let code = fs.readFileSync('src/app/(owner)/barcode-produksi/page.tsx', 'utf8');

// 1. Add pipelineStages state
code = code.replace(
  'const [barcodeList, setBarcodeList] = useState<any[]>([]);',
  'const [barcodeList, setBarcodeList] = useState<any[]>([]);\n  const [pipelineStages, setPipelineStages] = useState<any[]>([]);'
);

// 2. Fetch pipeline stages
code = code.replace(
  'const resB = await fetch("/api/barcode?_t=" + Date.now());',
  'const resB = await fetch("/api/barcode?_t=" + Date.now());\n      const resS = await fetch("/api/pipeline-stages?_t=" + Date.now());\n      const dataS = await resS.json();\n      setPipelineStages(Array.isArray(dataS) ? dataS : []);'
);

// 3. Rewrite getStatusInfo to be dynamic
const getStatusInfoStr = `  // Status display config (Dynamic)
  const getStatusInfo = (status: string) => {
    if (status === "siap_jual") return { label: "SIAP CETAK / SELESAI", color: "#22C55E", border: "#22C55E", opacity: 1, clickable: true };
    if (status === "gudang") return { label: "GUDANG", color: "#3B82F6", border: "#3B82F6", opacity: 1, clickable: false };
    if (status === "potong" || status === "cmt") return { label: "SEDANG DIJAHIT", color: "#8B5CF6", border: "#8B5CF6", opacity: 1, clickable: false };
    
    // Dynamic stages
    const stage = pipelineStages.find(s => s.slug === status);
    if (stage) return { label: \`MENUNGGU \${stage.nama.toUpperCase()}\`, color: stage.warna || "#06B6D4", border: stage.warna || "#06B6D4", opacity: 1, clickable: false };
    
    // Check if it's "selesai_xxx" or something? Actually barcode status is just the "ke" (destination slug)
    return { label: \`\${status.toUpperCase()}\`, color: "#94A3B8", border: "#CBD5E1", opacity: 0.8, clickable: false };
  };`;

// Replace the old getStatusInfo
code = code.replace(/const getStatusInfo = \(status: string\) => \{[\s\S]*?\};\n/, getStatusInfoStr + '\n');

// 4. Fix legend
const oldLegendRegex = /\{\[\s*\{\s*color:[^\]]+\]\.map\(\(\{ color, label, status \}\) => \{[\s\S]*?\}\)/;

const newLegendStr = `{(()=>{
                  // Build dynamic legend
                  const legendMap = new Map();
                  filteredBarcodes.forEach(b => {
                    if (!legendMap.has(b.status)) {
                       const si = getStatusInfo(b.status);
                       legendMap.set(b.status, { color: si.color, label: si.label, count: 0 });
                    }
                    legendMap.get(b.status).count++;
                  });
                  return Array.from(legendMap.entries()).map(([st, data]) => (
                     <div key={st} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#475569" }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: data.color, flexShrink: 0 }} />
                        {data.label} ({data.count})
                     </div>
                  ));
                })()}`;

code = code.replace(oldLegendRegex, newLegendStr);

fs.writeFileSync('src/app/(owner)/barcode-produksi/page.tsx', code, 'utf8');