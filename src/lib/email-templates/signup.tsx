import * as React from 'react'
import { OtpEmail } from './_otp-email'

interface Props {
  siteName: string
  token: string
  recipient?: string
  expiryMinutes?: number
}

export const SignupEmail = ({ siteName, token, recipient, expiryMinutes }: Props) => (
  <OtpEmail
    siteName={siteName}
    token={token}
    expiryMinutes={expiryMinutes}
    headingEn="Confirm your email"
    headingAr="تأكيد بريدك الإلكتروني"
    introEn={`Use the 6-digit code below to finish creating your ${siteName} account.`}
    introAr={`استخدم الرمز المكوّن من 6 أرقام أدناه لإكمال إنشاء حسابك في ${siteName}.`}
    contextEn={recipient ? `For ${recipient}` : undefined}
    contextAr={recipient ? `للبريد ${recipient}` : undefined}
  />
)

export default SignupEmail
