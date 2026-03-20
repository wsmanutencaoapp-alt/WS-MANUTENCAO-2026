'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Printer, QrCode } from 'lucide-react';

interface LabelPrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tools: any[]; // Aceita ferramentas ou kits
}

export default function LabelPrintDialog({ isOpen, onClose, tools }: LabelPrintDialogProps) {
  const [labelSize, setLabelSize] = useState<'small' | 'large'>('small');

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const styles = `
      @media print {
        @page {
          size: ${labelSize === 'small' ? '120mm 23mm' : '100mm 60mm'};
          margin: 0;
        }
        body { 
          margin: 0; 
          padding: 0; 
          font-family: sans-serif; 
          background: white; 
          -webkit-print-color-adjust: exact;
        }
        .label-container { 
          page-break-after: always; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          overflow: hidden; 
          box-sizing: border-box;
        }
      }
    `;

    printWindow.document.write('<html><head><title>Impressão de Etiquetas - APP WS</title>');
    printWindow.document.write(`<style>${styles}</style>`);
    printWindow.document.write('</head><body>');

    tools.forEach((tool) => {
      const qrData = tool.codigo;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
      
      let html = '';
      if (labelSize === 'small') {
        // Layout 120mm x 23mm (Mesmo do endereçamento)
        html = `
          <div class="label-container" style="width: 120mm; height: 23mm; padding: 0 5mm; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8mm;">
            <img src="/logo.png" style="height: 16mm; width: auto; object-fit: contain;" />
            <div style="text-align: center; overflow: hidden;">
              <div style="font-size: 14pt; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: black;">${tool.descricao}</div>
              <div style="font-size: 12pt; font-family: monospace; font-weight: bold; margin-top: 1mm; color: #333;">${tool.codigo}</div>
            </div>
            <img src="${qrUrl}" style="width: 19mm; height: 19mm;" />
          </div>
        `;
      } else {
        // Layout 100mm x 60mm (Grande)
        html = `
          <div class="label-container" style="width: 100mm; height: 60mm; padding: 8mm; flex-direction: column; text-align: center; justify-content: space-between;">
            <img src="/logo.png" style="height: 10mm; object-fit: contain;" />
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
              <div style="font-size: 18pt; font-weight: 900; color: black; margin-bottom: 2mm;">${tool.descricao}</div>
              <div style="font-size: 14pt; font-family: monospace; font-weight: bold; color: #444;">${tool.codigo}</div>
            </div>
            <img src="${qrUrl}" style="width: 25mm; height: 25mm; margin-top: 2mm;" />
          </div>
        `;
      }
      printWindow.document.write(html);
    });

    printWindow.document.write('</body></html>');
    printWindow.document.close();
    
    // Pequeno delay para garantir que as imagens dos QR Codes carreguem antes do diálogo de impressão
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Imprimir Etiquetas
          </DialogTitle>
          <DialogDescription>
            {tools.length === 1 
              ? `Gerando etiqueta para o item ${tools[0].codigo}.`
              : `Gerando ${tools.length} etiquetas para os itens selecionados.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="size-selector">Tamanho da Etiqueta</Label>
            <Select value={labelSize} onValueChange={(v: any) => setLabelSize(v)}>
              <SelectTrigger id="size-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Pequena (120mm x 23mm)</SelectItem>
                <SelectItem value="large">Grande (100mm x 60mm)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 border rounded-md bg-muted/50 text-sm">
            <p className="font-semibold mb-2 text-primary">Tecnologia QR Code</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              O QR Code permite uma leitura mais rápida e confiável. Seus itens antigos com código de barras continuam válidos.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir Etiquetas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
