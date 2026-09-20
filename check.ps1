const fs = require("fs");
const file = "src/app/api/cmt-portal/[id]/route.ts";
let code = fs.readFileSync(file, "utf8");

// We need to replace the activePO fetching logic.
// Find `const activePO = (data.po_produksi || [])` until `});` (line 55).
// Wait, doing this via script is risky if we don't know the exact lines.
// Let's print out lines 15-60.