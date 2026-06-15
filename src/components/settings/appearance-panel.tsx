"use client";

import { Check, Sun, Moon } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Appearance panel — color-theme and light/dark mode picker.
 *
 * Click a card → applies + persists immediately. No save button:
 * changes are applied as class swaps on <html> and data-theme attributes,
 * persisting to localStorage.
 */
export function AppearancePanel() {
  const { theme, setTheme, mode, setMode } = useTheme();

  return (
    <section className="space-y-8">
      {/* Theme Mode Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Theme mode</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch between light and dark modes to suit your preference.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-xl">
          <button
            type="button"
            onClick={() => setMode("light")}
            aria-pressed={mode === "light"}
            aria-label="Use Light Mode"
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors cursor-pointer",
              mode === "light"
                ? "border-primary/60 ring-2 ring-primary/40"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/40",
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Light Mode</div>
              <div className="text-xs text-muted-foreground">Clean, bright, and legible</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("dark")}
            aria-pressed={mode === "dark"}
            aria-label="Use Dark Mode"
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors cursor-pointer",
              mode === "dark"
                ? "border-primary/60 ring-2 ring-primary/40"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/40",
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Dark Mode</div>
              <div className="text-xs text-muted-foreground">Easy on the eyes in low light</div>
            </div>
          </button>
        </div>
      </div>

      {/* Accent Color Theme Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Color theme</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the accent color used across the app (buttons, active navigation, badges, and highlights).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              id={t.id}
              name={t.name}
              tagline={t.tagline}
              swatch={t.swatch}
              isActive={t.id === theme}
              onPick={() => setTheme(t.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ThemeCard({
  id,
  name,
  tagline,
  swatch,
  isActive,
  onPick,
}: {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: string;
  isActive: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={isActive}
      aria-label={`Use ${name} theme`}
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors cursor-pointer",
        isActive
          ? "border-primary/60 ring-2 ring-primary/40"
          : "border-border hover:border-muted-foreground/30 hover:bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span
          aria-hidden
          className="h-8 w-8 shrink-0 rounded-full"
          style={{
            background: swatch,
            boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.15)",
          }}
        />
        {isActive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Check className="h-3 w-3" />
            Active
          </span>
        )}
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground">{name}</div>
        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {tagline}
        </div>
      </div>
      <div
        className="mt-1 flex h-2 overflow-hidden rounded-full w-full bg-muted"
        aria-hidden
      >
        <span className="flex-1" style={{ background: swatch }} />
        <span className="w-3 bg-muted-foreground/20" />
        <span className="w-3 bg-muted-foreground/10" />
        <span className="w-3 bg-muted-foreground/5" />
      </div>
      <span className="sr-only">Theme id: {id}</span>
    </button>
  );
}
