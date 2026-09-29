import { create } from "zustand";
import type { BookMetadata, BookSection, CompileResult, MenuAction, ParsedDocx, ProjectConfig, SectionType } from "../types/book";

type Step = "import" | "structure" | "toc" | "images" | "metadata" | "compile";

const steps: Step[] = ["import", "structure", "toc", "images", "metadata", "compile"];

type BookStore = {
  step: Step;
  sourceDocx: string;
  outputPath: string;
  outputManual: boolean;
  parsed: ParsedDocx | null;
  sections: BookSection[];
  metadata: BookMetadata | null;
  selectedSectionId: string | null;
  busy: boolean;
  error: string;
  compileResult: CompileResult | null;
  currentConfigPath: string;
  setStep: (step: Step) => void;
  nextStep: () => void;
  previousStep: () => void;
  resetProject: () => void;
  analyze: (path: string) => Promise<void>;
  chooseDocx: () => Promise<void>;
  chooseOutput: () => Promise<void>;
  compile: () => Promise<void>;
  saveConfig: (saveAs?: boolean) => Promise<void>;
  loadConfig: () => Promise<void>;
  openOutputFolder: () => Promise<void>;
  handleMenuAction: (action: MenuAction) => Promise<void>;
  setSections: (sections: BookSection[]) => void;
  updateSection: (id: string, patch: Partial<BookSection>) => void;
  updateImage: (id: string, patch: Partial<NonNullable<BookSection["image"]>>) => void;
  setSelectedSection: (id: string | null) => void;
  updateMetadata: (patch: Partial<BookMetadata>) => void;
  setCover: (id: string) => void;
};

function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "book";
}

function defaultOutputName(metadata: BookMetadata | null) {
  return `${sanitizeFileName(metadata?.title?.trim() || "book")}.epub`;
}

// Derive a default output path in the SAME directory as the input DOCX,
// named after the book title, so the output tracks the input location.
function deriveOutputPath(docxPath: string, metadata: BookMetadata | null) {
  if (!docxPath) return "";
  const sep = docxPath.includes("\\") ? "\\" : "/";
  const idx = Math.max(docxPath.lastIndexOf("\\"), docxPath.lastIndexOf("/"));
  const dir = idx >= 0 ? docxPath.slice(0, idx) : "";
  const name = defaultOutputName(metadata);
  return dir ? `${dir}${sep}${name}` : name;
}

function reorderSections(sections: BookSection[]) {
  return sections.map((section, order) => ({ ...section, order }));
}

function initialState() {
  return {
    step: "import" as Step,
    sourceDocx: "",
    outputPath: "",
    outputManual: false,
    parsed: null,
    sections: [],
    metadata: null,
    selectedSectionId: null,
    busy: false,
    error: "",
    compileResult: null,
    currentConfigPath: ""
  };
}

function buildProjectConfig(state: BookStore): ProjectConfig | null {
  if (!state.metadata) return null;
  return {
    sourceDocx: state.sourceDocx,
    outputPath: state.outputPath,
    metadata: state.metadata,
    toc: { title: "Table of Contents", placement: "after-front-illustrations", includeInSpine: true, linear: false },
    images: { oneImagePerPage: true, fitMode: "contain", format: "webp", quality: 90 },
    sections: state.sections
  };
}

export const useBookStore = create<BookStore>((set, get) => ({
  ...initialState(),
  setStep: (step) => set({ step }),
  nextStep: () => set((state) => ({ step: steps[Math.min(steps.indexOf(state.step) + 1, steps.length - 1)] })),
  previousStep: () => set((state) => ({ step: steps[Math.max(steps.indexOf(state.step) - 1, 0)] })),
  resetProject: () => set(initialState()),
  analyze: async (path) => {
    set({ busy: true, error: "", compileResult: null });
    try {
      const { parsed, sections, metadata } = await window.epubCompiler.analyzeDocx(path);
      set({
        sourceDocx: path,
        parsed,
        sections,
        metadata,
        selectedSectionId: sections[0]?.id ?? null,
        outputPath: deriveOutputPath(path, metadata),
        outputManual: false,
        currentConfigPath: "",
        step: "structure"
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "The selected file is not a valid DOCX file." });
    } finally {
      set({ busy: false });
    }
  },
  chooseDocx: async () => {
    const path = await window.epubCompiler.chooseDocx();
    if (path) await get().analyze(path);
  },
  chooseOutput: async () => {
    const { sourceDocx, outputPath, metadata } = get();
    const suggested = outputPath || deriveOutputPath(sourceDocx, metadata) || defaultOutputName(metadata);
    const file = await window.epubCompiler.chooseOutput(suggested);
    if (file) set({ outputPath: file, outputManual: true });
  },
  compile: async () => {
    const { sourceDocx, outputPath, metadata, sections } = get();
    if (!metadata) return;
    set({ busy: true, error: "", compileResult: null });
    try {
      const chosenOutput =
        outputPath ||
        deriveOutputPath(sourceDocx, metadata) ||
        (await window.epubCompiler.chooseOutput(defaultOutputName(metadata)));
      if (!chosenOutput) return;
      const result = await window.epubCompiler.compileEpub({
        sourceDocx,
        outputPath: chosenOutput,
        metadata: { ...metadata, modified: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") },
        sections,
        imageQuality: 90
      });
      set({ outputPath: chosenOutput, compileResult: result });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to write EPUB file. Please check the output folder permission." });
    } finally {
      set({ busy: false });
    }
  },
  saveConfig: async (saveAs = false) => {
    const config = buildProjectConfig(get());
    if (!config) {
      set({ error: "Import a DOCX or load a project before saving config." });
      return;
    }
    set({ busy: true, error: "" });
    try {
      const savedPath = await window.epubCompiler.saveConfig(config, saveAs ? undefined : get().currentConfigPath || undefined);
      if (savedPath) set({ currentConfigPath: savedPath });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to save project config." });
    } finally {
      set({ busy: false });
    }
  },
  loadConfig: async () => {
    set({ busy: true, error: "", compileResult: null });
    try {
      const loaded = await window.epubCompiler.loadConfig();
      if (!loaded) return;
      let parsed: ParsedDocx | null = null;
      if (loaded.config.sourceDocx) {
        try {
          parsed = (await window.epubCompiler.analyzeDocx(loaded.config.sourceDocx)).parsed;
        } catch {
          parsed = null;
        }
      }
      set({
        sourceDocx: loaded.config.sourceDocx,
        outputPath: loaded.config.outputPath || deriveOutputPath(loaded.config.sourceDocx, loaded.config.metadata),
        outputManual: Boolean(loaded.config.outputPath),
        metadata: loaded.config.metadata,
        sections: reorderSections(loaded.config.sections),
        selectedSectionId: loaded.config.sections[0]?.id ?? null,
        parsed,
        currentConfigPath: loaded.path,
        step: "structure"
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load project config." });
    } finally {
      set({ busy: false });
    }
  },
  openOutputFolder: async () => {
    const target = get().outputPath;
    if (target) await window.epubCompiler.openFolder(target);
  },
  handleMenuAction: async (action) => {
    const actionStep = action.startsWith("step-") ? (action.replace("step-", "") as Step) : null;
    if (actionStep) {
      if (actionStep !== "import" && !get().metadata && get().sections.length === 0) {
        set({ error: "Import a DOCX or load a project first." });
        return;
      }
      set({ step: actionStep });
      return;
    }

    if (action === "new-project") {
      if (get().metadata && !window.confirm("Reset current project and return to the import screen?")) return;
      get().resetProject();
      return;
    }
    if (action === "open-docx") return get().chooseDocx();
    if (action === "open-config") return get().loadConfig();
    if (action === "save-config") return get().saveConfig(false);
    if (action === "save-config-as") return get().saveConfig(true);
    if (action === "choose-output") return get().chooseOutput();
    if (action === "compile") return get().compile();
    if (action === "open-output-folder") return get().openOutputFolder();
  },
  setSections: (sections) => set({ sections: reorderSections(sections) }),
  updateSection: (id, patch) =>
    set((state) => ({ sections: state.sections.map((section) => (section.id === id ? { ...section, ...patch } : section)) })),
  updateImage: (id, patch) =>
    set((state) => ({
      sections: state.sections.map((section) =>
        section.id === id && section.image ? { ...section, image: { ...section.image, ...patch } } : section
      )
    })),
  setSelectedSection: (id) => set({ selectedSectionId: id }),
  updateMetadata: (patch) =>
    set((state) => {
      const metadata = state.metadata ? { ...state.metadata, ...patch } : null;
      // Keep the auto-derived output filename in sync with the title, unless the
      // user picked an output path manually.
      const outputPath =
        !state.outputManual && state.sourceDocx ? deriveOutputPath(state.sourceDocx, metadata) : state.outputPath;
      return { metadata, outputPath };
    }),
  setCover: (id) =>
    set((state) => {
      const images = state.sections.filter((section) => section.image);
      const selected = images.find((section) => section.id === id);
      if (!selected) return state;
      const sections = state.sections.map((section) => {
        if (!section.image) return section;
        const isCover = section.id === id;
        const type: SectionType = isCover ? "cover" : section.type === "cover" ? "image" : section.type;
        // Keep the existing extension: GIFs are passed through unconverted, so
        // renaming one to .webp would leave the manifest describing the wrong format.
        const extension = section.image.outputName.match(/\.[^.]+$/)?.[0] ?? ".webp";
        return {
          ...section,
          type,
          title: isCover ? "Cover" : section.title === "Cover" ? "Illustration" : section.title,
          includeInToc: isCover ? true : section.includeInToc,
          image: { ...section.image, outputName: isCover ? `cover${extension}` : section.image.outputName }
        };
      });
      return { sections };
    })
}));

export const appSteps: { id: Step; label: string }[] = [
  { id: "import", label: "Import DOCX" },
  { id: "structure", label: "Book Structure" },
  { id: "toc", label: "Table of Contents" },
  { id: "images", label: "Images" },
  { id: "metadata", label: "Metadata" },
  { id: "compile", label: "Compile" }
];
