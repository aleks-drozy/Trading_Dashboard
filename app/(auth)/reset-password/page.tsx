import { Card } from "@/components/ui/Card"
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm"

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await props.searchParams

  return (
    <Card>
      <ResetPasswordForm token={token || ""} />
    </Card>
  )
}
