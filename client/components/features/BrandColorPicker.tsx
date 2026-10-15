"use client";

import { Check, Pipette } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  brandForeground,
  isValidHex,
  normalizePrimaryColor,
  PRESET_COLORS,
} from "@/lib/brand";

interface BrandColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

/**
 * Swatch palette + free-form picker for the shop's primary colour. The preview
 * strip uses the live `brand` tokens, so it always mirrors what the rest of the
 * app will look like once applied.
 */
export function BrandColorPicker({ value, onChange }: BrandColorPickerProps) {
  const hex = normalizePrimaryColor(value);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Preset colours"
        className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-12"
      >
        {PRESET_COLORS.map((color) => {
          const selected = color.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={`Use ${color}`}
              aria-pressed={selected}
              title={color}
              style={{ backgroundColor: color }}
              className={cn(
                "grid size-7 place-items-center rounded-lg ring-offset-2 ring-offset-surface transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                selected && "ring-2 ring-foreground"
              )}
            >
              {selected ? (
                <Check className="size-4" style={{ color: brandForeground(color) }} />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label
          title="Pick a custom colour"
          className="relative grid size-10 flex-none cursor-pointer place-items-center overflow-clip rounded-lg border border-border-strong bg-surface"
        >
          <input
            type="color"
            value={hex}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="Pick a custom colour"
          />
          <span
            className="size-6 rounded-md shadow-sm"
            style={{ backgroundColor: hex }}
          />
          <Pipette className="pointer-events-none absolute end-1 bottom-1 size-3.5 text-foreground/70 mix-blend-luminosity" />
        </label>

        <input
          key={hex}
          type="text"
          defaultValue={hex}
          spellCheck={false}
          aria-label="Primary colour hex value"
          onChange={(event) => {
            if (isValidHex(event.target.value)) {
              onChange(normalizePrimaryColor(event.target.value));
            }
          }}
          onBlur={(event) => {
            if (!isValidHex(event.target.value)) event.target.value = hex;
          }}
          className="h-10 w-32 rounded-lg border border-border bg-surface px-3 font-mono text-sm text-foreground uppercase transition-colors duration-150 hover:border-border-strong focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        />
        <span className="text-xs text-faint-foreground">Preset swatch or #RRGGBB</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-muted p-3">
        <span className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground shadow-sm">
          Primary
        </span>
        <span className="inline-flex h-9 items-center rounded-lg bg-brand-soft px-3 text-sm font-semibold text-brand">
          Soft badge
        </span>
        <span className="text-xs text-muted-foreground">
          Live preview · saved with Settings
        </span>
      </div>
    </div>
  );
}
