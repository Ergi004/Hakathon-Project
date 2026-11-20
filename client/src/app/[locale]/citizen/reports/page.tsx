import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("citizen.nav", "reports");

export const generateMetadata = route.generateMetadata;
export default route.Page;
