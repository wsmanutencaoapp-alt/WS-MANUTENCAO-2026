'use client';

import { toast } from '@/hooks/use-toast';
import type { PurchaseRequisition, PurchaseRequisitionItem, Delivery } from '@/lib/types';
import { RequisitionItemWithDetails } from '@/components/PurchaseRequisitionDetailsDialog';

// A generic email sending function that accepts single or multiple recipients
async function sendEmail(to: string | string[], subject: string, html: string) {
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
                const errorData = await response.json();
                errorDescription = errorData.message || errorData.error || errorDescription;
            } catch (e) {
                errorDescription = response.statusText || errorDescription;
            }
            console.error('Email API Error:', errorDescription);
            toast({
                variant: 'destructive',
                title: 'Erro ao Enviar Notificação por E-mail',
                description: errorDescription,
            });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro de conexão ao tentar enviar e-mail.';
        console.error(`Failed to send email:`, error);
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

    // Send one email to all recipients at once
    await sendEmail(recipients, subject, htmlBody);
};

// Specific function for Purchase Order notifications (Internal Approval)
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

    // Send one email to all recipients at once
    await sendEmail(recipients, subject, htmlBody);
};

// New function to send the PO to the supplier
export const sendPurchaseOrderToSupplier = async (supplierEmail: string, order: PurchaseRequisition, items: RequisitionItemWithDetails[]) => {
    const subject = `Ordem de Compra: ${order.protocol}`;
    
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.details.codigo || 'N/A'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.details.descricao || 'N/A'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(item.estimatedPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${((item.estimatedPrice || 0) * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        </tr>
    `).join('');

    const htmlBody = `
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 800px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background-color: #4A5568; color: #ffffff; padding: 20px;">
            <h1 style="margin: 0;">ORDEM DE COMPRA: ${order.protocol}</h1>
          </div>
          <div style="padding: 20px 30px; color: #333;">
            <p style="font-size: 16px;">Prezados,</p>
            <p style="font-size: 16px;">Segue nossa ordem de compra formal. Por favor, confirmar o recebimento e a data de entrega prevista.</p>
            
            <h3 style="margin-top: 25px; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">Itens Solicitados</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <thead>
                <tr style="background-color: #edf2f7;">
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Código</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Descrição</th>
                  <th style="padding: 10px; border: 1px solid #ddd;">Qtd.</th>
                  <th style="padding: 10px; border: 1px solid #ddd;">Preço Un.</th>
                  <th style="padding: 10px; border: 1px solid #ddd;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                    <td colspan="4" style="padding: 10px; text-align: right; font-weight: bold;">VALOR TOTAL:</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold; border: 1px solid #ddd;">${(order.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
              </tfoot>
            </table>

             <h3 style="margin-top: 25px; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">Condições</h3>
             <p><strong>Condição de Pagamento:</strong> ${order.paymentTerms || 'N/A'}</p>
             <p><strong>Data Limite para Entrega:</strong> ${new Date(order.neededByDate).toLocaleDateString('pt-BR')}</p>

            <p style="margin-top: 30px;">Atenciosamente,</p>
            <p><strong>Setor de Compras</strong></p>
          </div>
          <div style="background-color: #edf2f7; text-align: center; padding: 15px; font-size: 12px; color: #718096;">
            <p>Este é um e-mail automático do sistema APP WS.</p>
          </div>
        </div>
      </body>
    `;

    await sendEmail(supplierEmail, subject, htmlBody);
};

export const sendItemsReceivedEmail = async (recipients: string[], order: PurchaseRequisition, delivery: Delivery) => {
    if (recipients.length === 0) return;

    const subject = `Itens Recebidos da Ordem de Compra: ${order.protocol}`;

    const itemsHtml = delivery.items.map(item => `
        <li style="margin-bottom: 10px;">
            <strong>${item.itemName}</strong><br>
            <span style="font-size: 14px; color: #555;">Quantidade Recebida: ${item.quantityReceived}</span>
        </li>
    `).join('');

    const htmlBody = `
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background-color: #16a34a; color: #ffffff; padding: 20px; text-align: center;">
            <h1>Recebimento de Itens Concluído</h1>
          </div>
          <div style="padding: 20px 30px; color: #333;">
            <p style="font-size: 16px;">Olá,</p>
            <p style="font-size: 16px;">Informamos que os seguintes itens da Ordem de Compra <strong>${order.protocol}</strong> foram recebidos com a Nota Fiscal <strong>${delivery.nfNumber}</strong>.</p>
            <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-top: 20px;">
              <h3 style="margin-top: 0; color: #2d3748;">Itens Recebidos</h3>
              <ul style="list-style-type: none; padding: 0;">
                ${itemsHtml}
              </ul>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${window.location.origin}/dashboard/compras/controle-compras" style="background-color: #3b82f6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                Ver Detalhes da OC
              </a>
            </div>
          </div>
          <div style="background-color: #edf2f7; text-align: center; padding: 15px; font-size: 12px; color: #718096;">
            <p>Este é um e-mail automático do sistema APP WS.</p>
          </div>
        </div>
      </body>
    `;

    await sendEmail(recipients, subject, htmlBody);
};
