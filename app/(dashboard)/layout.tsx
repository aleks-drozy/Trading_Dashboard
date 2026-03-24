import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex min-h-screen bg-[#020617]">
      <Sidebar user={session.user ?? { name: null, email: null, image: null }} />
      <main className="flex-1 overflow-auto p-8 bg-[#020617]">{children}</main>
    </div>
  )
}
