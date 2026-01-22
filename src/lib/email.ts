'use client';

import { toast } from '@/hooks/use-toast';

// A generic email sending function
async function sendEmail(to: string, subject: string, html: string) {
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ to, subject, html }),
        });

        if (!response.ok) {
            let errorDescription = `Falha no envio do e-mail. Status: ${response.status}`;
            try {
                // Try to parse the error response as JSON
                const errorData = await response.json();
                errorDescription = errorData.error || errorData.message || errorDescription;
            } catch (e) {
                // If the response isn't JSON, use the status text as a fallback
                errorDescription = response.statusText || errorDescription;
            }
            console.error('Email API Error:', errorDescription);
            // Show a toast to the user to make the error visible.
            toast({
                variant: 'destructive',
                title: 'Erro ao Enviar Notificação por E-mail',
                description: errorDescription,
            });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro de conexão ao tentar enviar e-mail.';
        console.error(`Failed to send email to ${to}:`, error);
        toast({
            variant: 'destructive',
            title: 'Erro de Rede ao Enviar E-mail',
            description: errorMessage,
        });
    }
};

// Specific function for Purchase Requisition notifications
export const sendPurchaseRequisitionEmail = async (recipients: string[], requisitionData: any) => {
    if (recipients.length === 0) return;

    const subject = `Nova Requisição de Compra para Aprovação: ${requisitionData.protocol}`;
    const htmlBody = `
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background-color: #4A5568; color: #ffffff; padding: 20px; text-align: center;">
            <h1>Nova Requisição de Compra</h1>
          </div>
          <div style="padding: 20px 30px; color: #333;">
            <p style="font-size: 16px;">Olá,</p>
            <p style="font-size: 16px;">Uma nova Solicitação de Compra (SC) foi enviada e requer sua atenção para aprovação.</p>
            <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-top: 20px;">
              <h3 style="margin-top: 0; color: #2d3748;">Detalhes da Requisição</h3>
              <p style="margin: 5px 0;"><strong>Protocolo:</strong> ${requisitionData.protocol}</p>
              <p style="margin: 5px 0;"><strong>Solicitante:</strong> ${requisitionData.requesterName}</p>
              <p style="margin: 5px 0;"><strong>Data da Necessidade:</strong> ${new Date(requisitionData.neededByDate).toLocaleDateString('pt-BR')}</p>
              <p style="margin: 5px 0;"><strong>Prioridade:</strong> ${requisitionData.priority}</p>
              <p style="margin: 5px 0;"><strong>Motivo:</strong> ${requisitionData.purchaseReason}</p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${window.location.origin}/dashboard/compras/aprovacoes" style="background-color: #3b82f6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                Analisar Requisição
              </a>
            </div>
          </div>
          <div style="background-color: #edf2f7; text-align: center; padding: 15px; font-size: 12px; color: #718096;">
            <p>Este é um e-mail automático do sistema APP WS.</p>
          </div>
        </div>
      </body>
    `;

    for (const email of recipients) {
        await sendEmail(email, subject, htmlBody);
    }
};

// Specific function for Purchase Order notifications
export const sendPurchaseOrderEmail = async (recipients: string[], orderData: any) => {
    if (recipients.length === 0) return;
    
    const subject = `Nova Ordem de Compra para Aprovação: ${orderData.protocol}`;
    const htmlBody = `
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background-color: #4A5568; color: #ffffff; padding: 20px; text-align: center;">
            <h1>Nova Ordem de Compra para Aprovação</h1>
          </div>
          <div style="padding: 20px 30px; color: #333;">
            <p style="font-size: 16px;">Olá,</p>
            <p style="font-size: 16px;">Uma nova Ordem de Compra (OC) foi gerada a partir da SC ${orderData.originalRequisitionProtocol || ''} e aguarda sua aprovação.</p>
            <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-top: 20px;">
              <h3 style="margin-top: 0; color: #2d3748;">Detalhes da Ordem de Compra</h3>
              <p style="margin: 5px 0;"><strong>Protocolo OC:</strong> ${orderData.protocol}</p>
              <p style="margin: 5px 0;"><strong>Requisição Original:</strong> ${orderData.originalRequisitionProtocol || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Fornecedor:</strong> ${orderData.supplierName}</p>
              <p style="margin: 5px 0;"><strong>Valor Total:</strong> <strong>${(orderData.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
              <p style="margin: 5px 0;"><strong>Cond. Pagamento:</strong> ${orderData.paymentTerms}</p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${window.location.origin}/dashboard/compras/aprovacoes" style="background-color: #3b82f6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                Analisar Ordem de Compra
              </a>
            </div>
          </div>
          <div style="background-color: #edf2f7; text-align: center; padding: 15px; font-size: 12px; color: #718096;">
            <p>Este é um e-mail automático do sistema APP WS.</p>
          </div>
        </div>
      </body>
    `;

    for (const email of recipients) {
        await sendEmail(email, subject, htmlBody);
    }
};
