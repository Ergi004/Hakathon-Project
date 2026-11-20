import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("business.nav", "api", { orgRoles: ["owner", "admin"] });

export const generateMetadata = route.generateMetadata;
export default route.Page;
