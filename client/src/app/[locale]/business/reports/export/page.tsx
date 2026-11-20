import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("business.nav", "export", { orgRoles: ["owner", "admin", "finance"] });

export const generateMetadata = route.generateMetadata;
export default route.Page;
