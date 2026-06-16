"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type AppLanguage = "en" | "de" | "nl" | "fr" | "es" | "it" | "pt" | "zh" | "ar" | "pl";

export const APP_LANGUAGES: { code: AppLanguage; label: string; nativeLabel: string; flag: string }[] = [
  { code: "en", label: "English",    nativeLabel: "English",    flag: "🇬🇧" },
  { code: "de", label: "German",     nativeLabel: "Deutsch",    flag: "🇩🇪" },
  { code: "nl", label: "Dutch",      nativeLabel: "Nederlands", flag: "🇳🇱" },
  { code: "fr", label: "French",     nativeLabel: "Français",   flag: "🇫🇷" },
  { code: "es", label: "Spanish",    nativeLabel: "Español",    flag: "🇪🇸" },
  { code: "it", label: "Italian",    nativeLabel: "Italiano",   flag: "🇮🇹" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português",  flag: "🇵🇹" },
  { code: "zh", label: "Chinese",    nativeLabel: "中文",       flag: "🇨🇳" },
  { code: "ar", label: "Arabic",     nativeLabel: "العربية",    flag: "🇸🇦" },
  { code: "pl", label: "Polish",     nativeLabel: "Polski",     flag: "🇵🇱" },
];

const STORAGE_KEY = "workzo_app_language";

type AppLanguageContextType = {
  appLanguage: AppLanguage;
  setAppLanguage: (lang: AppLanguage) => void;
  currentLang: typeof APP_LANGUAGES[number];
};

const AppLanguageContext = createContext<AppLanguageContextType>({
  appLanguage: "en",
  setAppLanguage: () => {},
  currentLang: APP_LANGUAGES[0],
});

export function AppLanguageProvider({ children }: { children: React.ReactNode }) {
  const [appLanguage, setAppLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
      if (stored && APP_LANGUAGES.find((l) => l.code === stored)) {
        setAppLanguageState(stored);
      }
    } catch {}
  }, []);

  function setAppLanguage(lang: AppLanguage) {
    setAppLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }

  const currentLang = APP_LANGUAGES.find((l) => l.code === appLanguage) || APP_LANGUAGES[0];

  return (
    <AppLanguageContext.Provider value={{ appLanguage, setAppLanguage, currentLang }}>
      {children}
    </AppLanguageContext.Provider>
  );
}

export function useAppLanguage() {
  return useContext(AppLanguageContext);
}

export function getStoredAppLanguage(): AppLanguage {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
    if (stored && APP_LANGUAGES.find((l) => l.code === stored)) return stored;
  } catch {}
  return "en";
}
