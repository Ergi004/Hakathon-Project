"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// next-themes injects an inline <script> to set the theme before paint. On the
// server it must stay executable; on the client React 19 warns about any
// executable <script> it renders, so we mark it as inert there. The script
// already ran from the SSR HTML, and next-themes sets suppressHydrationWarning.
const scriptProps = { type: typeof window === "undefined" ? "text/javascript" : "text/plain" } as const;

export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider scriptProps={scriptProps} {...props} />;
}
