"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Toast, toast as heroToast } from "@heroui/react";

type Variant = "success" | "error" | "info" | "warning";

interface ToastInput {
  title: string;
  description?: string;
  variant?: Variant;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT: Record<Variant, "accent" | "success" | "warning" | "danger"> = {
  success: "success",
  error: "danger",
  info: "accent",
  warning: "warning",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ToastContextValue>(() => {
    const show = ({ title, description, variant = "info" }: ToastInput) => {
      heroToast(title, { description, variant: VARIANT[variant] });
    };
    return {
      toast: show,
      success: (title, description) => show({ title, description, variant: "success" }),
      error: (title, description) => show({ title, description, variant: "error" }),
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider placement="bottom end" />
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
