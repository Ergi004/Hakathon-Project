import { Building2 } from "lucide-react";
import { getInstitutionDirectory } from "@/server/queries/public";

export async function TrustStrip() {
  const list = await getInstitutionDirectory();
  if (!list.length) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {list.slice(0, 10).map((i) => (
        <li key={i.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground">
          <Building2 className="size-4" aria-hidden="true" />
          {i.name}
        </li>
      ))}
    </ul>
  );
}
