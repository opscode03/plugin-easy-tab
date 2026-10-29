import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = resolve(root, "dist");
const archive = resolve(root, "easy-tab-chrome.zip");

if (!existsSync(resolve(dist, "manifest.json"))) {
  throw new Error("未找到 dist/manifest.json，请先执行 npm run build。");
}

execFileSync(
  "powershell.exe",
  ["-NoProfile", "-Command", `Compress-Archive -Path "${dist}\\*" -DestinationPath "${archive}" -Force`],
  { stdio: "inherit" }
);

console.log(`Chrome 扩展安装包：${archive}`);
