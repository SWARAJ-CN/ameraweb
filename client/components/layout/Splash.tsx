"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Spinner } from "@/components/ui/Feedback";

export function Splash({ label = "Preparing your workspace…" }: { label?: string }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="grid min-h-svh place-items-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Image
          src="/logo.jpeg"
          alt="Amare Handmades"
          width={64}
          height={64}
          priority
          className="size-16 rounded-2xl object-cover ring-1 ring-border"
        />
        <div>
          <p className="text-base font-bold text-foreground">Amare Handmades</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
        </div>
        <Spinner className="text-brand" />
        {slow ? (
          <p className="max-w-xs text-xs leading-relaxed text-faint-foreground">
            The server sleeps when idle, so the very first request can take up to a
            minute. Thanks for waiting.
          </p>
        ) : null}
      </div>
    </div>
  );
}
