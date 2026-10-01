import { CheckCircle2, Download, FolderOpen, Loader2, Save, Type, AlertTriangle } from "lucide-react";
import { useBookStore } from "../stores/bookStore";
import { useT } from "../i18n";
import type { UiKey } from "../i18n/ui";

export default function CompilePage() {
  const t = useT();
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
        <h2 className="font-bold">{t("compile.summary")}</h2>
        <div className="mt-4 grid grid-cols-5 gap-4 text-sm">
          <div><span className="text-stone-500">{t("compile.output")}</span><div className="truncate font-semibold">{outputPath || t("compile.chooseOnCompile")}</div></div>
          <div><span className="text-stone-500">{t("compile.xhtml")}</span><div className="font-semibold">{xhtmlCount}</div></div>
          <div><span className="text-stone-500">{t("compile.images")}</span><div className="font-semibold">{imageCount}</div></div>
          <div><span className="text-stone-500">{t("compile.tocItems")}</span><div className="font-semibold">{tocItemCount}</div></div>
          <div><span className="text-stone-500">{t("compile.metadata")}</span><div className="font-semibold">{metadata?.title && metadata.language ? t("compile.ready") : t("compile.incomplete")}</div></div>
        </div>
        <div className="mt-5 flex gap-2">
          <button className="button-secondary" onClick={chooseOutput}><FolderOpen size={16} /> {t("compile.outputFile")}</button>
          <button className="button" onClick={compile} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} {t("compile.compile")}</button>
          <button className="button-secondary" onClick={() => void saveConfig(true)}><Save size={16} /> {t("compile.saveAs")}</button>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-bold">{t("compile.checklist")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {(["compile.check1", "compile.check2", "compile.check3", "compile.check4", "compile.check5", "compile.check6"] as UiKey[]).map((key) => (
            <div key={key} className="flex items-center gap-2 rounded bg-stone-50 p-3"><CheckCircle2 className="text-teal-700" size={17} /> {t(key)}</div>
          ))}
        </div>
      </section>

      {result && (
        <>
          <section className="panel border-teal-200 bg-teal-50 p-5">
            <h2 className="font-bold text-teal-900">{t("compile.success")}</h2>
            <p className="mt-2 text-sm text-teal-900">{result.outputPath}</p>
            <button className="button mt-4" onClick={openOutputFolder}><FolderOpen size={16} /> {t("compile.openFolder")}</button>
          </section>

          <section className="panel p-5">
            <h2 className="font-bold">{t("compile.fonts")}</h2>
            <div className="mt-4 grid gap-3 text-sm">
              {result.fontStatus.map((font) => (
                <div key={`${font.role}-${font.family}`} className="flex items-start gap-3 rounded bg-stone-50 p-3">
                  {font.found ? <Type className="mt-0.5 text-teal-700" size={17} /> : <AlertTriangle className="mt-0.5 text-amber-600" size={17} />}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{font.message}</div>
                    <div className="mt-1 text-xs text-stone-500">
                      {font.role} · {font.embeddedFiles.length ? font.embeddedFiles.join(", ") : t("compile.fallback")}
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
