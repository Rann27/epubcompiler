const fs = require("node:fs");
const path = require("node:path");

const releaseDir = path.join(__dirname, "..", "release");
const launcherPath = path.join(releaseDir, "Run EPUB Compiler.cmd");
const content = `@echo off
set ELECTRON_RUN_AS_NODE=
start "" "%~dp0win-unpacked\\EPUB Compiler.exe"
`;

fs.mkdirSync(releaseDir, { recursive: true });
fs.writeFileSync(launcherPath, content, "utf8");
console.log(`Wrote ${launcherPath}`);
