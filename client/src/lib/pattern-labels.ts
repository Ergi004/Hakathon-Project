import type { BrandCategory, ScamType } from "@/server/detection/pattern";

export function asScamType(value: string | null | undefined): ScamType | null {
  switch (value) {
    case "fake_institution_login":
    case "parcel_postal_fee":
    case "fine_or_tax_refund":
    case "fake_bank":
    case "fake_app":
    case "other":
      return value;
    default:
      return null;
  }
}

export function asBrandCategory(value: string | null | undefined): BrandCategory | null {
  switch (value) {
    case "e_albania":
    case "tax":
    case "postal":
    case "municipality":
    case "bank":
    case "police":
    case "utility":
    case "telecom":
    case "other":
      return value;
    default:
      return null;
  }
}
