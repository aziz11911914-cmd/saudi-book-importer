import * as React from 'react'
import { OtpEmail } from './_otp-email'

interface Props {
  siteName: string
  token: string
}

export const RecoveryEmail = ({ siteName, token }: Props) => (
  <OtpEmail
    siteName={siteName}
    token={token}
    headingEn="Account access code"
    headingAr="رمز الدخول إلى الحساب"
    introEn={`Use this 6-digit code to regain access to your ${siteName} account.`}
    introAr={`استخدم هذا الرمز المكوّن من 6 أرقام لاستعادة الوصول إلى حسابك في ${siteName}.`}
  />
)

export default RecoveryEmail
