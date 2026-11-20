import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("soc.nav", "takedowns");

export const generateMetadata = route.generateMetadata;
export default route.Page;
