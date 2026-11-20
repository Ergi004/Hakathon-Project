import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("soc.nav", "alerts", { minRole: "soc_lead" });

export const generateMetadata = route.generateMetadata;
export default route.Page;
