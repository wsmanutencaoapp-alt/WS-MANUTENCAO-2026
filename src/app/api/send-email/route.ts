'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  // Explicitly check for both variables
  if (!apiKey || !fromEmail) {
    const missing = [];
    if (!apiKey) missing.push('RESEND_API_KEY');
    if (!fromEmail) missing.push('RESEND_FROM_EMAIL');
    
    console.error(`Server configuration error: The following environment variables are not set: ${missing.join(', ')}`);
    return NextResponse.json({ 
        error: 'Email Service Error', 
        message: `Server configuration is incomplete. Missing: ${missing.join(', ')}.` 
    }, { status: 500 });
  }

  try {
    const resend = new Resend(apiKey); // Explicitly pass the key

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('Resend API returned an error:', JSON.stringify(error, null, 2));
      return NextResponse.json({ message: 'Failed to send email', details: error.message }, { status: 422 });
    }

    return NextResponse.json(data);
  } catch (error) {
    // This block catches network issues or other unexpected errors during the send call.
    console.error('Caught an exception during email sending:', error);
    if (error instanceof Error) {
        // Provide a more detailed error message
        return NextResponse.json({ error: 'Email Service Error', message: `An unexpected exception occurred: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unknown error occurred.' }, { status: 500 });
  }
}
