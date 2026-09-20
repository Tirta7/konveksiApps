const fs = require('fs');
const path = require('path');

function getFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const frontendFiles = getFiles('src/app').filter(f => !f.includes('\\api\\'));

const endpointMethods = new Map(); // url -> Set of methods

frontendFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // Simple regex to find fetch calls: fetch("URL", { method: "PATCH" })
    // It's not a perfect AST parser but good enough for a quick scan
    const fetchRegex = /fetch\s*\(\s*[`"']([^`"'\?]+).*?,\s*\{[^}]*method:\s*[`"'](POST|PATCH|DELETE|PUT)[`"']/gi;
    let match;
    while ((match = fetchRegex.exec(content)) !== null) {
        let url = match[1];
        if (url.startsWith('/api/')) {
            const method = match[2].toUpperCase();
            if (!endpointMethods.has(url)) endpointMethods.set(url, new Set());
            endpointMethods.get(url).add(method);
        }
    }
});

console.log("Expected API Methods based on frontend fetch calls:");
let missingCount = 0;

endpointMethods.forEach((methods, url) => {
    // Map URL to route.ts file
    // e.g. /api/vendor-types -> src/app/api/vendor-types/route.ts
    // What if it's /api/vendors/123 ? Then we check /api/vendors/[id]/route.ts
    let routePath = path.join('src', 'app', url, 'route.ts');
    if (!fs.existsSync(routePath)) {
        // try [id]
        const parentDir = path.dirname(url);
        routePath = path.join('src', 'app', parentDir, '[id]', 'route.ts');
        if (!fs.existsSync(routePath)) {
             // try [token]
             routePath = path.join('src', 'app', parentDir, '[token]', 'route.ts');
             if (!fs.existsSync(routePath)) {
                 // try [batchId]
                 routePath = path.join('src', 'app', parentDir, '[batchId]', 'route.ts');
             }
        }
    }

    if (fs.existsSync(routePath)) {
        const routeContent = fs.readFileSync(routePath, 'utf8');
        methods.forEach(method => {
            if (!routeContent.includes(`export async function ${method}`)) {
                console.log(`[MISSING] ${method} is missing in ${routePath} (called for ${url})`);
                missingCount++;
            } else {
                // console.log(`[OK] ${method} exists in ${routePath}`);
            }
        });
    } else {
        console.log(`[UNKNOWN ROUTE] Cannot find route.ts for ${url}`);
    }
});

if (missingCount === 0) {
    console.log("All expected endpoints and methods are present!");
}
