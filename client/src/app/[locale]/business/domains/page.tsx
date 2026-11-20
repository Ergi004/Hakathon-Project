import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("business.nav", "domains", { orgRoles: ["owner", "admin", "security"] });

export const generateMetadata = route.generateMetadata;
export default route.Page;
