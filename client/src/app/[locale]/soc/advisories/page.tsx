import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("soc.nav", "advisories");

export const generateMetadata = route.generateMetadata;
export default route.Page;
