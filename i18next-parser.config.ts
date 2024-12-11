import { readdirSync } from "fs";

export default {
  keySeparator: ".",
  namespaceSeparator: false,
  contextSeparator: "|",
  pluralSeparator: "_",
  createOldCatalogs: false,
  defaultNamespace: "app",
  lexers: {
    ts: [
      {
        lexer: "JavascriptLexer",
        functions: ["t", "translatedError"],
        namespaceFunctions: ["useTranslation", "withTranslation"],
      },
    ],
    tsx: [
      {
        lexer: "JsxLexer",
        functions: ["t", "translatedError"],
        namespaceFunctions: ["useTranslation", "withTranslation"],
      },
    ],
  },
  locales: readdirSync("locales", { withFileTypes: true })
    .filter(({ isDirectory }) => isDirectory)
    .map(({ name }) => name),
  output: "locales/$LOCALE/$NAMESPACE.json",
  input: ["src/**/*.{ts,tsx}"],
  sort: true,
};
