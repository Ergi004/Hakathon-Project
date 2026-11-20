import { CircleHelp, OctagonX, ShieldAlert, ShieldCheck, TriangleAlert, CircleAlert, type LucideProps } from "lucide-react";
import type { FlagLevel } from "@/lib/flags";

const ICONS = {
  green: ShieldCheck,
  yellow: CircleAlert,
  orange: TriangleAlert,
  red: ShieldAlert,
  darkred: OctagonX,
  grey: CircleHelp,
} as const;

export function FlagIcon({ flag, ...props }: { flag: FlagLevel } & LucideProps) {
  const Icon = ICONS[flag];
  return <Icon aria-hidden="true" {...props} />;
}
