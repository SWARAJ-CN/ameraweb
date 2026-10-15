"use client";

import { useEffect } from "react";
import { useData } from "@/components/providers/DataProvider";
import { applyBrand } from "@/lib/brand";

/**
 * Keeps the web theme's brand colour in step with the shop's saved
 * `primaryColor`. Rendered once inside the app shell.
 */
export function BrandSync() {
  const { settings } = useData();

  useEffect(() => {
    applyBrand(settings.primaryColor);
  }, [settings.primaryColor]);

  return null;
}
