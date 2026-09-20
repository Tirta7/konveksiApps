const fs = require("fs");
const path = require("path");

const pages = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walk(fp);
    else if (f === "page.tsx") pages.push(fp);
  }
}
walk(path.join("src","app"));

let fixed = 0;

for (const page of pages) {
  let content = fs.readFileSync(page, "utf-8");
  if (!content.includes("_bgRefresh")) continue;

  // Check if _bgRefresh is outside of a function (wrong placement)
  // It should be INSIDE the default export function
  const bgIdx = content.indexOf("const _bgRefresh");
  const exportIdx = content.indexOf("export default function");

  if (bgIdx < exportIdx) {
    // _bgRefresh is outside the component — WRONG
    // Remove it from outside
    content = content.replace(/\n  const _bgRefresh = useRef\(false\);\n/, "\n");
    
    // Add it INSIDE the component, after the first useState
    const firstStateIdx = content.indexOf("useState", exportIdx);
    const firstStateLineEnd = content.indexOf("\n", firstStateIdx);
    
    if (firstStateLineEnd !== -1 && !content.slice(exportIdx).includes("const _bgRefresh")) {
      content = content.slice(0, firstStateLineEnd + 1) +
        "  const _bgRefresh = useRef(false);\n" +
        content.slice(firstStateLineEnd + 1);
    }

    fs.writeFileSync(page, content, "utf-8");
    fixed++;
    console.log("Fixed _bgRefresh placement:", path.relative("src/app", page));
  } else {
    console.log("OK:", path.relative("src/app", page));
  }
}

console.log("\nFixed:", fixed);
