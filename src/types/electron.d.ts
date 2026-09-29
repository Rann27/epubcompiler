import type { ElectronApi } from "./book";

declare global {
  interface Window {
    epubCompiler: ElectronApi;
  }
}

export {};
