import {
  EMPTY_ADDRESS,
  DEFAULT_SETTINGS,
  type Calculation,
  type CustomerAddress,
  type Expense,
  type Product,
  type Sale,
  type SaleItem,
  type Settings,
} from "./types";

type Raw = Record<string, unknown>;

const str = (value: unknown, fallback = ""): string =>
  value === null || value === undefined ? fallback : String(value);

const num = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const iso = (value: unknown, fallback = new Date().toISOString()): string => {
  if (!value) return fallback;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

export function normalizeAddress(raw: unknown): CustomerAddress {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ADDRESS };
  const value = raw as Raw;
  return {
    phone: str(value.phone),
    addressLine1: str(value.addressLine1),
    addressLine2: str(value.addressLine2),
    landmark: str(value.landmark),
    city: str(value.city),
    state: str(value.state),
    pincode: str(value.pincode),
    country: str(value.country, "India") || "India",
  };
}

export function hasAddressContent(address: CustomerAddress): boolean {
  return Boolean(
    address.phone ||
      address.addressLine1 ||
      address.addressLine2 ||
      address.landmark ||
      address.city ||
      address.state ||
      address.pincode
  );
}

function normalizeItems(raw: unknown): SaleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: Raw, index) => ({
    id: str(item?._id ?? item?.id, `item-${index}`),
    name: str(item?.name),
    qty: num(item?.qty, 1),
    price: num(item?.price),
  }));
}

export function normalizeSale(raw: unknown): Sale {
  const value = (raw ?? {}) as Raw;
  return {
    id: str(value._id ?? value.id),
    billNumber: str(value.billNumber),
    billType: value.billType === "custom" ? "custom" : "product",
    saleType: str(value.saleType, "Product Sale"),
    customerName: str(value.customerName, "Walk-in Customer") || "Walk-in Customer",
    customerAddress: normalizeAddress(value.customerAddress),
    items: normalizeItems(value.items),
    customAmount: num(value.customAmount),
    handlingFee: num(value.handlingFee),
    deliveryFee: num(value.deliveryFee),
    discount: num(value.discount),
    productAmount: num(value.productAmount),
    total: num(value.total),
    date: iso(value.saleDate ?? value.date),
    createdAt: iso(value.createdAt ?? value.saleDate),
  };
}

export function normalizeExpense(raw: unknown): Expense {
  const value = (raw ?? {}) as Raw;
  return {
    id: str(value._id ?? value.id),
    type: str(value.type, "Other") || "Other",
    description: str(value.description),
    amount: num(value.amount),
    paymentMethod: str(value.paymentMethod, "Cash") || "Cash",
    category: str(value.category, "Misc") || "Misc",
    notes: str(value.notes),
    date: iso(value.expenseDate ?? value.date),
    createdAt: iso(value.createdAt ?? value.expenseDate),
  };
}

export function normalizeProduct(raw: unknown): Product {
  const value = (raw ?? {}) as Raw;
  return {
    id: str(value._id ?? value.id),
    name: str(value.name),
    price: num(value.price),
    imageUri: str(value.imageUri ?? value.imageUrl ?? value.image),
    category: str(value.category),
    details: str(value.details ?? value.description),
    sourceUrl: str(value.sourceUrl ?? value.source),
    createdAt: iso(value.createdAt),
  };
}

export function normalizeCalculation(raw: unknown): Calculation {
  const value = (raw ?? {}) as Raw;
  return {
    id: str(value._id ?? value.id),
    name: str(value.name),
    expression: str(value.expression),
    result: num(value.result),
    savedAt: iso(value.savedAt ?? value.createdAt),
  };
}

export function normalizeSettings(raw: unknown): Settings {
  const value = (raw ?? {}) as Raw;
  const pick = <K extends keyof Settings>(key: K, fallback: Settings[K]): Settings[K] => {
    const current = value[key];
    return (current === undefined || current === null ? fallback : current) as Settings[K];
  };
  return {
    id: str(value._id ?? value.id),
    shopName: pick("shopName", DEFAULT_SETTINGS.shopName),
    tagline: pick("tagline", DEFAULT_SETTINGS.tagline),
    primaryColor: pick("primaryColor", DEFAULT_SETTINGS.primaryColor),
    backgroundStyle: pick("backgroundStyle", DEFAULT_SETTINGS.backgroundStyle),
    colorScheme: value.colorScheme === "dark" ? "dark" : "light",
    addressLine1: pick("addressLine1", ""),
    addressLine2: pick("addressLine2", ""),
    city: pick("city", ""),
    state: pick("state", ""),
    pincode: pick("pincode", ""),
    country: pick("country", DEFAULT_SETTINGS.country),
    phone: pick("phone", ""),
    email: pick("email", ""),
    gstin: pick("gstin", ""),
    whatsapp: pick("whatsapp", ""),
    upiId: pick("upiId", ""),
    currency: pick("currency", DEFAULT_SETTINGS.currency),
    dateFormat: pick("dateFormat", DEFAULT_SETTINGS.dateFormat),
    invoicePrefix: pick("invoicePrefix", DEFAULT_SETTINGS.invoicePrefix),
    invoiceFooter: pick("invoiceFooter", DEFAULT_SETTINGS.invoiceFooter),
  };
}

/* ------------------------------------------------------------------ *
 * Payloads (app -> backend)
 * ------------------------------------------------------------------ */

export interface SaleDraft {
  billNumber: string;
  billType: "product" | "custom";
  saleType: string;
  customerName: string;
  customerAddress: CustomerAddress;
  items: SaleItem[];
  customAmount: number;
  handlingFee: number;
  deliveryFee: number;
  discount: number;
  productAmount: number;
  total: number;
  date: string;
}

export function saleToPayload(draft: SaleDraft): Record<string, unknown> {
  return {
    billNumber: draft.billNumber.trim(),
    billType: draft.billType,
    saleType: draft.saleType,
    customerName: draft.customerName.trim() || "Walk-in Customer",
    customerAddress: normalizeAddress(draft.customerAddress),
    items: draft.items.map((item) => ({
      name: item.name,
      qty: num(item.qty, 1),
      price: num(item.price),
    })),
    customAmount: num(draft.customAmount),
    handlingFee: num(draft.handlingFee),
    deliveryFee: num(draft.deliveryFee),
    discount: num(draft.discount),
    productAmount: num(draft.productAmount),
    total: num(draft.total),
    saleDate: new Date(draft.date).toISOString(),
  };
}

export interface ExpenseDraft {
  type: string;
  description: string;
  amount: number;
  paymentMethod: string;
  category: string;
  notes: string;
  date: string;
}

export function expenseToPayload(draft: ExpenseDraft): Record<string, unknown> {
  return {
    type: draft.type,
    description: draft.description,
    amount: num(draft.amount),
    paymentMethod: draft.paymentMethod,
    category: draft.category,
    notes: draft.notes,
    expenseDate: new Date(draft.date).toISOString(),
  };
}

export function productToPayload(draft: {
  name: string;
  price: number;
  imageUri: string;
  category: string;
  details: string;
  sourceUrl: string;
}): Record<string, unknown> {
  return {
    name: draft.name.trim(),
    price: num(draft.price),
    imageUri: draft.imageUri.trim(),
    category: draft.category.trim(),
    details: draft.details.trim(),
    sourceUrl: draft.sourceUrl.trim(),
  };
}

/** Computes the line totals for a sale so the UI can preview the bill. */
export function computeSaleTotals(items: SaleItem[], fees: {
  customAmount: number;
  handlingFee: number;
  deliveryFee: number;
  discount: number;
}) {
  const productAmount = items.reduce(
    (sum, item) => sum + num(item.qty, 1) * num(item.price),
    0
  );
  const total =
    productAmount +
    num(fees.customAmount) +
    num(fees.handlingFee) +
    num(fees.deliveryFee) -
    num(fees.discount);
  return { productAmount, total: Math.max(0, total) };
}
