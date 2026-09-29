import { ipcMain } from "electron";
import { parseDocx } from "../../compiler/parseDocx.js";
import { buildSections, createDefaultMetadata } from "../../compiler/buildSections.js";

ipcMain.handle("docx:analyze", async (_event, sourcePath: string) => {
  const parsed = parseDocx(sourcePath);
  const sections = buildSections(parsed);
  const metadata = createDefaultMetadata(parsed);
  return { parsed, sections, metadata };
});
