import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface OtpEmailProps {
  siteName: string
  token: string
  /** Bilingual copy keyed for both English (primary) and Arabic (secondary). */
  headingEn: string
  headingAr: string
  introEn: string
  introAr: string
  /** Optional context line (e.g. masked email). */
  contextEn?: string
  contextAr?: string
  expiryMinutes?: number
}

/**
 * Shared bilingual (English + Arabic) 6-digit OTP email. Contains NO buttons,
 * NO magic links, and NO confirmation URLs — only a numeric code.
 */
export const OtpEmail = ({
  siteName,
  token,
  headingEn,
  headingAr,
  introEn,
  introAr,
  contextEn,
  contextAr,
  expiryMinutes = 10,
}: OtpEmailProps) => (
  <Html lang="en">
    <Head />
    <Preview>
      {headingEn} — {token}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>

        {/* English block */}
        <Section style={block}>
          <Heading style={h1}>{headingEn}</Heading>
          <Text style={text}>{introEn}</Text>
          {contextEn ? <Text style={muted}>{contextEn}</Text> : null}
        </Section>

        {/* The code itself — language-neutral */}
        <Section style={codeWrap}>
          <Text style={codeLabel}>Your verification code · رمز التحقق</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={muted}>
            Expires in {expiryMinutes} minutes · تنتهي خلال {expiryMinutes} دقيقة
          </Text>
        </Section>

        {/* Arabic block */}
        <Section style={{ ...block, direction: 'rtl' as const, textAlign: 'right' as const }}>
          <Heading style={h1}>{headingAr}</Heading>
          <Text style={text}>{introAr}</Text>
          {contextAr ? <Text style={muted}>{contextAr}</Text> : null}
        </Section>

        <Section style={block}>
          <Text style={footer}>
            If you didn&apos;t request this code, you can safely ignore this email.
          </Text>
          <Text style={{ ...footer, direction: 'rtl' as const, textAlign: 'right' as const }}>
            إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default OtpEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'IBM Plex Sans Arabic', Tahoma, Arial, sans-serif",
  padding: '24px 0',
}
const container = {
  maxWidth: '480px',
  margin: '0 auto',
  padding: '28px 28px 32px',
  border: '1px solid #ECECEC',
  borderRadius: '16px',
  backgroundColor: '#ffffff',
}
const brand = {
  fontSize: '14px',
  fontWeight: 700 as const,
  letterSpacing: '0.12em',
  color: '#B8862B',
  textTransform: 'uppercase' as const,
  margin: '0 0 18px',
}
const block = { margin: '0 0 18px' }
const h1 = {
  fontSize: '20px',
  fontWeight: 700 as const,
  color: '#0B0B0D',
  margin: '0 0 8px',
  lineHeight: 1.3,
}
const text = {
  fontSize: '14px',
  color: '#2A2A2E',
  lineHeight: 1.6,
  margin: '0 0 6px',
}
const muted = {
  fontSize: '12px',
  color: '#7A7A7E',
  lineHeight: 1.5,
  margin: '6px 0 0',
}
const codeWrap = {
  margin: '12px 0 22px',
  padding: '20px 16px',
  borderRadius: '12px',
  backgroundColor: '#FAF7EE',
  border: '1px solid #E9DDB4',
  textAlign: 'center' as const,
}
const codeLabel = {
  fontSize: '11px',
  fontWeight: 600 as const,
  letterSpacing: '0.18em',
  color: '#8A6A14',
  textTransform: 'uppercase' as const,
  margin: '0 0 8px',
}
const codeStyle = {
  fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
  fontSize: '34px',
  fontWeight: 700 as const,
  letterSpacing: '0.4em',
  color: '#0B0B0D',
  margin: '0',
}
const footer = {
  fontSize: '11px',
  color: '#9A9A9E',
  lineHeight: 1.5,
  margin: '6px 0 0',
}
