export interface ArShowcaseItem {
  key: string;
  label: string;
  src: string;
  /**
   * Optional — omit for an item with no real USDZ counterpart. Rule 1/2:
   * iOS Quick Look silently fails without a real USDZ, so any item missing
   * this MUST NOT be offered AR (DesktopShowcaseSection.tsx/ArLaunchView.tsx
   * both gate their AR button + QR/link on this field being present —
   * never render an AR affordance for an item that lacks it).
   */
  iosSrc?: string;
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
  // No .usdz counterpart provided (only a .glb) — AR intentionally NOT
  // wired up for this item, real 3D web viewer only (drag-to-orbit).
  { key: "headphones", label: "Чихэвч", src: "/icons/mockup/headphones.glb", alt: "Чихэвч" },
];
