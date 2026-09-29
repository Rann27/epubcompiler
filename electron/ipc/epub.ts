import { ipcMain } from "electron";
import type { CompileRequest } from "../../src/types/book.js";
import { packageEpub } from "../../compiler/packageEpub.js";

ipcMain.handle("epub:compile", async (_event, request: CompileRequest) => {
  return packageEpub(request);
});
