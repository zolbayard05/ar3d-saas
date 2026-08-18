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

// Arbitrary-value Tailwind utilities (`p-[13px]`, `w-[347px]`, `text-[19px]`,
// ...) — banned for the same reason as raw palette colors: any value that
// isn't a token bypasses styles/tokens.css, so a redesign can't reach it.
const SPACING_SIZING_PREFIX =
  "p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|w|h|min-w|min-h|max-w|max-h|size|top|right|bottom|left|inset|inset-x|inset-y|translate-x|translate-y|text|leading|tracking";
const ARBITRARY_SPACING_SIZING = `\\b(?:${SPACING_SIZING_PREFIX})-\\[[^\\]]+\\]`;

const RADIUS_DIRECTION = "t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee";
const ARBITRARY_SHADOW_RADIUS = `\\b(?:rounded(?:-(?:${RADIUS_DIRECTION}))?|shadow)-\\[[^\\]]+\\]`;

const ARBITRARY_FONT_UTILITY = "\\bfont-\\[[^\\]]+\\]";

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
    selector: `JSXAttribute[name.name='className'] Literal[value=/${ARBITRARY_SPACING_SIZING}/]`,
    message:
      "Arbitrary spacing/sizing values (p-[13px], w-[347px], text-[19px], ...) are banned — add a token to styles/tokens.css (or use Tailwind's default scale) instead.",
  },
  {
    selector: `JSXAttribute[name.name='className'] Literal[value=/${ARBITRARY_SHADOW_RADIUS}/]`,
    message:
      "Arbitrary shadow/radius values are banned — add a --shadow-*/--radius-* token in styles/tokens.css instead.",
  },
  {
    selector: `JSXAttribute[name.name='className'] Literal[value=/${ARBITRARY_FONT_UTILITY}/]`,
    message:
      "Arbitrary font utilities are banned — use font-sans/font-mono (mapped from styles/tokens.css) instead.",
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
  {
    selector: `TemplateElement[value.raw=/${ARBITRARY_SPACING_SIZING}/]`,
    message:
      "Arbitrary spacing/sizing values are banned — add a token to styles/tokens.css (or use Tailwind's default scale) instead.",
  },
  {
    selector: `TemplateElement[value.raw=/${ARBITRARY_SHADOW_RADIUS}/]`,
    message:
      "Arbitrary shadow/radius values are banned — add a --shadow-*/--radius-* token in styles/tokens.css instead.",
  },
  {
    selector: `TemplateElement[value.raw=/${ARBITRARY_FONT_UTILITY}/]`,
    message:
      "Arbitrary font utilities are banned — use font-sans/font-mono (mapped from styles/tokens.css) instead.",
  },
  {
    // style={{ fontFamily: '...' }} — the inline-style escape hatch around
    // the className-based checks above. Banned unconditionally: components
    // select a font via the font-sans/font-mono classes, never inline.
    selector: "JSXAttribute[name.name='style'] Property[key.name='fontFamily']",
    message:
      "Raw font-family declarations are banned outside styles/ — use the font-sans/font-mono utility classes instead.",
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
