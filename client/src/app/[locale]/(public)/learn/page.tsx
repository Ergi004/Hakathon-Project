import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("public.nav", "learn");

export const generateMetadata = route.generateMetadata;
export default route.Page;
