import QRCode from "qrcode";

/**
 * Renders the QR to an in-memory canvas, then draws the app icon centered
 * on top inside a white badge — errorCorrectionLevel "H" gives ~30% of the
 * code's modules to spare, and the badge covers well under that (~19%), so
 * the logo doesn't cost scannability. The white badge (not just the bare
 * icon) matters: without it, the icon's own dark background would sit
 * directly against QR modules with no quiet zone, which is what actually
 * breaks scanners — not the occlusion itself.
 *
 * Browser-only (canvas, Image) — call from a client component, after mount.
 * Shared by components/ModelShare.tsx (a model's own share link) and
 * components/DesktopLanding.tsx (the site's root URL, "scan on your
 * phone") rather than each keeping its own copy.
 */
export async function buildLogoQr(url: string): Promise<string> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 480,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  const logo = new Image();
  logo.src = "/icon-512.png";
  await new Promise<void>((resolve, reject) => {
    logo.onload = () => resolve();
    logo.onerror = () => reject(new Error("logo failed to load"));
  });

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");

  const size = canvas.width;
  const badge = size * 0.24;
  const mark = size * 0.19;
  const badgePos = (size - badge) / 2;
  const markPos = (size - mark) / 2;
  const radius = badge * 0.18;

  ctx.fillStyle = "#ffffff";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(badgePos, badgePos, badge, badge, radius);
    ctx.fill();
  } else {
    ctx.fillRect(badgePos, badgePos, badge, badge);
  }
  ctx.drawImage(logo, markPos, markPos, mark, mark);

  return canvas.toDataURL("image/png");
}
