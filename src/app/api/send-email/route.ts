'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  const fromEmail = process.env.RESEND_FROM_EMAIL;

  // Only check for the custom fromEmail variable. Let the Resend SDK handle the API key.
  if (!fromEmail) {
    return NextResponse.json({ 
        error: 'Server Configuration Error', 
        message: `Server configuration is incomplete. The RESEND_FROM_EMAIL environment variable is missing.` 
    }, { status: 500 });
  }

  try {
    // Instantiate Resend inside the try block. 
    // The SDK will automatically look for the RESEND_API_KEY environment variable.
    const resend = new Resend();

    const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: html,
    });

    // Handle specific errors returned by the Resend API in its response object.
    if (error) {
        console.error('[Email Route] Resend API returned an error:', JSON.stringify(error, null, 2));
        return NextResponse.json({ 
            error: 'Resend API Error', 
            message: `[${error.name}] ${error.message}` 
        }, { status: 422 });
    }

    return NextResponse.json(data);
  } catch (exception) {
      // This will catch errors from `new Resend()` if the key is missing, or network errors.
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
