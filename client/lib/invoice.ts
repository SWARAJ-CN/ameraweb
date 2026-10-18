import { formatCurrency, formatDate } from "./format";
import { qrSvg, upiLink } from "./upi";
import type { Sale, Settings } from "./types";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Builds a self-contained printable invoice for a sale. */
export function invoiceHtml(sale: Sale, settings: Settings): string {
  const currency = settings.currency || "INR";
  const address = [
    settings.addressLine1,
    settings.addressLine2,
    [settings.city, settings.state, settings.pincode].filter(Boolean).join(" "),
    settings.country,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");

  const customer = [
    sale.customerAddress.addressLine1,
    sale.customerAddress.addressLine2,
    sale.customerAddress.landmark,
    [sale.customerAddress.city, sale.customerAddress.state, sale.customerAddress.pincode]
      .filter(Boolean)
      .join(" "),
    sale.customerAddress.country,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");

  const rows = sale.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name || "Item")}</td>
          <td class="num">${item.qty}</td>
          <td class="num">${formatCurrency(item.price, currency)}</td>
          <td class="num">${formatCurrency(item.qty * item.price, currency)}</td>
        </tr>`
    )
    .join("");

  // Fees first, then the amounts taken off the bill — the advance sits with the
  // fees because it is money agreed alongside them, not a discount on them.
  const lines: Array<[string, number, boolean]> = [
    ["Product amount", sale.productAmount, false],
    ["Custom amount", sale.customAmount, false],
    ["Handling fee", sale.handlingFee, false],
    ["Delivery fee", sale.deliveryFee, false],
    ["Advance paid", sale.advancePaid, true],
    ["Discount", sale.discount, true],
  ];
  const linesHtml = lines
    .filter(([, value]) => value)
    .map(
      ([label, value, negative]) =>
        `<tr${label === "Advance paid" ? ' class="advance"' : ""}><td>${label}</td>` +
        `<td class="num">${negative ? "- " : ""}${formatCurrency(value, currency)}</td></tr>`
    )
    .join("");

  const payee = settings.upiEnabled ? settings.upiId.trim() : "";
  const qr = payee
    ? qrSvg(
        upiLink({
          upiId: payee,
          shopName: settings.shopName,
          amount: sale.total,
          note: sale.billNumber,
        })
      )
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(sale.billNumber)} · ${escapeHtml(settings.shopName)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1c1c22; background: #fff; }
  .sheet { max-width: 720px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #e11d6f; padding-bottom: 16px; }
  h1 { margin: 0; font-size: 22px; }
  .muted { color: #6b6b78; }
  .meta { text-align: right; }
  .meta strong { font-size: 18px; }
  .grid { display: flex; gap: 32px; margin: 20px 0; }
  .grid > div { flex: 1; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #8a8a96; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ececf1; }
  th { background: #fdf2f7; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #9d1c55; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 16px; margin-inline-start: auto; width: 300px; }
  .totals tr td { border: none; padding: 4px 0; }
  .totals .grand td { border-top: 2px solid #1c1c22; padding-top: 10px; font-size: 16px; font-weight: 700; }
  .totals .advance td { padding-top: 8px; color: #6b6b78; }

  .qr { margin-top: 2px; }
  .qr svg { display: block; }
  .qr-title { margin-top: 6px; font-size: 12px; font-weight: 700; color: #1c1c22; }
  footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ececf1; font-size: 12px; color: #6b6b78; display: flex; justify-content: space-between; gap: 16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div>
        <h1>${escapeHtml(settings.shopName)}</h1>
        <div class="muted">${escapeHtml(settings.tagline)}</div>
        <div class="muted" style="margin-top:8px">${address}</div>
        ${settings.phone ? `<div class="muted">${escapeHtml(settings.phone)}</div>` : ""}
        ${settings.email ? `<div class="muted">${escapeHtml(settings.email)}</div>` : ""}
        ${settings.gstin ? `<div class="muted">GSTIN: ${escapeHtml(settings.gstin)}</div>` : ""}
      </div>
      <div class="meta">
        <div class="label">Invoice</div>
        <strong>${escapeHtml(sale.billNumber)}</strong>
        <div class="muted">${formatDate(sale.date)}</div>
        <div class="muted">${escapeHtml(sale.saleType)}</div>
      </div>
    </header>

    <div class="grid">
      <div>
        <div class="label">Billed to</div>
        <div><strong>${escapeHtml(sale.customerName)}</strong></div>
        ${customer ? `<div class="muted">${customer}</div>` : ""}
        ${sale.customerAddress.phone ? `<div class="muted">${escapeHtml(sale.customerAddress.phone)}</div>` : ""}
      </div>
      ${
        qr
          ? `<div>
        <div class="label">Payment</div>
        <div class="qr">${qr}<div class="qr-title">Scan to pay</div><div class="muted">${formatCurrency(sale.total, currency)} · ${escapeHtml(sale.billNumber)}</div></div>
      </div>`
          : ""
      }
    </div>

    ${
      sale.items.length
        ? `<table>
            <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`
        : ""
    }

    <table class="totals">
      <tbody>
        ${linesHtml}
        <tr class="grand"><td>Total</td><td class="num">${formatCurrency(sale.total, currency)}</td></tr>
      </tbody>
    </table>

    <footer>
      <span>${escapeHtml(settings.invoiceFooter)}</span>
      <span>Generated by Amare Handmades admin</span>
    </footer>
  </div>
</body>
</html>`;
}

/** Opens the invoice in a new window and triggers the print dialog. */
export function printInvoice(html: string): void {
  const win = window.open("", "_blank", "width=860,height=920");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 300);
}
