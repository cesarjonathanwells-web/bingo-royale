import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "../public/locales/en/common.json";
import enGame from "../public/locales/en/game.json";
import esCommon from "../public/locales/es/common.json";
import esGame from "../public/locales/es/game.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        game: enGame,
      },
      es: {
        common: esCommon,
        game: esGame,
      },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "es"],
    defaultNS: "common",
    ns: ["common", "game"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "bingo-lang",
    },
  });

export default i18n;
