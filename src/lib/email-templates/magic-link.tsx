import * as React from 'react'
import { OtpEmail } from './_otp-email'

interface Props {
  siteName: string
  token: string
  recipient?: string
  expiryMinutes?: number
}

export const MagicLinkEmail = ({ siteName, token, expiryMinutes }: Props) => (
  <OtpEmail
    siteName={siteName}
    token={token}
    expiryMinutes={expiryMinutes}
    headingEn="Your sign-in code"
    headingAr="رمز تسجيل الدخول"
    introEn={`Enter this 6-digit code in ${siteName} to sign in.`}
    introAr={`أدخل هذا الرمز المكوّن من 6 أرقام في ${siteName} لتسجيل الدخول.`}
  />
)

export default MagicLinkEmail
