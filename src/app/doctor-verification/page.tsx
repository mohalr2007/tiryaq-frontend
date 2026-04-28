import DoctorVerificationPage from "@/features/doctor-verification/DoctorVerificationPage";
import { requireDoctorVerificationAccess } from "@/utils/serverAccessGuards";

export default async function DoctorVerificationRoute() {
  await requireDoctorVerificationAccess();
  return <DoctorVerificationPage />;
}
