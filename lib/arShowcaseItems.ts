export interface ArShowcaseItem {
  key: string;
  label: string;
  src: string;
  iosSrc: string;
  alt: string;
}

/**
 * Static demo assets for the desktop landing's AR showcase
 * (components/DesktopShowcaseSection.tsx) — one shared list so its QR code
 * (pointing phones at app/ar/[item]/page.tsx) and the page it points to can
 * never drift onto different keys/paths.
 */
export const AR_SHOWCASE_ITEMS: ArShowcaseItem[] = [
  { key: "backpack", label: "Цүнх", src: "/icons/mockup/backpack.glb", iosSrc: "/icons/mockup/backpack.usdz", alt: "Цүнх" },
  { key: "sneaker", label: "Гутал", src: "/icons/mockup/sneaker.glb", iosSrc: "/icons/mockup/sneaker.usdz", alt: "Гутал" },
];
