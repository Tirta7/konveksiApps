const fs = require("fs");
const path = require("path");
const DATA_PATH = path.join(process.cwd(), "konveksi-data.json");
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
let changed = false;

if (data.vendors) {
  data.vendors.forEach((v) => {
    if (v.aktif === undefined) {
      v.aktif = true;
      changed = true;
    }
    if (!v.kodeVendor) {
      const prefix = (v.tipe || "VND").substring(0, 3).toUpperCase();
      v.kodeVendor = `${prefix}-${String(v.id).padStart(3, "0")}`;
      changed = true;
    }
  });
}

if (changed) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log("Backfilled vendor data.");
} else {
  console.log("No backfill needed.");
}
