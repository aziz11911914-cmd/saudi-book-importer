import * as React from 'react'
import { render } from '@react-email/components'
import { parseEmailWebhookPayload } from '@lovable.dev/email-js'
import { WebhookError, verifyWebhookRequest } from '@lovable.dev/webhooks-js'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Bilingual subjects (English · Arabic). NO mention of links/buttons.
const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Your Qassah verification code · رمز التحقق الخاص بك',
  invite: "You're invited to Qassah · دعوتك للانضمام إلى قَصّة",
  magiclink: 'Your Qassah sign-in code · رمز تسجيل الدخول',
  recovery: 'Your Qassah access code · رمز الدخول إلى حسابك',
  email_change: 'Confirm your new email · تأكيد البريد الجديد',
  reauthentication: 'Confirm it\'s you · تأكيد هويتك',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const SITE_NAME = 'Qassah'
const SENDER_DOMAIN = 'notify.mail.taalemx.com'
const FROM_DOMAIN = 'notify.mail.taalemx.com'

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

export const Route = createFileRoute('/lovable/email/auth/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY
        if (!apiKey) {
          console.error('LOVABLE_API_KEY not configured')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let payload: any
        let run_id = ''
        try {
          const verified = await verifyWebhookRequest({
            req: request,
            secret: apiKey,
            parser: parseEmailWebhookPayload,
          })
          payload = verified.payload
          run_id = payload.run_id
        } catch (error) {
          if (error instanceof WebhookError) {
            switch (error.code) {
              case 'invalid_signature':
              case 'missing_timestamp':
              case 'invalid_timestamp':
              case 'stale_timestamp':
                return Response.json({ error: 'Invalid signature' }, { status: 401 })
              case 'invalid_payload':
              case 'invalid_json':
                return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
            }
          }
          console.error('Webhook verification failed', { error })
          return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
        }

        if (!run_id || payload.version !== '1') {
          return Response.json({ error: 'Invalid webhook payload' }, { status: 400 })
        }

        const emailType = payload.data.action_type
        console.log('Received auth event', {
          emailType,
          email_redacted: redactEmail(payload.data.email),
          run_id,
        })

        const EmailTemplate = EMAIL_TEMPLATES[emailType]
        if (!EmailTemplate) {
          console.error('Unknown email type', { emailType, run_id })
          return Response.json({ error: `Unknown email type: ${emailType}` }, { status: 400 })
        }

        const token = String(payload.data.token || '').trim()
        if (!/^\d{6}$/.test(token)) {
          console.error('Auth payload missing 6-digit OTP token', {
            emailType,
            run_id,
            tokenLength: token.length,
          })
          return Response.json({ error: 'Invalid OTP token in payload' }, { status: 400 })
        }

        const templateProps = {
          siteName: SITE_NAME,
          token,
          recipient: payload.data.email,
          oldEmail: payload.data.old_email,
          newEmail: payload.data.new_email,
        }

        const element = React.createElement(EmailTemplate, templateProps)
        const html = await render(element)
        const text = await render(element, { plainText: true })

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !supabaseServiceKey) {
          console.error('Missing Supabase environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const messageId = crypto.randomUUID()

        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: emailType,
          recipient_email: payload.data.email,
          status: 'pending',
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'auth_emails',
          payload: {
            run_id,
            message_id: messageId,
            to: payload.data.email,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: EMAIL_SUBJECTS[emailType] || 'Your verification code · رمز التحقق',
            html,
            text,
            purpose: 'transactional',
            label: emailType,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          console.error('Failed to enqueue auth email', { error: enqueueError, run_id, emailType })
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: emailType,
            recipient_email: payload.data.email,
            status: 'failed',
            error_message: 'Failed to enqueue email',
          })
          return Response.json({ error: 'Failed to enqueue email' }, { status: 500 })
        }

        console.log('Auth OTP email enqueued', {
          emailType,
          email_redacted: redactEmail(payload.data.email),
          run_id,
        })

        return Response.json({ success: true, queued: true })
      },
    },
  },
})
