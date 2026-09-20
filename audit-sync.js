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
walk(path.join("src", "app"));

let issues = [];
let ok = 0;

for (const page of pages) {
  const content = fs.readFileSync(page, "utf-8");
  if (!content.includes("konveksi-sync")) continue;

  // Find which function the sync useEffect calls
  const handlerMatch = content.match(/konveksi-sync"[^)]*,\s*(?:handler|(\w+))\)/);
  const innerMatch = content.match(/const handler = \(\) => (\w+)\(\)/);
  
  const calledFn = innerMatch ? innerMatch[1] : (handlerMatch ? handlerMatch[1] : null);
  
  if (!calledFn) { console.log("SKIP (cant detect fn):", path.relative("src/app", page)); continue; }

  // Check if that function is actually defined in the file
  const isDefined = content.includes("const " + calledFn + " ") || 
                    content.includes("const " + calledFn + "=") ||
                    content.includes("function " + calledFn + "(") ||
                    content.includes("async function " + calledFn + "(");

  if (!isDefined) {
    issues.push({ page, calledFn });
    console.log("ERROR [" + calledFn + " not defined]: " + path.relative("src/app", page));
  } else {
    ok++;
  }
}

console.log("\nOK: " + ok + ", Issues: " + issues.length);
if (issues.length > 0) {
  // Try to auto-fix
  console.log("\nAuto-fixing...");
  const candidates = ["fetchData", "loadData", "fetchAll", "load", "loadList", "refresh"];
  
  for (const { page, calledFn } of issues) {
    let content = fs.readFileSync(page, "utf-8");
    
    // Find the actual fetch function
    let realFn = null;
    for (const c of candidates) {
      if (content.includes("const " + c + " ") || content.includes("const " + c + "=")) {
        realFn = c;
        break;
      }
    }
    
    if (!realFn) {
      // Try useEffect inline
      const m = content.match(/useEffect\(\(\) => \{\s*(\w+)\(/);
      if (m) realFn = m[1];
    }
    
    if (!realFn) { console.log("SKIP (cant find real fn):", page); continue; }
    
    // Replace the wrong function name with the correct one
    content = content.replace(
      new RegExp("const handler = \\(\\) => " + calledFn + "\\(\\)"),
      "const handler = () => " + realFn + "()"
    );
    content = content.replace(
      new RegExp('window\\.addEventListener\\("konveksi-sync", ' + calledFn + '\\)'),
      'window.addEventListener("konveksi-sync", handler)'
    );
    content = content.replace(
      new RegExp('window\\.removeEventListener\\("konveksi-sync", ' + calledFn + '\\)'),
      'window.removeEventListener("konveksi-sync", handler)'
    );
    content = content.replace(
      new RegExp('\\}, \\[' + calledFn + '\\]\\);'),
      '}, []);'
    );
    
    fs.writeFileSync(page, content, "utf-8");
    console.log("Fixed [" + calledFn + " -> " + realFn + "]: " + path.relative("src/app", page));
  }
}
