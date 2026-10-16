import type { DevRun } from "@/lib/dev-types";

/** The developer's WhatsApp number in international format (India +91). */
export const WHATSAPP_NUMBER = "918590053568";

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export interface StagedChange {
  path: string;
  content: string;
  original: string;
  deleted: boolean;
}

export interface DevActivity {
  id: string;
  kind: "save" | "push" | "merge" | "branch" | "pull";
  title: string;
  detail: string;
  url?: string;
  at: string;
}

export function activityId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function runTone(run: DevRun): "success" | "danger" | "warning" | "neutral" {
  if (run.status !== "completed") return "warning";
  if (run.conclusion === "success") return "success";
  if (run.conclusion === null) return "neutral";
  if (run.conclusion === "neutral" || run.conclusion === "skipped") return "neutral";
  return "danger";
}

export function runLabel(run: DevRun): string {
  if (run.status !== "completed") return run.status === "in_progress" ? "running" : run.status;
  return run.conclusion ?? "unknown";
}

export function commitMessage(input: {
  files: number;
  path?: string;
  prefix?: string;
}): string {
  const base =
    input.files === 1 && input.path
      ? `Update ${input.path}`
      : `Update ${input.files} files`;
  return `${input.prefix ?? ""}${base} (developer mode)`.trim();
}

/** Builds the WhatsApp notification body for a completed push. */
export function pushMessage(input: {
  repo: string;
  branch: string;
  shortSha: string;
  message: string;
  files: number;
  url: string;
  actor: string;
}): string {
  return [
    "Amare Handmades — Developer Mode",
    "Push completed ✅",
    "",
    `Repo: ${input.repo}`,
    `Branch: ${input.branch}`,
    `Commit: ${input.shortSha}`,
    `Message: ${input.message}`,
    `Files: ${input.files}`,
    `By: ${input.actor}`,
    `Time: ${new Date().toLocaleString("en-IN")}`,
    input.url,
  ].join("\n");
}
