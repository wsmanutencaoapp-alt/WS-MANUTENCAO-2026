'use client';

// A generic email sending function
async function sendEmail(to: string, subject: string, html: string) {
    try {
        await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ to, subject, html }),
        });
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        // We don't throw an error to not block the UI flow.
    }
};

// Specific function for Purchase Requisition notifications
export const sendPurchaseRequisitionEmail = async (recipients: string[], requisitionData: any) => {
    if (recipients.length === 0) return;

    const subject = `Nova Requisição de Compra para Aprovação: ${requisitionData.protocol}`;
    const htmlBody = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #1a202c;">Nova Requisição de Compra</h2>
        <p>Uma nova solicitação de compra foi criada e aguarda sua aprovação.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p><strong>Protocolo:</strong> ${requisitionData.protocol}</p>
        <p><strong>Solicitante:</strong> ${requisitionData.requesterName}</p>
        <p><strong>Motivo da Compra:</strong> ${requisitionData.purchaseReason}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="text-align: center;">
          <a href="${window.location.origin}/dashboard/compras/aprovacoes" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Ver Requisição
          </a>
        </p>
      </div>
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
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #1a202c;">Nova Ordem de Compra</h2>
        <p>Uma nova ordem de compra foi gerada a partir da SC ${orderData.originalRequisitionProtocol || ''} e aguarda sua aprovação.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p><strong>Protocolo OC:</strong> ${orderData.protocol}</p>
        <p><strong>Fornecedor:</strong> ${orderData.supplierName}</p>
        <p><strong>Valor Total:</strong> ${(orderData.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="text-align: center;">
          <a href="${window.location.origin}/dashboard/compras/aprovacoes" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Ver Ordem de Compra
          </a>
        </p>
      </div>
    `;

    for (const email of recipients) {
        await sendEmail(email, subject, htmlBody);
    }
};
