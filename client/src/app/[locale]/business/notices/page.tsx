import { placeholderRoute } from "@/components/layout/placeholder-route";

const route = placeholderRoute("business.nav", "notices", { orgRoles: ["owner", "admin", "comms"] });

export const generateMetadata = route.generateMetadata;
export default route.Page;
