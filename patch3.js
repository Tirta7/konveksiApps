const fs = require('fs');

let apiCode = fs.readFileSync('src/app/api/vendors/route.ts', 'utf8');

// If PATCH doesn't exist, append it.
if (!apiCode.includes('export async function PATCH')) {
    apiCode += `

export async function PATCH(req: Request) {
  const data = readData();
  const body = await req.json();
  const { id, ...updates } = body;
  const idx = data.vendors.findIndex((v: any) => String(v.id) === String(id));
  if (idx === -1) return NextResponse.json({ error: "Vendor tidak ditemukan" }, { status: 404 });
  
  data.vendors[idx] = { ...data.vendors[idx], ...updates };
  writeData(data);
  return NextResponse.json(data.vendors[idx]);
}
`;
    fs.writeFileSync('src/app/api/vendors/route.ts', apiCode, 'utf8');
    console.log("PATCH method added to vendors API.");
} else {
    console.log("PATCH method already exists.");
}