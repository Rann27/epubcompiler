import fs from "node:fs";
import path from "node:path";
import { dialog, ipcMain, shell } from "electron";
import type { ProjectConfig } from "../../src/types/book.js";

ipcMain.handle("dialog:choose-docx", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose DOCX",
    properties: ["openFile"],
    filters: [{ name: "DOCX", extensions: ["docx"] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:choose-output", async (_event, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    title: "Save EPUB",
    defaultPath: defaultName,
    filters: [{ name: "EPUB", extensions: ["epub"] }]
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle("filesystem:load-config", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open Project Config",
    properties: ["openFile"],
    filters: [{ name: "EPUB Compiler Config", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const config = JSON.parse(fs.readFileSync(filePath, "utf8")) as ProjectConfig;
  return { path: filePath, config };
});

ipcMain.handle("filesystem:save-config", async (_event, config: ProjectConfig, existingPath?: string) => {
  let filePath = existingPath;
  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: "Save Project Config",
      defaultPath: `${config.metadata.title || "book"}.epubcompiler.json`,
      filters: [{ name: "EPUB Compiler Config", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
  return filePath;
});

ipcMain.handle("filesystem:export-config", async (_event, config: ProjectConfig) => {
  const result = await dialog.showSaveDialog({
    title: "Export Project Config",
    defaultPath: `${config.metadata.title || "book"}.epubcompiler.json`,
    filters: [{ name: "EPUB Compiler Config", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, JSON.stringify(config, null, 2), "utf8");
  return result.filePath;
});

ipcMain.handle("filesystem:open-folder", async (_event, targetPath: string) => {
  const folder = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory() ? targetPath : path.dirname(targetPath);
  await shell.openPath(folder);
});
