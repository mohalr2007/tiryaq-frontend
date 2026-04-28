import AdminPortalPage from "@/features/admin-page/AdminPortalPage";

export const dynamic = "force-dynamic";

export default async function AdminPageRoute() {
  return <AdminPortalPage initialUser={null} />;
}
