const fs = require("fs");
const path = require("path");
const DATA_PATH = path.join(process.cwd(), "konveksi-data.json");
const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
let changed = false;

if (data.cmt_requests) {
  data.cmt_requests.forEach((r) => {
    if (r.status === "Selesai" && r.total_dipenuhi < r.total_request) {
      r.status = "Sebagian";
      r.catatan = `Di-ACC sebagian (Otomatis Diperbaiki). Sisa ${r.total_request - r.total_dipenuhi} pcs.`;
      changed = true;
      console.log("Fixed request ID:", r.id);
    }
  });
}

if (changed) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log("Data saved.");
} else {
  console.log("No data needed fixing.");
}
