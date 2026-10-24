"use client";

import { Globe } from "lucide-react";
import { Dropdown } from "@heroui/react";
import { useI18n } from "@/components/providers/I18nProvider";
import { LOCALES } from "@/lib/i18n/locales";
import { cn } from "@/lib/cn";

/**
 * Picks the language the admin reads in.
 *
 * Four languages are translated by hand; the rest are still offered, and
 * anything that arrives in them is translated into English as it is shown.
 * The tick marks the language in use.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t, info } = useI18n();

  const choose = (code: string) => {
    if (code === locale) return;
    setLocale(code);
  };

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={t("App language")}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-field bg-surface px-2 text-foreground shadow-field",
          className
        )}
      >
        <Globe className="size-4 flex-none text-muted" />
        <span className="hidden max-w-24 truncate text-xs font-semibold sm:inline">
          {info.nativeName}
        </span>
      </Dropdown.Trigger>

      <Dropdown.Popover placement="bottom end" className="min-w-64 max-h-80 overflow-y-auto">
        <Dropdown.Menu
          selectionMode="single"
          selectedKeys={[locale]}
          onAction={(key) => choose(String(key))}
        >
          {LOCALES.map((entry) => (
            <Dropdown.Item id={entry.code} key={entry.code} textValue={entry.englishName}>
              {/*
                A text tick rather than the built-in SVG indicator: React Aria
                builds menus in a collection document that cannot create SVG
                nodes, so anything drawn inside an item has to be plain text.
              */}
              <Dropdown.ItemIndicator className="w-4 flex-none text-xs">✓</Dropdown.ItemIndicator>
              <span className="flex-1 truncate">{entry.nativeName}</span>
              <span className="ms-3 flex-none text-xs text-muted">{entry.englishName}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
