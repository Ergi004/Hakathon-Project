import { Briefcase, IdCard, Landmark, Package, QrCode, Receipt, type LucideProps } from "lucide-react";
import type { Guide } from "@/content/learn";

const MAP = { receipt: Receipt, landmark: Landmark, briefcase: Briefcase, package: Package, "id-card": IdCard, qr: QrCode } as const;

export function GuideIcon({ icon, ...props }: { icon: Guide["icon"] } & LucideProps) {
  const Icon = MAP[icon];
  return <Icon aria-hidden="true" {...props} />;
}
