'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  try {
    // Let the Resend constructor automatically pick up the API key from the environment.
    // This is a more robust pattern in serverless environments.
    const resend = new Resend();

    const fromEmail = process.env.RESEND_FROM_EMAIL;

    // Check for the FROM email address.
    if (!fromEmail) {
      console.error('Server configuration error: RESEND_FROM_EMAIL is not set.');
      return NextResponse.json({ error: 'Server configuration error: The sender email is not configured.' }, { status: 500 });
    }
    
    // The resend.emails.send call will throw an error if the API key is missing,
    // which will be caught by the catch block.
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      // This block handles errors returned by the Resend API (e.g., invalid 'to' address)
      console.error('Resend API returned an error:', JSON.stringify(error, null, 2));
      return NextResponse.json({ message: 'Failed to send email', details: error.message }, { status: 422 }); // Unprocessable Entity
    }

    return NextResponse.json(data);
  } catch (error) {
    // This block catches errors from the Resend constructor (e.g., missing API key) or network issues.
    console.error('Caught an exception during email sending:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Email Service Error', message: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unknown error occurred.' }, { status: 500 });
  }
}
