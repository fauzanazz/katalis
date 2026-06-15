import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Light-only Toaster for TanStack Start. Same visual config as the Next
 * `ui/sonner.tsx` but without the `next-themes` dependency — the app is
 * light-mode only (dark modifiers are banned), so the theme is hardcoded.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--card)",
          "--success-text": "var(--card-foreground)",
          "--success-border": "var(--green-leaf-deep)",
          "--error-bg": "var(--card)",
          "--error-text": "var(--destructive)",
          "--error-border": "var(--destructive)",
          "--warning-bg": "var(--card)",
          "--warning-text": "var(--card-foreground)",
          "--warning-border": "var(--yellow-sun)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
