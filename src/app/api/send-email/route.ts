'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// A chave da API agora é acessada com segurança a partir das variáveis de ambiente.
const apiKey = process.env.RESEND_API_KEY;

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!fromEmail) {
    return NextResponse.json({
        error: 'Server Configuration Error',
        message: 'A variável de ambiente RESEND_FROM_EMAIL está faltando. Verifique seu arquivo apphosting.yaml.'
    }, { status: 500 });
  }
  
  if (!apiKey) {
    return NextResponse.json({
        error: 'Server Configuration Error',
        message: 'A RESEND_API_KEY está faltando. Verifique a configuração de segredos no Google Cloud e seu arquivo apphosting.yaml.'
    }, { status: 500 });
  }

  try {
    const resend = new Resend(apiKey);
    
    // Garante que 'to' seja sempre um array, seja recebendo uma string ou um array.
    const recipients = Array.isArray(to) ? to : [to];

    const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: recipients,
        subject: subject,
        html: html,
    });

    if (error) {
        return NextResponse.json({
            error: 'Resend API Error',
            message: `[${error.name}] ${error.message}`
        }, { status: 422 });
    }

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
