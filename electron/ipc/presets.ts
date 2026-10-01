import fs from "node:fs";
import path from "node:path";
import { app, dialog, ipcMain } from "electron";
import type { MetadataPreset } from "../../src/types/book.js";

const presetsPath = () => path.join(app.getPath("userData"), "metadata-presets.json");

ipcMain.handle("presets:load", async (): Promise<MetadataPreset[]> => {
  try {
    const data = JSON.parse(fs.readFileSync(presetsPath(), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
});

ipcMain.handle("presets:store", async (_event, presets: MetadataPreset[]) => {
  fs.mkdirSync(path.dirname(presetsPath()), { recursive: true });
  fs.writeFileSync(presetsPath(), JSON.stringify(presets, null, 2), "utf8");
});

ipcMain.handle("presets:export", async (_event, name: string, content: string) => {
  const safeName = name.replace(/[\\/:*?"<>|]/g, "_").trim() || "preset";
  const result = await dialog.showSaveDialog({
    title: "Export Metadata Preset",
    defaultPath: `${safeName}.epubcompiler-preset.json`,
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, content, "utf8");
  return result.filePath;
});
