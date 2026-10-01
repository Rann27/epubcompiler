export type SectionType =
  | "cover"
  | "illustration-opener"
  | "image"
  | "toc"
  | "about"
  | "chapter"
  | "extra";

// A contiguous stretch of text sharing one set of inline formatting.
// `color` is a 6-digit lowercase hex without "#", and is only set when the run
// differs from the document's default text color. The emphasis flags are only
// set when active, so an unformatted run stays `{ text }`.
export type DocxRun = {
  text: string;
  color?: string;
  // Resolved through run -> character style -> paragraph style chain -> document defaults.
  fontFamily?: string;
  // Point size.
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type TextAlign = "left" | "center" | "right" | "justify";

export type DocxBlock =
  | { type: "heading"; level: number; text: string; fontFamily?: string; runs?: DocxRun[]; align?: TextAlign; hyphens?: boolean }
  | { type: "paragraph"; text: string; fontFamily?: string; runs?: DocxRun[]; align?: TextAlign; hyphens?: boolean }
  | { type: "image"; relationshipId: string; filename: string; contentType?: string; outputName?: string };

export type FontStatus = {
  family: string;
  role: "body" | "heading" | "toc" | "fallback" | "custom";
  found: boolean;
  embeddedFiles: string[];
  message: string;
};

export type BookSection = {
  id: string;
  type: SectionType;
  title: string;
  href: string;
  sourceBlocks: DocxBlock[];
  includeInToc: boolean;
  includeInSpine: boolean;
  linear: boolean;
  order: number;
  image?: {
    sourcePath: string;
    outputName: string;
    alt: string;
  };
};

export type BookMetadata = {
  title: string;
  author: string;
  translator: string;
  publisher: string;
  language: string;
  description: string;
  series: string;
  volume: string;
  uuid: string;
  date: string;
  modified: string;
};

export type PresetKey = "title" | "author" | "translator" | "language" | "publisher" | "series" | "volume" | "description";
export type PresetFields = Partial<Record<PresetKey, string>>;
export type MetadataPreset = { name: string; fields: PresetFields };

export type ParsedDocx = {
  sourcePath: string;
  filename: string;
  size: number;
  blocks: DocxBlock[];
  summary: {
    paragraphs: number;
    headings: number;
    images: number;
  };
  imageMap: Record<string, string>;
};

export type CompileRequest = {
  sourceDocx: string;
  outputPath: string;
  metadata: BookMetadata;
  sections: BookSection[];
  imageQuality: number;
};

export type CompileResult = {
  outputPath: string;
  xhtmlCount: number;
  imageCount: number;
  tocItemCount: number;
  fontStatus: FontStatus[];
};

export type ProjectConfig = {
  sourceDocx: string;
  outputPath: string;
  metadata: BookMetadata;
  toc: {
    title: string;
    placement: "after-front-illustrations";
    includeInSpine: true;
    linear: false;
  };
  images: {
    oneImagePerPage: true;
    fitMode: "contain";
    format: "webp";
    quality: number;
  };
  sections: BookSection[];
};

export type ElectronApi = {
  getFilePath: (file: File) => string;
  chooseDocx: () => Promise<string | null>;
  chooseOutput: (defaultName: string) => Promise<string | null>;
  analyzeDocx: (path: string, language?: string) => Promise<{ parsed: ParsedDocx; sections: BookSection[]; metadata: BookMetadata }>;
  compileEpub: (request: CompileRequest) => Promise<CompileResult>;
  loadConfig: () => Promise<{ path: string; config: ProjectConfig } | null>;
  saveConfig: (config: ProjectConfig, path?: string) => Promise<string | null>;
  openFolder: (path: string) => Promise<void>;
  setLanguage: (language: string) => Promise<void>;
  loadPresets: () => Promise<MetadataPreset[]>;
  storePresets: (presets: MetadataPreset[]) => Promise<void>;
  exportPreset: (name: string, content: string) => Promise<string | null>;
  onMenuAction: (callback: (action: MenuAction) => void) => () => void;
};

export type MenuAction =
  | "new-project"
  | "open-docx"
  | "open-config"
  | "save-config"
  | "save-config-as"
  | "choose-output"
  | "compile"
  | "open-output-folder"
  | "step-import"
  | "step-structure"
  | "step-toc"
  | "step-images"
  | "step-metadata"
  | "step-compile";
