import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Tailwind's default color palettes — banned as raw utilities in
// components/app so every color decision routes through styles/tokens.css
// + styles/themes.css (constraint: "no hardcoded style values").
const RAW_PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const RAW_COLOR_UTILITY = `\\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|caret|accent|shadow)-(?:${RAW_PALETTE})-\\d{2,3}\\b`;
const HEX_COLOR = "#[0-9a-fA-F]{3,8}\\b";

const noRawStyleRules = [
  "error",
  {
    // Static className="...". Covers the common case directly.
    selector: `JSXAttribute[name.name='className'] Literal[value=/${HEX_COLOR}/]`,
    message:
      "Raw hex colors are banned in className — add/use a semantic token (bg-surface, text-muted, ...) in styles/tokens.css instead.",
  },
  {
    selector: `JSXAttribute[name.name='className'] Literal[value=/${RAW_COLOR_UTILITY}/]`,
    message:
      "Raw Tailwind palette utilities (bg-blue-500, text-red-600, ...) are banned — use a semantic token class instead.",
  },
  {
    // Template-literal / clsx()-composed className strings, e.g.
    // className={cn("...", condition && "bg-blue-500")}.
    selector: `TemplateElement[value.raw=/${HEX_COLOR}/]`,
    message:
      "Raw hex colors are banned — add/use a semantic token in styles/tokens.css instead.",
  },
  {
    selector: `TemplateElement[value.raw=/${RAW_COLOR_UTILITY}/]`,
    message:
      "Raw Tailwind palette utilities are banned — use a semantic token class instead.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": noRawStyleRules,
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
