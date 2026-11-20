import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("business.nav", "training", { orgRoles: ["owner", "admin", "security"] });

export const generateMetadata = route.generateMetadata;
export default route.Page;
