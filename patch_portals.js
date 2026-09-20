const fs = require('fs');

// 1. Update cmt-request API to save transfer_id
let reqApi = fs.readFileSync('src/app/api/cmt-request/route.ts', 'utf8');
if (!reqApi.includes('transfer_id: transfer_id')) {
    reqApi = reqApi.replace('pemotongan_id } = body;', 'pemotongan_id, transfer_id } = body;');
    reqApi = reqApi.replace('pemotongan_id: pemotongan_id ? Number(pemotongan_id) : null, // NEW: cross-ref', 'pemotongan_id: pemotongan_id ? Number(pemotongan_id) : null, transfer_id: transfer_id ? Number(transfer_id) : null,');
    fs.writeFileSync('src/app/api/cmt-request/route.ts', reqApi, 'utf8');
}

// 2. Update all portals
const portals = [
    'src/app/cmt/[id]/page.tsx',
    'src/app/washing/[id]/page.tsx',
    'src/app/bersih-benang/[id]/page.tsx',
    'src/app/finishing/[id]/page.tsx'
];

portals.forEach(path => {
    if (fs.existsSync(path)) {
        let code = fs.readFileSync(path, 'utf8');
        
        // Find handleSubmitRequest
        if (code.includes('pemotongan_id: requestForm.pemotongan_id ? Number(requestForm.pemotongan_id) : null,')) {
            const replaceFrom = `pemotongan_id: requestForm.pemotongan_id ? Number(requestForm.pemotongan_id) : null,`;
            
            // we need to determine isTransfer
            const findSelected = `const selectedP = data.pemotonganReady.find((p: any) => String(p.id) === requestForm.pemotongan_id);
          const isTransfer = selectedP?.is_transfer;
          `;
            
            const replaceTo = `pemotongan_id: isTransfer ? null : (requestForm.pemotongan_id ? Number(requestForm.pemotongan_id) : null),
          transfer_id: isTransfer ? Number(requestForm.pemotongan_id) : null,`;

            // inject findSelected before fetch
            if (!code.includes('const selectedP =')) {
                code = code.replace('const res = await fetch("/api/cmt-request", {', findSelected + '\n      const res = await fetch("/api/cmt-request", {');
            }
            code = code.replace(replaceFrom, replaceTo);
            fs.writeFileSync(path, code, 'utf8');
        }
    }
});