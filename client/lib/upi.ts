import qrcode from "qrcode-generator";

/**
 * Builds a `upi://pay` deep link that any UPI app can open or scan.
 *
 * `pa` is left as typed — UPI apps match it literally, and percent-encoding the
 * `@` trips up some of the stricter parsers. Everything else is escaped.
 */
export function upiLink({
  upiId,
  shopName,
  amount,
  note,
}: {
  upiId: string;
  shopName?: string;
  amount?: number;
  note?: string;
}): string {
  const vpa = upiId.trim().replace(/[^A-Za-z0-9.\-_@]/g, "");
  if (!vpa) return "";

  const parts = [`pa=${vpa}`];
  if (shopName?.trim()) parts.push(`pn=${encodeURIComponent(shopName.trim())}`);
  if (amount && amount > 0) parts.push(`am=${amount.toFixed(2)}`);
  parts.push("cu=INR");
  if (note?.trim()) parts.push(`tn=${encodeURIComponent(note.trim())}`);

  return `upi://pay?${parts.join("&")}`;
}

/**
 * Renders `text` as a self-contained QR code SVG.
 *
 * `cellSize`/`margin` are in user units, and the markup carries an explicit
 * width and height so the same string can be dropped into React or into the
 * invoice's HTML document without any layout help. The margin defaults to the
 * four modules of quiet zone the QR spec asks for, which scanners rely on.
 */
export function qrSvg(text: string, cellSize = 3, margin = cellSize * 4): string {
  if (!text) return "";
  try {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag(cellSize, margin);
  } catch {
    // A QR is a convenience; never let it break bill rendering.
    return "";
  }
}
