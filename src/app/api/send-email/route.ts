'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  
  if (!apiKey) {
    return NextResponse.json({ 
        error: 'Server Configuration Error', 
        message: 'The RESEND_API_KEY is missing. Please ensure it is set correctly in your Google Cloud Secret Manager and referenced in the apphosting.yaml file.'
    }, { status: 500 });
  }

  if (!fromEmail) {
    return NextResponse.json({ 
        error: 'Server Configuration Error', 
        message: 'The RESEND_FROM_EMAIL environment variable is missing. Check your apphosting.yaml file.'
    }, { status: 500 });
  }

  try {
    const resend = new Resend(apiKey); 

    const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: html,
    });

    if (error) {
        // This handles errors returned from the Resend API (e.g., validation errors)
        return NextResponse.json({ 
            error: 'Resend API Error', 
            message: `[${error.name}] ${error.message}` 
        }, { status: 422 });
    }

    // Success
    return NextResponse.json(data);
  } catch (exception) {
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
