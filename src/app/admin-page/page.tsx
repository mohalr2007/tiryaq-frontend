import { getAdminPortalSession } from "@/utils/admin-portal/session";
import AdminPortalPage from "@/features/admin-page/AdminPortalPage";

export const dynamic = "force-dynamic";

export default async function AdminPageRoute() {
  const session = await getAdminPortalSession();

  return (
    <AdminPortalPage
      initialUser={
        session
          ? {
              id: session.adminUserId,
              username: session.username,
              fullName: session.fullName,
              role: session.role,
            }
          : null
      }
    />
  );
}
