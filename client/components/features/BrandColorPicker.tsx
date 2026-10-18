"use client";

import { ColorArea, ColorSlider, ColorSwatchPicker, type ColorValue } from "@heroui/react";
import { ColorThumb, ColorWheel, ColorWheelTrack } from "react-aria-components";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { isValidHex, normalizePrimaryColor, PRESET_COLORS } from "@/lib/brand";

/** Radius of the hue wheel, in pixels. Matches the 11rem box it sits in. */
const WHEEL_RADIUS = 88;

interface BrandColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

/**
 * Preset palette plus a custom picker for the shop's primary colour: a hue
 * wheel, a saturation/brightness square and a hue bar, with the hex field
 * alongside.
 *
 * The custom controls are always on screen rather than tucked behind the
 * swatch trigger — the wheel is the point of the control, so it should be
 * visible without a discovery click. The preview strip uses the live `brand`
 * tokens, so it always mirrors the rest of the app.
 */
export function BrandColorPicker({ value, onChange }: BrandColorPickerProps) {
  const hex = normalizePrimaryColor(value);
  const applyColor = (color: ColorValue) =>
    onChange(normalizePrimaryColor(color.toString("hex")));

  return (
    <div className="flex flex-col gap-4">
      <ColorSwatchPicker
        aria-label="Preset colours"
        className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-12"
        layout="grid"
        value={hex}
        onChange={applyColor}
      >
        {PRESET_COLORS.map((color) => (
          <ColorSwatchPicker.Item key={color} aria-label={`Use ${color}`} color={color}>
            <ColorSwatchPicker.Swatch />
            <ColorSwatchPicker.Indicator />
          </ColorSwatchPicker.Item>
        ))}
      </ColorSwatchPicker>

      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-border bg-surface-inset p-3">
        <ColorWheel
          aria-label="Hue wheel"
          className="size-44 flex-none"
          value={hex}
          onChange={applyColor}
          outerRadius={WHEEL_RADIUS}
          innerRadius={56}
        >
          <ColorWheelTrack className="rounded-full" />
          <ColorThumb className="size-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]" />
        </ColorWheel>

        <ColorArea
          aria-label="Saturation and brightness"
          className="w-44 flex-none"
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
          value={hex}
          onChange={applyColor}
        >
          <ColorArea.Thumb />
        </ColorArea>

        <div className="flex min-w-40 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Hue</span>
            <ColorSlider
              aria-label="Hue"
              channel="hue"
              colorSpace="hsb"
              className="w-full"
              value={hex}
              onChange={applyColor}
            >
              <ColorSlider.Track>
                <ColorSlider.Thumb />
              </ColorSlider.Track>
            </ColorSlider>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Hex</span>
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
          </div>

          <span className="text-xs text-faint-foreground">
            Turn the wheel for hue, drag the square for shade, or type #RRGGBB.
          </span>
        </div>
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
