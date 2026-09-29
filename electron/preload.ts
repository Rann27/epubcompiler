import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { CompileRequest, MenuAction, ProjectConfig } from "../src/types/book.js";

contextBridge.exposeInMainWorld("epubCompiler", {
  getFilePath: (file: File) => webUtils.getPathForFile(file),
  chooseDocx: () => ipcRenderer.invoke("dialog:choose-docx"),
  chooseOutput: (defaultName: string) => ipcRenderer.invoke("dialog:choose-output", defaultName),
  analyzeDocx: (path: string) => ipcRenderer.invoke("docx:analyze", path),
  compileEpub: (request: CompileRequest) => ipcRenderer.invoke("epub:compile", request),
  loadConfig: () => ipcRenderer.invoke("filesystem:load-config"),
  saveConfig: (config: ProjectConfig, path?: string) => ipcRenderer.invoke("filesystem:save-config", config, path),
  openFolder: (path: string) => ipcRenderer.invoke("filesystem:open-folder", path),
  onMenuAction: (callback: (action: MenuAction) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: MenuAction) => callback(action);
    ipcRenderer.on("menu:action", listener);
    return () => ipcRenderer.removeListener("menu:action", listener);
  }
});
