import { getAdminSession } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const admin = await getAdminSession();
  if (!admin) {
    redirect({ href: "/dashboard", locale });
  }

  return <>{children}</>;
}
