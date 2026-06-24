import * as React from 'react'
import { OtpEmail } from './_otp-email'

interface Props {
  siteName: string
  token: string
}

export const InviteEmail = ({ siteName, token }: Props) => (
  <OtpEmail
    siteName={siteName}
    token={token}
    headingEn={`You're invited to ${siteName}`}
    headingAr={`تمت دعوتك إلى ${siteName}`}
    introEn={`Use this 6-digit code to accept the invitation and join ${siteName}.`}
    introAr={`استخدم هذا الرمز المكوّن من 6 أرقام لقبول الدعوة والانضمام إلى ${siteName}.`}
  />
)

export default InviteEmail
