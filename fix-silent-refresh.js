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

  // Find the sync handler and change it to pass true (silent mode)
  // Pattern: const handler = () => FNNAME();
  // Change to: const handler = () => FNNAME(true);
  // But only if the function accepts a parameter

  // First, check if the fetch function already has a silent parameter
  if (content.includes("silent = false") || content.includes("silent=false")) {
    console.log("Already has silent param:", path.relative("src/app", page));
    continue;
  }

  // Find the fetch function name used in the sync handler
  const handlerMatch = content.match(/const handler = \(\) => (\w+)\(\)/);
  if (!handlerMatch) continue;
  const fnName = handlerMatch[1];

  // Check if this function has setLoading(true) inside it
  // Find the function body
  const fnPattern = new RegExp("const " + fnName + "\\s*=\\s*(?:async\\s*)?(?:\\(([^)]*)\\))?\\s*=>\\s*\\{([\\s\\S]*?)^  \\};", "m");
  const fnMatch = content.match(fnPattern);
  if (!fnMatch) continue;

  const fnBody = fnMatch[2] || "";
  if (!fnBody.includes("setLoading(true)")) {
    // No loading state to worry about
    continue;
  }

  // Add silent parameter to the function
  // Change: const fnName = () => { or const fnName = async () => {
  content = content.replace(
    new RegExp("(const " + fnName + "\\s*=\\s*(?:async\\s*)?)\\(\\)\\s*=>\\s*\\{"),
    "$1(silent = false) => {"
  );

  // Wrap setLoading(true) with if (!silent)
  content = content.replace(
    new RegExp("(\\s+)(setLoading\\(true\\))"),
    "$1if (!silent) $2"
  );

  // Change handler to pass true
  content = content.replace(
    "const handler = () => " + fnName + "()",
    "const handler = () => " + fnName + "(true)"
  );

  fs.writeFileSync(page, content, "utf-8");
  fixed++;
  console.log("Fixed silent refresh [" + fnName + "]: " + path.relative("src/app", page));
}

console.log("\nDone. Fixed:", fixed);
