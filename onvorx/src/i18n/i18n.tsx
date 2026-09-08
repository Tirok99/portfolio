import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./en.json";
import uk from "./uk.json";

export type Lang = "en" | "uk";
type Dict = typeof en;

const DICTS: Record<Lang, Dict> = { en, uk };
const STORAGE_KEY = "onvorx.lang";
const SUPPORTED: Lang[] = ["en", "uk"];

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored as Lang)) return stored as Lang;
  } catch {
    /* ignore */
  }
  const nav = window.navigator.language?.slice(0, 2).toLowerCase();
  return nav === "uk" ? "uk" : "en";
}

/** Resolve a dot-path like "hero.cards.0.title" against the active dictionary. */
function resolve(dict: Dict, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, dict);
}

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a string leaf by dot-path. Falls back to EN, then the key. */
  t: (path: string) => string;
  /** Return an array/object node by dot-path (typed by caller). */
  tx: <T = unknown>(path: string) => T;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang === "uk" ? "uk" : "en";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    if (SUPPORTED.includes(next)) setLangState(next);
  }, []);

  const t = useCallback(
    (path: string): string => {
      const active = resolve(DICTS[lang], path);
      if (typeof active === "string") return active;
      const fallback = resolve(DICTS.en, path);
      if (typeof fallback === "string") return fallback;
      return path;
    },
    [lang],
  );

  const tx = useCallback(
    <T,>(path: string): T => {
      const active = resolve(DICTS[lang], path);
      if (active !== undefined) return active as T;
      return resolve(DICTS.en, path) as T;
    },
    [lang],
  );

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t, tx }), [lang, setLang, t, tx]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
