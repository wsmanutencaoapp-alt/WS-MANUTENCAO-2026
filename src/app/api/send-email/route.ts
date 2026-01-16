'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'APP WS <onboarding@resend.dev>', // You must verify this domain on Resend
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('Resend API Error:', error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to send email:', error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
