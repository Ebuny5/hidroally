import { maySendWelcome } from "./eligibility.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getRequestUser } from "../_shared/requireUser.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(RESEND_API_KEY);

const FROM_EMAIL = Deno.env.get("WELCOME_EMAIL_FROM") || "HidroAlly <team@hidroally.space>";

const WELCOME_EMAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to HidroAlly</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header Banner -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 30px 20px; color: #ffffff;">
              <h1 style="margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 0.5px;">HidroAlly</h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Empowering Hyperhidrosis Warriors</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 30px; color: #334155;">
              <h2 style="margin-top: 0; font-size: 22px; color: #1e293b; font-weight: 700;">Welcome to the Inner Circle!</h2>
              <p style="line-height: 1.6; font-size: 15px;">Hi there,</p>
              <p style="line-height: 1.6; font-size: 15px;">Your email is confirmed! You are now officially part of an exclusive community helping us refine the world’s first AIoT ecosystem designed to restore bodily dignity, comfort, and productivity to hyperhidrosis warriors.</p>

              <!-- Giftovate Vision Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3e8ff; border-left: 4px solid #7c3aed; border-radius: 4px; margin: 28px 0;">
                <tr>
                  <td style="padding: 20px; color: #581c87; font-size: 14px; line-height: 1.6;">
                    <strong>The Giftovate Vision:</strong> HidroAlly is more than an app—it is an end-to-end medical ecosystem combining software AI, hardware wearables, and physical Oasis micro-relief stations designed to permanently solve the hyperhidrosis care gap in Africa and beyond.
                  </td>
                </tr>
              </table>

              <h3 style="font-size: 18px; color: #1e293b; margin-top: 30px; margin-bottom: 16px; font-weight: 700;">What you can do right now in your dashboard:</h3>

              <ul style="padding-left: 20px; margin: 0; line-height: 1.8; font-size: 15px; color: #334155;">
                <li style="margin-bottom: 10px;"><strong>Precision Logging:</strong> Track episodes, triggers, and HDSS severity scores with dynamic longitudinal analysis.</li>
                <li style="margin-bottom: 10px;"><strong>HidroAlly Companion:</strong> Access 24/7 personalized clinical insights, verbatim trigger reflection, and context-matched relief strategies.</li>
                <li style="margin-bottom: 10px;"><strong>Analytics:</strong> View trend overviews, top triggers, and most affected anatomical zones.</li>
                <li style="margin-bottom: 10px;"><strong>Clinical Intelligence:</strong> Generate structured clinical telemetry reports to map your exact physiological patterns.</li>
                <li style="margin-bottom: 10px;"><strong>Climate & Solar Alerts:</strong> Calibrate your personal Heat Index and UV alert thresholds in the Climate Alert Centre and receive instant notifications when a risk threshold is detected.</li>
                <li style="margin-bottom: 10px;"><strong>Specialist Radar:</strong> Locate certified dermatologists near you and share your clinical report to seamlessly initiate your professional care path.</li>
                <li style="margin-bottom: 10px;"><strong>Wearable Sensor Simulator:</strong> Test simulated Electrodermal Activity (EDA) and heart rate responses to understand your autonomic patterns.</li>
              </ul>

              <!-- CTA Button -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin: 36px 0 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #7c3aed;">
                    <a href="https://app.hidroally.space" target="_blank" style="font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; padding: 14px 28px; display: inline-block; border-radius: 6px;">Launch My HidroAlly Dashboard</a>
                  </td>
                </tr>
              </table>

              <p style="line-height: 1.6; font-size: 13px; color: #64748b; margin-bottom: 0;">Need assistance? Our clinical assistant and support team are available anytime inside your app or at <a href="mailto:support@hidroally.space" style="color: #7c3aed; text-decoration: none;">support@hidroally.space</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

serve(async (req) => {
  const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const hookSecret = Deno.env.get('WELCOME_EMAIL_HOOK_SECRET');
  const isHook = !!hookSecret && req.headers.get('x-hook-secret') === hookSecret;
  const caller = isHook ? null : await getRequestUser(req);
  if (!isHook && !caller) return json({ error: 'Unauthorized' }, 401);
  try {
    const payload = await req.json();
    const userId = isHook ? payload?.record?.id : caller?.id;
    if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Invalid account' }, 400);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key || !RESEND_API_KEY) return json({ error: 'Email service is unavailable' }, 503);
    const admin = createClient(url, key);
    const { data: account, error: accountError } = await admin.auth.admin.getUserById(userId);
    if (accountError || !account.user?.email) return json({ error: 'Account not found' }, 404);
    const { data: delivery, error: readError } = await admin.from('welcome_email_deliveries').select('status').eq('user_id', userId).maybeSingle();
    if (readError) return json({ error: 'Unable to check welcome delivery' }, 503);
    if (!maySendWelcome(!!account.user.email_confirmed_at, delivery?.status)) return json({ success: true, skipped: true });
    // Atomic claim prevents concurrent OAuth callbacks, verification tabs, and retries from sending twice.
    const { data: claim, error: claimError } = await admin.from('welcome_email_deliveries').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('user_id', userId).eq('status', 'pending').select('user_id').maybeSingle();
    if (claimError) return json({ error: 'Unable to reserve welcome delivery' }, 503);
    if (!claim) return json({ success: true, skipped: true });
    const { error } = await resend.emails.send({ from: FROM_EMAIL, to: [account.user.email], subject: 'Welcome to HidroAlly', html: WELCOME_EMAIL_HTML }, { idempotencyKey: `welcome/${userId}` });
    if (error) {
      await admin.from('welcome_email_deliveries').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('user_id', userId).eq('status', 'sending');
      return json({ error: 'Welcome delivery failed' }, 502);
    }
    const { error: saveError } = await admin.from('welcome_email_deliveries').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId).eq('status', 'sending');
    if (saveError) return json({ error: 'Unable to finalize welcome delivery' }, 503);
    return json({ success: true });
  } catch {
    // An ambiguous provider/network failure leaves the claim locked rather than risk sending a duplicate.
    return json({ error: 'Unable to process welcome delivery' }, 500);
  }
});
