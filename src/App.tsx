import { AlertCircle, ArrowLeft, ArrowRight, Globe } from "lucide-react";
import { useEffect } from "react";
import { useBookStore, appSteps } from "./stores/bookStore";
import ImportPage from "./pages/ImportPage";
import StructurePage from "./pages/StructurePage";
import TocPage from "./pages/TocPage";
import ImagesPage from "./pages/ImagesPage";
import MetadataPage from "./pages/MetadataPage";
import CompilePage from "./pages/CompilePage";
import { useI18n, useT } from "./i18n";
import { languageOptions, type LangCode } from "./i18n/epub";

function Page() {
  const step = useBookStore((state) => state.step);
  if (step === "import") return <ImportPage />;
  if (step === "structure") return <StructurePage />;
  if (step === "toc") return <TocPage />;
  if (step === "images") return <ImagesPage />;
  if (step === "metadata") return <MetadataPage />;
  return <CompilePage />;
}

export default function App() {
  const t = useT();
  const lang = useI18n((state) => state.lang);
  const setLang = useI18n((state) => state.setLang);
  const step = useBookStore((state) => state.step);
  const setStep = useBookStore((state) => state.setStep);
  const nextStep = useBookStore((state) => state.nextStep);
  const previousStep = useBookStore((state) => state.previousStep);
  const parsed = useBookStore((state) => state.parsed);
  const metadata = useBookStore((state) => state.metadata);
  const sections = useBookStore((state) => state.sections);
  const error = useBookStore((state) => state.error);
  const handleMenuAction = useBookStore((state) => state.handleMenuAction);
  const currentIndex = appSteps.findIndex((item) => item.id === step);
  const hasProject = Boolean(parsed || metadata || sections.length);

  // Keep the native menu and <html lang> in sync with the saved UI language.
  useEffect(() => {
    void window.epubCompiler.setLanguage(lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    return window.epubCompiler.onMenuAction((action) => {
      void handleMenuAction(action);
    });
  }, [handleMenuAction]);

  return (
    <div className="flex min-h-screen bg-[#f6f3ed] text-stone-900">
      <aside className="w-72 border-r border-stone-200 bg-[#fffdf8] px-5 py-6">
        <h1 className="text-xl font-bold tracking-normal">EPUB Compiler</h1>
        <p className="mt-1 text-sm text-stone-500">{t("app.subtitle")}</p>
        <nav className="mt-8 space-y-2">
          {appSteps.map((item, index) => {
            const active = item.id === step;
            const disabled = !hasProject && item.id !== "import";
            return (
              <button
                key={item.id}
                disabled={disabled}
                onClick={() => setStep(item.id)}
                className={`flex w-full items-center gap-3 rounded px-3 py-3 text-left text-sm transition ${
                  active ? "bg-teal-700 text-white" : "text-stone-700 hover:bg-stone-100 disabled:text-stone-300"
                }`}
              >
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${active ? "bg-white/20" : "bg-stone-200"}`}>
                  {index + 1}
                </span>
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-6">
          <div>
            <div className="text-sm font-semibold text-stone-500">{t("app.stepOf", { current: currentIndex + 1, total: appSteps.length })}</div>
            <div className="text-lg font-bold">{t(appSteps[currentIndex].labelKey)}</div>
          </div>
          <div className="flex items-center gap-2">
            <label className="mr-2 flex items-center gap-2 text-sm text-stone-600" title={t("app.language")}>
              <Globe size={16} />
              <select
                aria-label={t("app.language")}
                className="field w-auto py-1.5"
                value={lang}
                onChange={(event) => setLang(event.target.value as LangCode)}
              >
                {languageOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </label>
            <button className="button-secondary" onClick={previousStep} disabled={currentIndex === 0}>
              <ArrowLeft size={16} /> {t("app.back")}
            </button>
            <button className="button" onClick={nextStep} disabled={!hasProject || currentIndex === appSteps.length - 1}>
              {t("app.next")} <ArrowRight size={16} />
            </button>
          </div>
        </header>
        {error && (
          <div className="mx-6 mt-5 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle size={18} /> {error}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <Page />
        </div>
      </main>
    </div>
  );
}
