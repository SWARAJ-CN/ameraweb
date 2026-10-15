"use client";

import { Pencil, Printer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TBody, TD, TH, THead, TR, Table, TableWrapper } from "@/components/ui/Table";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceHtml, printInvoice } from "@/lib/invoice";
import type { Sale, Settings } from "@/lib/types";

interface SaleDetailProps {
  sale: Sale | null;
  settings: Settings;
  onClose: () => void;
  onEdit: (sale: Sale) => void;
}

export function SaleDetail({ sale, settings, onClose, onEdit }: SaleDetailProps) {
  const currency = settings.currency;

  return (
    <Modal
      open={Boolean(sale)}
      onClose={onClose}
      size="lg"
      title={sale ? `Bill ${sale.billNumber}` : "Bill"}
      description={sale ? formatDate(sale.date, { dateStyle: "long" }) : undefined}
      footer={
        sale ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => printInvoice(invoiceHtml(sale, settings))}
            >
              <Printer className="size-4" />
              Print
            </Button>
            <Button onClick={() => onEdit(sale)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          </>
        ) : null
      }
    >
      {sale ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={sale.billType === "custom" ? "info" : "brand"}>
              {sale.billType === "custom" ? "Custom order" : "Product sale"}
            </Badge>
            <Badge tone="neutral">{sale.saleType}</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <p className="text-[11px] font-semibold tracking-wide text-faint-foreground uppercase">
                Customer
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{sale.customerName}</p>
              {sale.customerAddress.phone ? (
                <p className="text-xs text-muted-foreground">{sale.customerAddress.phone}</p>
              ) : null}
              {[sale.customerAddress.addressLine1, sale.customerAddress.addressLine2]
                .filter(Boolean)
                .map((line) => (
                  <p key={line} className="text-xs text-muted-foreground">
                    {line}
                  </p>
                ))}
              {[sale.customerAddress.city, sale.customerAddress.state, sale.customerAddress.pincode]
                .filter(Boolean)
                .join(" ") ? (
                <p className="text-xs text-muted-foreground">
                  {[sale.customerAddress.city, sale.customerAddress.state, sale.customerAddress.pincode]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              ) : null}
              {sale.customerAddress.country ? (
                <p className="text-xs text-muted-foreground">{sale.customerAddress.country}</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-border p-4">
              <p className="text-[11px] font-semibold tracking-wide text-faint-foreground uppercase">
                Recorded
              </p>
              <dl className="mt-1 flex flex-col gap-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Sale date</dt>
                  <dd className="font-medium text-foreground">{formatDate(sale.date)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="font-medium text-foreground">{formatDate(sale.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="font-mono text-[11px] text-muted-foreground">{sale.id}</dd>
                </div>
              </dl>
            </div>
          </div>

          {sale.items.length ? (
            <TableWrapper className="rounded-xl border border-border">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Item</TH>
                    <TH className="text-end">Qty</TH>
                    <TH className="text-end">Price</TH>
                    <TH className="text-end">Amount</TH>
                  </TR>
                </THead>
                <TBody>
                  {sale.items.map((item) => (
                    <TR key={item.id}>
                      <TD>{item.name || "Item"}</TD>
                      <TD className="text-end tabular-nums">{item.qty}</TD>
                      <TD className="text-end tabular-nums">
                        {formatCurrency(item.price, currency)}
                      </TD>
                      <TD className="text-end font-semibold tabular-nums">
                        {formatCurrency(item.qty * item.price, currency)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>
          ) : null}

          <dl className="ms-auto flex w-full max-w-xs flex-col gap-1.5 text-sm">
            <Row label="Product amount" value={formatCurrency(sale.productAmount, currency)} />
            {sale.customAmount ? (
              <Row label="Custom amount" value={formatCurrency(sale.customAmount, currency)} />
            ) : null}
            {sale.handlingFee ? (
              <Row label="Handling fee" value={formatCurrency(sale.handlingFee, currency)} />
            ) : null}
            {sale.deliveryFee ? (
              <Row label="Delivery fee" value={formatCurrency(sale.deliveryFee, currency)} />
            ) : null}
            {sale.discount ? (
              <Row
                label="Discount"
                value={`- ${formatCurrency(sale.discount, currency)}`}
                tone="danger"
              />
            ) : null}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
              <dt className="font-semibold text-foreground">Total</dt>
              <dd className="text-base font-bold tabular-nums text-brand">
                {formatCurrency(sale.total, currency)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </Modal>
  );
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === "danger"
            ? "font-medium tabular-nums text-danger"
            : "font-medium tabular-nums text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
