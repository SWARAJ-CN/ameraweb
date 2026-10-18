"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Printer, RotateCcw, Save } from "lucide-react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Notice, Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/Controls";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { BrandColorPicker } from "@/components/features/BrandColorPicker";
import { applyBrand } from "@/lib/brand";
import { invoiceHtml, printInvoice } from "@/lib/invoice";
import { qrSvg, upiLink } from "@/lib/upi";
import { EMPTY_ADDRESS, type Sale, type Settings } from "@/lib/types";

const BACKGROUND_STYLES = ["light", "dark", "soft", "gradient"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "AUD", "CAD"];
const DATE_FORMATS = ["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

/** The invoice frame is as tall as its content, within these bounds. */
const PREVIEW_MIN_HEIGHT = 420;
const PREVIEW_MAX_HEIGHT = 900;

const SAMPLE_SALE: Sale = {
  id: "preview",
  billNumber: "AM-1001",
  billType: "product",
  saleType: "Product Sale",
  customerName: "Asha Menon",
  customerAddress: {
    ...EMPTY_ADDRESS,
    phone: "+91 98765 43210",
    addressLine1: "44 Rose Lane",
    city: "Kochi",
    state: "Kerala",
    pincode: "682016",
  },
  items: [
    { id: "1", name: "Crochet keychain", qty: 3, price: 180 },
    { id: "2", name: "Handpainted tote", qty: 1, price: 1250 },
  ],
  customAmount: 0,
  handlingFee: 50,
  deliveryFee: 80,
  discount: 100,
  advancePaid: 500,
  productAmount: 1790,
  total: 1820,
  date: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

export default function SettingsPage() {
  const { settings, loading, updateSettings } = useData();
  const toast = useToast();

  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(PREVIEW_MIN_HEIGHT);

  const current = draft ?? settings;

  // Keep the last saved colour so we can restore it when leaving the page.
  const savedColor = useRef(settings.primaryColor);
  useEffect(() => {
    savedColor.current = settings.primaryColor;
  }, [settings.primaryColor]);

  // Apply the colour being edited so the whole app previews it live.
  useEffect(() => {
    applyBrand(current.primaryColor);
  }, [current.primaryColor]);

  // Restore the saved colour if the page is left without saving.
  useEffect(() => () => applyBrand(savedColor.current), []);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft({ ...current, [key]: value });

  // The same link and QR the sample bill prints, so the preview is truthful.
  const upiPreviewLink = useMemo(
    () =>
      current.upiEnabled && current.upiId.trim()
        ? upiLink({
            upiId: current.upiId,
            shopName: current.shopName,
            amount: SAMPLE_SALE.total,
            note: SAMPLE_SALE.billNumber,
          })
        : "",
    [current.upiEnabled, current.upiId, current.shopName]
  );
  const upiPreviewQr = useMemo(() => qrSvg(upiPreviewLink, 4), [upiPreviewLink]);

  const dirty = useMemo(
    () => draft !== null && JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings]
  );

  const previewHtml = useMemo(() => invoiceHtml(SAMPLE_SALE, current), [current]);
  const save = async () => {
    setSaving(true);
    try {
      await updateSettings(draft ?? settings);
      setDraft(null);
      toast.success("Settings saved", "The shop profile and invoice details are up to date.");
    } catch (caught) {
      toast.error(
        "Could not save settings",
        caught instanceof Error ? caught.message : undefined
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings.id) {
    return (
      <>
        <PageHeader title="Settings" description="Shop profile and invoice details." />
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="The shared business profile that drives bills and printing."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setDraft(null)}
              disabled={!dirty || saving}
            >
              <RotateCcw className="size-4" />
              Discard changes
            </Button>
            <Button onClick={save} loading={saving} disabled={!dirty}>
              <Save className="size-4" />
              Save settings
            </Button>
          </>
        }
      />

      {dirty ? (
        <Notice tone="info" title="You have unsaved changes">
          Save to push these details to every bill and the shop header.
        </Notice>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Brand" description="Name, tagline and theme hints." />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Shop name" htmlFor="set-shop" required>
                <Input
                  id="set-shop"
                  value={current.shopName}
                  onChange={(event) => set("shopName", event.target.value)}
                />
              </Field>
              <Field label="Tagline" htmlFor="set-tagline">
                <Input
                  id="set-tagline"
                  value={current.tagline}
                  onChange={(event) => set("tagline", event.target.value)}
                />
              </Field>
              <Field
                label="Primary colour"
                hint="Drives the brand colour across the whole admin."
                className="sm:col-span-2"
              >
                <BrandColorPicker
                  value={current.primaryColor}
                  onChange={(hex) => set("primaryColor", hex)}
                />
              </Field>
              <Field label="Background style" htmlFor="set-bg">
                <Select
                  id="set-bg"
                  value={current.backgroundStyle}
                  onChange={(event) => set("backgroundStyle", event.target.value)}
                >
                  {BACKGROUND_STYLES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Colour scheme"
                htmlFor="set-scheme"
                hint="Preferred scheme for connected apps."
              >
                <Select
                  id="set-scheme"
                  value={current.colorScheme}
                  onChange={(event) =>
                    set("colorScheme", event.target.value as Settings["colorScheme"])
                  }
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Contact & tax" description="Printed in the bill header and footer." />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" htmlFor="set-phone">
                <Input
                  id="set-phone"
                  value={current.phone}
                  onChange={(event) => set("phone", event.target.value)}
                  placeholder="+91 98765 43210"
                />
              </Field>
              <Field label="Email" htmlFor="set-email">
                <Input
                  id="set-email"
                  type="email"
                  value={current.email}
                  onChange={(event) => set("email", event.target.value)}
                  placeholder="hello@example.com"
                />
              </Field>
              <Field label="WhatsApp" htmlFor="set-whatsapp">
                <Input
                  id="set-whatsapp"
                  value={current.whatsapp}
                  onChange={(event) => set("whatsapp", event.target.value)}
                />
              </Field>
              <Field label="GSTIN" htmlFor="set-gstin">
                <Input
                  id="set-gstin"
                  value={current.gstin}
                  onChange={(event) => set("gstin", event.target.value)}
                  placeholder="32ABCDE1234F1Z5"
                />
              </Field>
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">UPI payments</p>
                    <p className="text-xs text-muted">
                      Show your UPI id and a payment QR on every bill.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted">
                      {current.upiEnabled ? "On" : "Off"}
                    </span>
                    <Switch
                      checked={current.upiEnabled}
                      onChange={(next) => set("upiEnabled", next)}
                      aria-label="Show UPI details on bills"
                    />
                  </div>
                </div>

                <Field label="UPI ID" htmlFor="set-upi" hint="Payee VPA used for payment QR codes.">
                  <Input
                    id="set-upi"
                    value={current.upiId}
                    onChange={(event) => set("upiId", event.target.value)}
                    placeholder="amarehandmades@ybl"
                  />
                </Field>

                {!current.upiEnabled ? (
                  <p className="text-xs text-muted">
                    UPI details and the payment QR are hidden on bills.
                  </p>
                ) : upiPreviewQr ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-3">
                    <div
                      className="flex-none leading-none"
                      // Built by qrSvg() from the shop's own UPI id.
                      dangerouslySetInnerHTML={{ __html: upiPreviewQr }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">Scan to pay</p>
                      <p className="text-xs break-all text-muted-foreground">
                        {upiPreviewLink}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Add a UPI ID to generate the payment QR.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Address" description="The “From” block on every bill." />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Address line 1" htmlFor="set-addr1" className="sm:col-span-2">
                <Input
                  id="set-addr1"
                  value={current.addressLine1}
                  onChange={(event) => set("addressLine1", event.target.value)}
                />
              </Field>
              <Field label="Address line 2" htmlFor="set-addr2" className="sm:col-span-2">
                <Input
                  id="set-addr2"
                  value={current.addressLine2}
                  onChange={(event) => set("addressLine2", event.target.value)}
                />
              </Field>
              <Field label="City" htmlFor="set-city">
                <Input
                  id="set-city"
                  value={current.city}
                  onChange={(event) => set("city", event.target.value)}
                />
              </Field>
              <Field label="State" htmlFor="set-state">
                <Input
                  id="set-state"
                  value={current.state}
                  onChange={(event) => set("state", event.target.value)}
                />
              </Field>
              <Field label="Pincode" htmlFor="set-pincode">
                <Input
                  id="set-pincode"
                  value={current.pincode}
                  onChange={(event) => set("pincode", event.target.value)}
                />
              </Field>
              <Field label="Country" htmlFor="set-country">
                <Input
                  id="set-country"
                  value={current.country}
                  onChange={(event) => set("country", event.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Billing" description="Currency, dates and bill numbering." />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Currency" htmlFor="set-currency">
                <Select
                  id="set-currency"
                  value={current.currency}
                  onChange={(event) => set("currency", event.target.value)}
                >
                  {CURRENCIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date format" htmlFor="set-dateformat">
                <Select
                  id="set-dateformat"
                  value={current.dateFormat}
                  onChange={(event) => set("dateFormat", event.target.value)}
                >
                  {DATE_FORMATS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Invoice prefix" htmlFor="set-prefix">
                <Input
                  id="set-prefix"
                  value={current.invoicePrefix}
                  onChange={(event) => set("invoicePrefix", event.target.value)}
                  placeholder="AM-"
                />
              </Field>
              <Field label="Invoice footer" htmlFor="set-footer" className="sm:col-span-2">
                <Textarea
                  id="set-footer"
                  value={current.invoiceFooter}
                  onChange={(event) => set("invoiceFooter", event.target.value)}
                  placeholder="Thank you!"
                  className="min-h-16"
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-4">
          <CardHeader
            title="Invoice preview"
            description="A live sample bill using the values on the left."
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => printInvoice(previewHtml)}
              >
                <Printer className="size-3.5" />
                Print
              </Button>
            }
          />
          <CardContent className="p-0">
            <iframe
              title="Invoice preview"
              srcDoc={previewHtml}
              onLoad={(event) => {
                const doc = event.currentTarget.contentDocument;
                if (!doc?.body) return;
                // Read the sheet itself: documentElement.scrollHeight would
                // never shrink below the current frame height.
                const sheet = doc.querySelector(".sheet");
                const styles = doc.defaultView?.getComputedStyle(doc.body);
                const padding =
                  (parseFloat(styles?.paddingTop ?? "0") || 0) +
                  (parseFloat(styles?.paddingBottom ?? "0") || 0);
                const content = sheet?.scrollHeight ?? doc.body.scrollHeight;
                const height = Math.ceil(content + padding);
                setPreviewHeight(
                  Math.min(PREVIEW_MAX_HEIGHT, Math.max(PREVIEW_MIN_HEIGHT, height))
                );
              }}
              style={{ height: previewHeight }}
              className="w-full rounded-b-2xl border-0 bg-white"
              sandbox="allow-same-origin"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
