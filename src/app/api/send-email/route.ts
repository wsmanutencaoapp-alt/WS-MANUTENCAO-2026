'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    const missing = [];
    if (!apiKey) missing.push('RESEND_API_KEY');
    if (!fromEmail) missing.push('RESEND_FROM_EMAIL');
    
    return NextResponse.json({ 
        error: 'Server Configuration Error', 
        message: `Server configuration is incomplete. The following environment variables are missing: ${missing.join(', ')}` 
    }, { status: 500 });
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: html,
    });

    if (error) {
        console.error('[Email Route] Resend API returned an error:', JSON.stringify(error, null, 2));
        return NextResponse.json({ 
            error: 'Resend API Error', 
            message: error.message 
        }, { status: 422 });
    }

    return NextResponse.json(data);
  } catch (exception) {
      console.error('[Email Route] Exception during Resend call:', exception);
      if (exception instanceof Error) {
          return NextResponse.json({ 
              error: 'Email Service Exception', 
              message: exception.message 
          }, { status: 500 });
      }
      return NextResponse.json({ 
          error: 'Email Service Exception', 
          message: 'An unknown exception occurred during the email sending process.' 
      }, { status: 500 });
  }
}
