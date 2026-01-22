'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// REMOVED: const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      console.error('RESEND_API_KEY or RESEND_FROM_EMAIL is not set in the environment.');
      return NextResponse.json({ error: 'Server configuration error: Email settings are incomplete.' }, { status: 500 });
  }

  // MOVED INSTANTIATION HERE:
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('Resend API Error:', JSON.stringify(error, null, 2));
      return NextResponse.json({ message: 'Failed to send email', error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to send email:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Internal server error during email sending.', message: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unknown error occurred during email sending.' }, { status: 500 });
  }
}
