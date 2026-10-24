import type { ReactNode } from "react";
import { DataProvider } from "@/components/providers/DataProvider";
import { ServerStatusProvider } from "@/components/providers/ServerStatusProvider";
import { BrandSync } from "@/components/providers/BrandSync";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <ServerStatusProvider>
        <BrandSync />
        <AppShell>{children}</AppShell>
      </ServerStatusProvider>
    </DataProvider>
  );
}
