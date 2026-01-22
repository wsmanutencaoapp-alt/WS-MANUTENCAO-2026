'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const apiKey = process.env.RESEND_API_KEY; // Explicitly read the API key

  // More specific check
  if (!fromEmail || !apiKey) {
    let missing = [];
    if (!fromEmail) missing.push("RESEND_FROM_EMAIL");
    if (!apiKey) missing.push("RESEND_API_KEY");
    
    return NextResponse.json({ 
        error: 'Server Configuration Error', 
        message: `Email settings are incomplete. The following environment variables are missing: ${missing.join(', ')}` 
    }, { status: 500 });
  }

  try {
    // Explicitly pass the API key to the constructor.
    const resend = new Resend(apiKey);

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
            message: `[${error.name}] ${error.message}` 
        }, { status: 422 });
    }

    return NextResponse.json(data);
  } catch (exception) {
      console.error('[Email Route] Exception during Resend call:', exception);
      
      let errorMessage = 'An unknown exception occurred during the email sending process.';
      if (exception instanceof Error) {
          errorMessage = exception.message;
      }
      
      return NextResponse.json({ 
          error: 'Email Service Exception', 
          message: errorMessage
      }, { status: 500 });
  }
}
