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
  if (!content.includes("konveksi-sync")) continue;
  if (content.includes("silent")) continue; // already fixed

  // For pages that have setLoading in their data fetch function,
  // we use a different approach: useRef to track if it is initial load
  // Add a bgRefreshRef approach

  // Check if there's setLoading(true) anywhere in the component
  if (!content.includes("setLoading(true)")) continue;

  // Find the component name
  const compMatch = content.match(/export default function (\w+)/);
  if (!compMatch) continue;

  // Add useRef import if not there
  if (!content.includes("useRef")) {
    content = content.replace(
      /import.*useEffect.*useState.*from "react"/,
      m => m.replace("useState", "useState, useRef")
    );
    content = content.replace(
      /import.*\{([^}]*useEffect[^}]*)\}.*from "react"/,
      (m, inner) => {
        if (!inner.includes("useRef")) {
          return m.replace("{" + inner + "}", "{ " + inner.trim() + ", useRef }");
        }
        return m;
      }
    );
  }

  // Add bgRefresh ref after the first useState
  const firstUseState = content.indexOf("useState");
  if (firstUseState === -1) continue;

  // Find the line after first useState block
  const firstStateLineEnd = content.indexOf("\n", firstUseState);
  if (!content.slice(0, firstUseState + 200).includes("_bgRefresh")) {
    content = content.slice(0, firstStateLineEnd + 1) +
      "  const _bgRefresh = useRef(false);\n" +
      content.slice(firstStateLineEnd + 1);
  }

  // Wrap setLoading(true) to skip on background refresh
  content = content.replace(
    /(\s+)(setLoading\(true\))/g,
    "$1if (!_bgRefresh.current) $2"
  );

  // Change sync handler to set _bgRefresh before calling fetch
  content = content.replace(
    /const handler = \(\) => (\w+)\(\)/,
    "const handler = () => { _bgRefresh.current = true; $1(); setTimeout(() => { _bgRefresh.current = false; }, 2000); }"
  );

  fs.writeFileSync(page, content, "utf-8");
  fixed++;
  console.log("Fixed [no-blink]:", path.relative("src/app", page));
}

console.log("\nTotal fixed:", fixed);
