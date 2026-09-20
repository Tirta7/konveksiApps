const fs = require('fs');
let code = fs.readFileSync('src/app/(owner)/buat-spk/page.tsx', 'utf8');

// 1. Add states
const stateTarget = `const [form, setForm] = useState({`;
const stateInjection = `
  const [downstreamModal, setDownstreamModal] = useState<any | null>(null);
  const [downstreamForm, setDownstreamForm] = useState<{size: string, max: number, jumlah: number|""}[]>([]);
  const [isSubmittingDownstream, setIsSubmittingDownstream] = useState(false);

`;
if (!code.includes('downstreamModal')) {
    code = code.replace(stateTarget, stateInjection + stateTarget);
}

// 2. Add submit handler
const submitHandlerTarget = `  const handleTargetDateChange = (dateStr: string) => {`;
const submitHandlerInjection = `
  const handleDownstreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downstreamModal) return;
    
    const items = downstreamForm.filter(p => Number(p.jumlah) > 0);
    const totalReq = items.reduce((s, i) => s + Number(i.jumlah), 0);
    
    if (items.length === 0) {
      import("sonner").then(m => m.toast.error("Isi setidaknya 1 size."));
      return;
    }
    
    for (const item of items) {
      if (Number(item.jumlah) > item.max) {
        import("sonner").then(m => m.toast.error(\`Size \${item.size} melebihi sisa yang ada di Standby Pool (\${item.max})\`));
        return;
      }
    }
    
    if (totalReq > Number(downstreamModal.total_request)) {
      import("sonner").then(m => m.toast.error(\`Total yang di-ACC (\${totalReq}) melebihi request (\${downstreamModal.total_request})\`));
      return;
    }

    setIsSubmittingDownstream(true);
    try {
      const res = await fetch("/api/tarik-barang/acc-downstream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: downstreamModal.id,
          transfer_id: downstreamModal.pemotongan.transfer_id,
          vendor_id: downstreamModal.vendor_id,
          sizeBreakdown: items,
        })
      });
      if (!res.ok) {
         const data = await res.json();
         throw new Error(data.error || "Gagal");
      }
      import("sonner").then(m => m.toast.success("Berhasil menugaskan ke vendor!"));
      setDownstreamModal(null);
      fetchAll(); // reload
    } catch(err: any) {
      import("sonner").then(m => m.toast.error(err.message));
    } finally {
      setIsSubmittingDownstream(false);
    }
  };
`;
if (!code.includes('handleDownstreamSubmit')) {
    code = code.replace(submitHandlerTarget, submitHandlerInjection + submitHandlerTarget);
}

// 3. Update the "Proses" button onClick
const prosesTarget = `const targetQty = Number(r.total_request);`;
const prosesInjection = `
                                    if (r.pemotongan?.is_transfer) {
                                      setDownstreamModal(r);
                                      const breakdown = r.pemotongan.sizeBreakdown || [];
                                      setDownstreamForm(breakdown.map((s:any) => ({
                                        size: s.size,
                                        max: Number(s.sisa || s.jumlah || 0),
                                        jumlah: ""
                                      })));
                                      return;
                                    }
`;
if (!code.includes('if (r.pemotongan?.is_transfer) {')) {
    code = code.replace(prosesTarget, prosesInjection + prosesTarget);
}

fs.writeFileSync('src/app/(owner)/buat-spk/page.tsx', code, 'utf8');
console.log("Successfully wrote patches.");
