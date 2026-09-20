import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";
import es from "./es.json";
import qu from "./qu.json";
import ay from "./ay.json";
import pt from "./pt.json";

const saved = typeof window !== "undefined" ? localStorage.getItem("i18nextLng") : null;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, es: { translation: es }, qu: { translation: qu }, ay: { translation: ay }, pt: { translation: pt } },
    lng: saved || "es",
    fallbackLng: "es",
    interpolation: { escapeValue: false },
    detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
  });

export const LANGUAGES = [
  { code: "es", label: "Español", native: "Español" },
  { code: "qu", label: "Quechua", native: "Runasimi" },
  { code: "ay", label: "Aymara", native: "Aymar aru" },
  { code: "pt", label: "Português", native: "Português" },
  { code: "en", label: "English", native: "English" },
] as const;

export default i18n;
