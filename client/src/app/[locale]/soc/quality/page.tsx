import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("soc.nav", "quality", { minRole: "soc_lead" });

export const generateMetadata = route.generateMetadata;
export default route.Page;
