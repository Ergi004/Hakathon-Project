import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("citizen.nav", "watchlist");

export const generateMetadata = route.generateMetadata;
export default route.Page;
