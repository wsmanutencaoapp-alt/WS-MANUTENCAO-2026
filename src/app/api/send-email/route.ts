'use server';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// ATENÇÃO: Medida temporária e insegura para testes de funcionalidade.
// Substitua 'SUA_CHAVE_API_AQUI' pela sua chave de API real do Resend.
// Recomenda-se fortemente voltar a usar o Secret Manager em produção.
const apiKey = 'SUA_CHAVE_API_AQUI'; 

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  
  if (apiKey === 'SUA_CHAVE_API_AQUI') {
    return NextResponse.json({ 
        error: 'Server Configuration Error', 
        message: 'A chave da API do Resend não foi inserida no código. Substitua o placeholder em src/app/api/send-email/route.ts.'
    }, { status: 500 });
  }

  if (!fromEmail) {
    return NextResponse.json({ 
        error: 'Server Configuration Error', 
        message: 'A variável de ambiente RESEND_FROM_EMAIL está faltando. Verifique seu arquivo apphosting.yaml.'
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
