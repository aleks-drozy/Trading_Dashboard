import dbConnect from "@/lib/db"
import PasswordReset from "@/lib/models/PasswordReset"
import { Card } from "@/components/ui/Card"
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm"

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await props.searchParams

  let isValidToken = false
  if (token) {
    await dbConnect()
    const record = await PasswordReset.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    })
    isValidToken = !!record
  }

  return (
    <Card>
      <ResetPasswordForm token={token || ""} initialState={isValidToken ? "form" : "invalid"} />
    </Card>
  )
}
