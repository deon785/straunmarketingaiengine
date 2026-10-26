// If using standard Vite/React on Vercel, use this format:
import { Resend } from 'resend';
import { Webhook } from 'standardwebhooks';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Verify the request is from Supabase
    const payload = JSON.stringify(req.body); // Vercel parses body automatically
    const headers = req.headers;
    const secret = process.env.SUPABASE_HOOK_SECRET.replace('v1,whsec_', '');
    const wh = new Webhook(secret);
    
    // Note: For standard Vercel functions, you might need raw body parsing. 
    // If it fails, check the Vercel docs on "Raw Body Parser".
    const { user, email_data } = wh.verify(payload, headers);

    // 2. Get the OTP
    const otp = email_data.token;

    // 3. Send the email via Resend
    await resend.emails.send({
      from: 'onboarding@resend.dev', // Free tier sender (you can change later)
      to: user.email,
      subject: 'Your Verification Code',
      html: `
        <h2>Your Verification Code</h2>
        <p>Enter this code to continue:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>If you didn't request this, you can ignore this email.</p>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Hook error:', err);
    return res.status(401).json({ error: 'Invalid signature or request failed' });
  }
}