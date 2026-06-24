import * as React from 'react'
import { OtpEmail } from './_otp-email'

interface Props {
  siteName: string
  token: string
  oldEmail?: string
  newEmail?: string
}

export const EmailChangeEmail = ({ siteName, token, oldEmail, newEmail }: Props) => {
  const ctxEn =
    oldEmail && newEmail ? `Change from ${oldEmail} to ${newEmail}.` : undefined
  const ctxAr =
    oldEmail && newEmail ? `تغيير من ${oldEmail} إلى ${newEmail}.` : undefined
  return (
    <OtpEmail
      siteName={siteName}
      token={token}
      headingEn="Confirm your new email"
      headingAr="تأكيد البريد الإلكتروني الجديد"
      introEn={`Use this 6-digit code to confirm your new email address for ${siteName}.`}
      introAr={`استخدم هذا الرمز المكوّن من 6 أرقام لتأكيد بريدك الإلكتروني الجديد في ${siteName}.`}
      contextEn={ctxEn}
      contextAr={ctxAr}
    />
  )
}

export default EmailChangeEmail
