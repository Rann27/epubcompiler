import { app, BrowserWindow, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import "./ipc/docx.js";
import "./ipc/epub.js";
import "./ipc/filesystem.js";
import { createApplicationMenu } from "./menu.js";

const isDev = !app.isPackaged;
const logPath = path.join(process.env.APPDATA ?? process.cwd(), "EPUB Compiler", "startup.log");
const appIconPath = path.join(__dirname, "../../build/icon.ico");

app.setAppUserModelId("local.epubcompiler.app");

function log(message: string, error?: unknown) {
  const detail = error instanceof Error ? `${error.stack ?? error.message}` : error ? String(error) : "";
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}${detail ? `\n${detail}` : ""}\n`, "utf8");
}

process.on("uncaughtException", (error) => {
  log("Uncaught exception", error);
  dialog.showErrorBox("EPUB Compiler startup error", `${error.message}\n\nLog: ${logPath}`);
});

process.on("unhandledRejection", (error) => {
  log("Unhandled rejection", error);
  dialog.showErrorBox("EPUB Compiler startup error", `${error instanceof Error ? error.message : String(error)}\n\nLog: ${logPath}`);
});

async function createWindow() {
  log(`createWindow start isDev=${isDev} dirname=${__dirname}`);
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1080,
    minHeight: 720,
    title: "EPUB Compiler",
    icon: appIconPath,
    backgroundColor: "#f7f4ee",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    await win.loadURL("http://127.0.0.1:5173");
    win.webContents.openDevTools({ mode: "detach" });
    log("loaded dev URL");
    return;
  }

  const indexPath = path.join(__dirname, "../../dist/index.html");
  log(`loading packaged index ${indexPath}`);
  await win.loadFile(indexPath);
  log("loaded packaged index");
}

app.whenReady().then(() => {
  createApplicationMenu(isDev);
  return createWindow();
}).catch((error) => {
  log("Failed to create main window", error);
  dialog.showErrorBox("EPUB Compiler startup error", `${error instanceof Error ? error.message : String(error)}\n\nLog: ${logPath}`);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
