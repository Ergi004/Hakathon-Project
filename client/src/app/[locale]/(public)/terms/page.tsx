import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("public.nav", "terms");

export const generateMetadata = route.generateMetadata;
export default route.Page;
