import * as React from 'react'
import { OtpEmail } from './_otp-email'

interface Props {
  siteName: string
  token: string
}

export const ReauthenticationEmail = ({ siteName, token }: Props) => (
  <OtpEmail
    siteName={siteName}
    token={token}
    headingEn="Confirm it's you"
    headingAr="تأكيد هويتك"
    introEn={`Use this 6-digit code to confirm your identity on ${siteName}.`}
    introAr={`استخدم هذا الرمز المكوّن من 6 أرقام لتأكيد هويتك في ${siteName}.`}
  />
)

export default ReauthenticationEmail
