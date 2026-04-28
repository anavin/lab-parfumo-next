import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "./_components/header";
import { KeyboardShortcuts } from "./_components/keyboard-shortcuts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.must_change_password) {
    redirect("/change-password");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background">
      <AppHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-in">
        {children}
      </main>
      <Toaster />
      <KeyboardShortcuts />
    </div>
  );
}
