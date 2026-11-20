import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("citizen.nav", "home");

export const generateMetadata = route.generateMetadata;
export default route.Page;
