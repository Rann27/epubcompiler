import { useRef, useState } from "react";
import { FileText, FileX2, FolderOpen, Loader2, UploadCloud } from "lucide-react";
import { useBookStore } from "../stores/bookStore";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

type DragState = "idle" | "valid" | "invalid";

export default function ImportPage() {
  const parsed = useBookStore((state) => state.parsed);
  const busy = useBookStore((state) => state.busy);
  const chooseDocx = useBookStore((state) => state.chooseDocx);
  const analyze = useBookStore((state) => state.analyze);
  const [drag, setDrag] = useState<DragState>("idle");
  const [dropError, setDropError] = useState<string | null>(null);
  // Track nested dragenter/dragleave so leaving a child element doesn't reset the state.
  const dragDepth = useRef(0);

  const evaluateDrag = (event: React.DragEvent<HTMLLabelElement>): DragState => {
    const item = Array.from(event.dataTransfer.items).find((entry) => entry.kind === "file");
    if (!item) return "invalid";
    // MIME is the only hint available mid-drag (the filename is hidden until drop).
    // Empty MIME is common, so treat "unknown" as potentially valid and re-check on drop.
    if (item.type && item.type !== DOCX_MIME) return "invalid";
    return "valid";
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDrag("idle");
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setDropError("That's not a .docx file. Please drop a Word .docx document.");
      return;
    }
    const path = window.epubCompiler.getFilePath(file);
    if (!path) {
      setDropError("Could not read the file path. Try using Choose DOCX instead.");
      return;
    }
    setDropError(null);
    void analyze(path);
  };

  const isDragging = drag !== "idle";
  const zoneClasses =
    drag === "valid"
      ? "border-teal-500 bg-teal-50 ring-4 ring-teal-200/70 scale-[1.02] shadow-lg"
      : drag === "invalid"
      ? "border-red-400 bg-red-50 ring-4 ring-red-200/60 scale-[1.01]"
      : "hover:border-teal-400 hover:bg-teal-50/40";

  return (
    <div className="grid gap-5">
      <label
        className={`panel relative flex min-h-72 cursor-pointer flex-col items-center justify-center overflow-hidden border-dashed p-8 text-center transition-all duration-200 ease-out ${zoneClasses} ${
          busy ? "pointer-events-none opacity-60" : ""
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDrag(evaluateDrag(event));
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = evaluateDrag(event) === "invalid" ? "none" : "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDrag("idle");
        }}
        onDrop={handleDrop}
      >
        {drag === "valid" && (
          <span className="pointer-events-none absolute inset-2 animate-pulse rounded-xl border-2 border-teal-400/70" />
        )}
        {drag === "invalid" ? (
          <FileX2 className="text-red-500" size={46} />
        ) : drag === "valid" ? (
          <UploadCloud className="animate-bounce text-teal-600" size={48} />
        ) : (
          <FileText className="text-teal-700" size={42} />
        )}
        <div className={`mt-4 text-lg font-bold ${drag === "invalid" ? "text-red-600" : isDragging ? "text-teal-700" : ""}`}>
          {drag === "valid"
            ? "Release to import your DOCX"
            : drag === "invalid"
            ? "Only .docx files are supported"
            : "Drop your DOCX here or choose a file to start compiling your EPUB."}
        </div>
        {!isDragging && (
          <button type="button" className="button mt-5" onClick={chooseDocx} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <FolderOpen size={16} />}
            Choose DOCX
          </button>
        )}
        {dropError && !isDragging && <div className="mt-3 text-sm font-semibold text-red-600">{dropError}</div>}
      </label>

      {parsed && (
        <section className="panel p-5">
          <h2 className="font-bold">Parse Summary</h2>
          <div className="mt-4 grid grid-cols-5 gap-3 text-sm">
            <div><span className="text-stone-500">Filename</span><div className="font-semibold">{parsed.filename}</div></div>
            <div><span className="text-stone-500">Size</span><div className="font-semibold">{formatSize(parsed.size)}</div></div>
            <div><span className="text-stone-500">Paragraphs</span><div className="font-semibold">{parsed.summary.paragraphs}</div></div>
            <div><span className="text-stone-500">Headings</span><div className="font-semibold">{parsed.summary.headings}</div></div>
            <div><span className="text-stone-500">Images</span><div className="font-semibold">{parsed.summary.images}</div></div>
          </div>
        </section>
      )}
    </div>
  );
}
