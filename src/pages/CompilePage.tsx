import { CheckCircle2, Download, FolderOpen, Loader2, Save, Type, AlertTriangle } from "lucide-react";
import { useBookStore } from "../stores/bookStore";

export default function CompilePage() {
  const sections = useBookStore((state) => state.sections);
  const outputPath = useBookStore((state) => state.outputPath);
  const metadata = useBookStore((state) => state.metadata);
  const busy = useBookStore((state) => state.busy);
  const result = useBookStore((state) => state.compileResult);
  const chooseOutput = useBookStore((state) => state.chooseOutput);
  const compile = useBookStore((state) => state.compile);
  const saveConfig = useBookStore((state) => state.saveConfig);
  const openOutputFolder = useBookStore((state) => state.openOutputFolder);
  const xhtmlCount = sections.filter((section) => section.includeInSpine || section.type === "toc").length;
  const imageCount = sections.filter((section) => section.image).length;
  const tocItemCount = sections.filter((section) => section.includeInToc).length;

  return (
    <div className="grid gap-5">
      <section className="panel p-5">
        <h2 className="font-bold">Final Summary</h2>
        <div className="mt-4 grid grid-cols-5 gap-4 text-sm">
          <div><span className="text-stone-500">Output</span><div className="truncate font-semibold">{outputPath || "Choose on compile"}</div></div>
          <div><span className="text-stone-500">XHTML</span><div className="font-semibold">{xhtmlCount}</div></div>
          <div><span className="text-stone-500">Images</span><div className="font-semibold">{imageCount}</div></div>
          <div><span className="text-stone-500">ToC items</span><div className="font-semibold">{tocItemCount}</div></div>
          <div><span className="text-stone-500">Metadata</span><div className="font-semibold">{metadata?.title && metadata.language ? "Ready" : "Incomplete"}</div></div>
        </div>
        <div className="mt-5 flex gap-2">
          <button className="button-secondary" onClick={chooseOutput}><FolderOpen size={16} /> Output File</button>
          <button className="button" onClick={compile} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} Compile EPUB</button>
          <button className="button-secondary" onClick={() => void saveConfig(true)}><Save size={16} /> Save Project Config As</button>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-bold">EPUB Checklist</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {["mimetype root file is uncompressed", "META-INF/container.xml points to OEBPS/content.opf", "nav.xhtml registered with properties=\"nav\"", "nav.xhtml included in spine with linear=\"no\"", "Images converted to WebP quality 90", "One image per XHTML page with object-fit contain"].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded bg-stone-50 p-3"><CheckCircle2 className="text-teal-700" size={17} /> {item}</div>
          ))}
        </div>
      </section>

      {result && (
        <>
          <section className="panel border-teal-200 bg-teal-50 p-5">
            <h2 className="font-bold text-teal-900">Compile Success</h2>
            <p className="mt-2 text-sm text-teal-900">{result.outputPath}</p>
            <button className="button mt-4" onClick={openOutputFolder}><FolderOpen size={16} /> Open Output Folder</button>
          </section>

          <section className="panel p-5">
            <h2 className="font-bold">Font Embedding</h2>
            <div className="mt-4 grid gap-3 text-sm">
              {result.fontStatus.map((font) => (
                <div key={`${font.role}-${font.family}`} className="flex items-start gap-3 rounded bg-stone-50 p-3">
                  {font.found ? <Type className="mt-0.5 text-teal-700" size={17} /> : <AlertTriangle className="mt-0.5 text-amber-600" size={17} />}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{font.message}</div>
                    <div className="mt-1 text-xs text-stone-500">
                      {font.role} · {font.embeddedFiles.length ? font.embeddedFiles.join(", ") : "fallback active"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
