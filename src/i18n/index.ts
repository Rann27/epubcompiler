import { create } from "zustand";
import { normalizeLang, type LangCode } from "./epub";
import { uiStrings, type UiKey } from "./ui";

const STORAGE_KEY = "epubcompiler.uiLanguage";

function initialLanguage(): LangCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeLang(saved);
  } catch {
    // storage unavailable
  }
  return normalizeLang(typeof navigator !== "undefined" ? navigator.language : "id");
}

type I18nStore = { lang: LangCode; setLang: (lang: LangCode) => void };

export const useI18n = create<I18nStore>((set) => ({
  lang: initialLanguage(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
    void window.epubCompiler?.setLanguage(lang);
    set({ lang });
  }
}));

type Params = Record<string, string | number>;

export function translate(lang: LangCode, key: UiKey, params?: Params): string {
  let text = uiStrings[lang][key] ?? uiStrings.en[key];
  if (params) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

// Hook for components: re-renders when the language changes.
export function useT() {
  const lang = useI18n((state) => state.lang);
  return (key: UiKey, params?: Params) => translate(lang, key, params);
}

// Non-reactive access for store actions.
export function t(key: UiKey, params?: Params) {
  return translate(useI18n.getState().lang, key, params);
}
