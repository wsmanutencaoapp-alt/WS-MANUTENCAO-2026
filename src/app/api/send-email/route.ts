'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  
  if (!fromEmail) {
    return NextResponse.json({ 
        error: 'Server Configuration Error', 
        message: 'The RESEND_FROM_EMAIL environment variable is missing.'
    }, { status: 500 });
  }

  try {
    // The Resend SDK will automatically look for the RESEND_API_KEY in the environment.
    // If it's not found, the constructor will throw an error which will be caught below.
    const resend = new Resend(); 

    const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: html,
    });

    if (error) {
        // This handles errors returned from the Resend API (e.g., validation errors)
        console.error('[Email Route] Resend API returned an error:', JSON.stringify(error, null, 2));
        return NextResponse.json({ 
            error: 'Resend API Error', 
            message: `[${error.name}] ${error.message}` 
        }, { status: 422 });
    }

    // Success
    return NextResponse.json(data);
  } catch (exception) {
      // This catches exceptions thrown during the process, including the Resend constructor
      // if the API key is missing.
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
