"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMusicPlayer } from "@/components/providers/MusicPlayerProvider";
import { titleForPath } from "./nav-config";
import { Sidebar } from "./Sidebar";
import { Splash } from "./Splash";
import { StickyPlayerBar } from "@/components/features/music/StickyPlayerBar";
import { Topbar } from "./Topbar";
import { cn } from "@/lib/cn";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, user } = useAuth();
  const { current: nowPlaying } = useMusicPlayer();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [drawerOpen]);

  if (!ready || !user) return <Splash />;

  const current = titleForPath(pathname);

  return (
    <div className="min-h-svh bg-background">
      <Sidebar className="fixed inset-y-0 start-0 z-40 hidden w-[var(--sidebar-width)] lg:flex" />

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="animate-fade absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
          />
          <div className="animate-slide-start absolute inset-y-0 start-0 w-[min(17rem,86vw)] shadow-pop">
            <Sidebar className="w-full" onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-svh flex-col lg:ps-[var(--sidebar-width)]">
        <Topbar
          title={current?.label ?? "Amare Handmades"}
          description={current?.description}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div
            key={pathname}
            className={cn(
              "animate-rise mx-auto flex w-full max-w-[100rem] flex-col gap-5",
              nowPlaying && "pb-32"
            )}
          >
            {children}
          </div>
        </main>
        <footer className="border-t border-separator px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-[11px] text-faint-foreground">
            Amare Handmades admin · data served by amera-backend.onrender.com
          </p>
        </footer>
      </div>
      {/* Persistent listening bar — survives tab switches and background play. */}
      <StickyPlayerBar />
    </div>
  );
}
