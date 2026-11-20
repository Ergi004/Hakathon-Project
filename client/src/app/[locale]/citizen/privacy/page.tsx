import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("citizen.nav", "privacy");

export const generateMetadata = route.generateMetadata;
export default route.Page;
