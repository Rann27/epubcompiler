import { app, BrowserWindow, Menu, shell } from "electron";
import type { MenuAction } from "../src/types/book.js";
import { normalizeLang } from "../src/i18n/epub.js";
import { menuStrings } from "../src/i18n/menu.js";

function send(action: MenuAction) {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  window?.webContents.send("menu:action", action);
}

let currentIsDev = false;
let currentLang = "id";

export function setMenuLanguage(language: string) {
  currentLang = normalizeLang(language);
  createApplicationMenu(currentIsDev);
}

export function createApplicationMenu(isDev: boolean) {
  currentIsDev = isDev;
  const s = menuStrings[normalizeLang(currentLang)];
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: s.file,
      submenu: [
        { label: s.newProject, accelerator: "CmdOrCtrl+N", click: () => send("new-project") },
        { label: s.openDocx, accelerator: "CmdOrCtrl+O", click: () => send("open-docx") },
        { type: "separator" },
        { label: s.openConfig, accelerator: "CmdOrCtrl+Shift+O", click: () => send("open-config") },
        { label: s.saveConfig, accelerator: "CmdOrCtrl+S", click: () => send("save-config") },
        { label: s.saveConfigAs, accelerator: "CmdOrCtrl+Shift+S", click: () => send("save-config-as") },
        { type: "separator" },
        { label: s.chooseOutput, accelerator: "CmdOrCtrl+E", click: () => send("choose-output") },
        { label: s.compile, accelerator: "F5", click: () => send("compile") },
        { label: s.openOutputFolder, click: () => send("open-output-folder") },
        { type: "separator" },
        { role: "quit", label: s.exit }
      ]
    },
    {
      label: s.edit,
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
      label: s.view,
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
      label: s.go,
      submenu: [
        { label: s.importDocx, accelerator: "Alt+1", click: () => send("step-import") },
        { label: s.structure, accelerator: "Alt+2", click: () => send("step-structure") },
        { label: s.toc, accelerator: "Alt+3", click: () => send("step-toc") },
        { label: s.images, accelerator: "Alt+4", click: () => send("step-images") },
        { label: s.metadata, accelerator: "Alt+5", click: () => send("step-metadata") },
        { label: s.compileStep, accelerator: "Alt+6", click: () => send("step-compile") }
      ]
    },
    {
      label: s.window,
      submenu: [{ role: "minimize" }, { role: "close" }]
    },
    {
      label: s.help,
      submenu: [
        {
          label: s.about,
          click: async () => {
            const window = BrowserWindow.getFocusedWindow();
            await shell.openExternal("https://www.w3.org/publishing/epub3/");
            window?.focus();
          }
        },
        { label: `${s.version} ${app.getVersion()}`, enabled: false }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
