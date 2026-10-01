import type { LangCode } from "./epub";

export type MenuStrings = {
  file: string; newProject: string; openDocx: string; openConfig: string; saveConfig: string; saveConfigAs: string;
  chooseOutput: string; compile: string; openOutputFolder: string; exit: string;
  edit: string; view: string; go: string; window: string; help: string;
  importDocx: string; structure: string; toc: string; images: string; metadata: string; compileStep: string;
  about: string; version: string;
};

export const menuStrings: Record<LangCode, MenuStrings> = {
  en: {
    file: "File", newProject: "New Project", openDocx: "Open DOCX...", openConfig: "Open Project Config...",
    saveConfig: "Save Project Config", saveConfigAs: "Save Project Config As...", chooseOutput: "Choose Output EPUB...",
    compile: "Compile EPUB", openOutputFolder: "Open Output Folder", exit: "Exit",
    edit: "Edit", view: "View", go: "Go", window: "Window", help: "Help",
    importDocx: "Import DOCX", structure: "Book Structure", toc: "Table of Contents", images: "Images",
    metadata: "Metadata", compileStep: "Compile", about: "About EPUB Compiler", version: "Version"
  },
  id: {
    file: "Berkas", newProject: "Proyek Baru", openDocx: "Buka DOCX...", openConfig: "Buka Konfigurasi Proyek...",
    saveConfig: "Simpan Konfigurasi Proyek", saveConfigAs: "Simpan Konfigurasi Proyek Sebagai...", chooseOutput: "Pilih EPUB Keluaran...",
    compile: "Kompilasi EPUB", openOutputFolder: "Buka Folder Keluaran", exit: "Keluar",
    edit: "Edit", view: "Tampilan", go: "Menuju", window: "Jendela", help: "Bantuan",
    importDocx: "Impor DOCX", structure: "Struktur Buku", toc: "Daftar Isi", images: "Gambar",
    metadata: "Metadata", compileStep: "Kompilasi", about: "Tentang EPUB Compiler", version: "Versi"
  }
};
