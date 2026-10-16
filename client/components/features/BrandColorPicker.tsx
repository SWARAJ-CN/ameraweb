"use client";

import { Pipette } from "lucide-react";
import {
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatchPicker,
  type ColorValue,
} from "@heroui/react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { isValidHex, normalizePrimaryColor, PRESET_COLORS } from "@/lib/brand";

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
  const applyColor = (color: ColorValue) => onChange(normalizePrimaryColor(color.toString("hex")));

  return (
    <div className="flex flex-col gap-3">
      <ColorSwatchPicker
        aria-label="Preset colours"
        className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-12"
        layout="grid"
        value={hex}
        onChange={applyColor}
      >
        {PRESET_COLORS.map((color) => (
          <ColorSwatchPicker.Item
            key={color}
            aria-label={`Use ${color}`}
            color={color}
          >
            <ColorSwatchPicker.Swatch />
            <ColorSwatchPicker.Indicator />
          </ColorSwatchPicker.Item>
        ))}
      </ColorSwatchPicker>

      <div className="flex flex-wrap items-center gap-2">
        <ColorPicker value={hex} onChange={applyColor}>
          <ColorPicker.Trigger
            aria-label="Pick a custom colour"
            className="group relative grid size-10 flex-none place-items-center rounded-lg border border-border-strong bg-surface p-0"
          >
            <span
              className="size-6 rounded-md shadow-sm"
              style={{ backgroundColor: hex }}
            />
            {/* Hover/focus affordance: the pipette floats above the swatch so the
                trigger keeps its square shape instead of stacking two rows. */}
            <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-[inherit] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              <span className="grid size-5 place-items-center rounded-full border border-border-strong bg-background/90 text-foreground shadow-sm">
                <Pipette className="size-3" />
              </span>
            </span>
          </ColorPicker.Trigger>
          <ColorPicker.Popover className="flex w-auto flex-col gap-2.5">
            {/* The area and the hue slider share a row so the popover stays short
                enough to fit above the fold (the hex field used to be clipped). */}
            <div className="flex items-stretch gap-3">
              <ColorArea
                aria-label="Saturation and brightness"
                className="w-44"
                colorSpace="hsb"
                xChannel="saturation"
                yChannel="brightness"
              >
                <ColorArea.Thumb />
              </ColorArea>
              <ColorSlider
                aria-label="Hue"
                channel="hue"
                colorSpace="hsb"
                orientation="vertical"
                className="h-44"
              >
                <ColorSlider.Track>
                  <ColorSlider.Thumb />
                </ColorSlider.Track>
              </ColorSlider>
            </div>
            <ColorField aria-label="Primary colour hex value" className="w-full">
              <Input className="h-9 font-mono text-xs uppercase" />
            </ColorField>
          </ColorPicker.Popover>
        </ColorPicker>

        <Input
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
          className="h-10 w-32 font-mono text-sm uppercase"
        />
        <span className="text-xs text-faint-foreground">Preset swatch or #RRGGBB</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-muted p-3">
        <span className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground shadow-sm">
          Primary
        </span>
        <span
          className={cn(
            "inline-flex h-9 items-center rounded-lg bg-accent-soft px-3 text-sm font-semibold",
            "text-accent-soft-foreground"
          )}
        >
          Soft badge
        </span>
        <span className="text-xs text-muted-foreground">
          Live preview · saved with Settings
        </span>
      </div>
    </div>
  );
}
