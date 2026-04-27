import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * "/" → ถ้า login → /dashboard, ถ้าไม่ login → /login
 */
export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.must_change_password ? "/change-password" : "/dashboard");
  }
  redirect("/login");
}
