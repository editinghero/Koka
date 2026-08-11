import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const serverJsPath = path.join(rootDir, "dist", "server", "server.js");
const clientServerJsPath = path.join(rootDir, "dist", "client", "server.js");
const workerJsPath = path.join(rootDir, "dist", "client", "_worker.js");
const serverAssetsDir = path.join(rootDir, "dist", "server", "assets");
const clientAssetsDir = path.join(rootDir, "dist", "client", "assets");

console.log("--> Preparing Cloudflare Pages _worker.js entry point...");

if (fs.existsSync(serverJsPath)) {
  fs.copyFileSync(serverJsPath, clientServerJsPath);
  fs.writeFileSync(workerJsPath, `export { default } from "./server.js";\n`);
  console.log("✓ Created dist/client/server.js and dist/client/_worker.js");
} else {
  console.error("❌ dist/server/server.js not found!");
  process.exit(1);
}

if (fs.existsSync(serverAssetsDir)) {
  if (!fs.existsSync(clientAssetsDir)) {
    fs.mkdirSync(clientAssetsDir, { recursive: true });
  }
  const files = fs.readdirSync(serverAssetsDir);
  for (const file of files) {
    const src = path.join(serverAssetsDir, file);
    const dest = path.join(clientAssetsDir, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
  }
  console.log("✓ Synchronized server assets to dist/client/assets/");
}

console.log("✨ Cloudflare Pages _worker.js build setup complete!");
