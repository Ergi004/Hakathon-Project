import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("business.nav", "overview");

export const generateMetadata = route.generateMetadata;
export default route.Page;
