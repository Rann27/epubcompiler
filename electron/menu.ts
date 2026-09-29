import { app, BrowserWindow, Menu, shell } from "electron";
import type { MenuAction } from "../src/types/book.js";

function send(action: MenuAction) {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  window?.webContents.send("menu:action", action);
}

export function createApplicationMenu(isDev: boolean) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        { label: "New Project", accelerator: "CmdOrCtrl+N", click: () => send("new-project") },
        { label: "Open DOCX...", accelerator: "CmdOrCtrl+O", click: () => send("open-docx") },
        { type: "separator" },
        { label: "Open Project Config...", accelerator: "CmdOrCtrl+Shift+O", click: () => send("open-config") },
        { label: "Save Project Config", accelerator: "CmdOrCtrl+S", click: () => send("save-config") },
        { label: "Save Project Config As...", accelerator: "CmdOrCtrl+Shift+S", click: () => send("save-config-as") },
        { type: "separator" },
        { label: "Choose Output EPUB...", accelerator: "CmdOrCtrl+E", click: () => send("choose-output") },
        { label: "Compile EPUB", accelerator: "F5", click: () => send("compile") },
        { label: "Open Output Folder", click: () => send("open-output-folder") },
        { type: "separator" },
        { role: "quit", label: "Exit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools", visible: isDev },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Go",
      submenu: [
        { label: "Import DOCX", accelerator: "Alt+1", click: () => send("step-import") },
        { label: "Book Structure", accelerator: "Alt+2", click: () => send("step-structure") },
        { label: "Table of Contents", accelerator: "Alt+3", click: () => send("step-toc") },
        { label: "Images", accelerator: "Alt+4", click: () => send("step-images") },
        { label: "Metadata", accelerator: "Alt+5", click: () => send("step-metadata") },
        { label: "Compile", accelerator: "Alt+6", click: () => send("step-compile") }
      ]
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About EPUB Compiler",
          click: async () => {
            const window = BrowserWindow.getFocusedWindow();
            await shell.openExternal("https://www.w3.org/publishing/epub3/");
            window?.focus();
          }
        },
        { label: `Version ${app.getVersion()}`, enabled: false }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
