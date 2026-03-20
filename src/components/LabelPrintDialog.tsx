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
import { Printer, QrCode, Globe } from 'lucide-react';

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

    const baseUrl = window.location.origin;

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

    printWindow.document.write('<html><head><title>Etiqueta Digital Real-Time - APP WS</title>');
    printWindow.document.write(`<style>${styles}</style>`);
    printWindow.document.write('</head><body>');

    tools.forEach((tool) => {
      // URL Inteligente para consulta em tempo real
      const targetPath = '/dashboard/ferramentaria/lista-ferramentas';
      const qrData = `${baseUrl}${targetPath}?search=${encodeURIComponent(tool.codigo)}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
      
      let html = '';
      if (labelSize === 'small') {
        // Layout sem logo e com fontes reduzidas para ferramentas
        html = `
          <div class="label-container" style="width: 120mm; height: 23mm; padding: 0 10mm; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 5mm;">
            <div style="text-align: left; overflow: hidden;">
              <div style="font-size: 10pt; font-weight: 900; line-height: 1.1; color: black; text-transform: uppercase;">${tool.descricao}</div>
              <div style="font-size: 8pt; font-family: monospace; font-weight: bold; margin-top: 1mm; color: #333;">${tool.codigo}</div>
            </div>
            <img src="${qrUrl}" style="width: 16mm; height: 16mm;" />
          </div>
        `;
      } else {
        // Etiqueta Grande com ajustes de posição e fonte
        html = `
          <div class="label-container" style="width: 100mm; height: 60mm; padding: 2mm 8mm 8mm 8mm; flex-direction: column; text-align: center; justify-content: flex-start;">
            <img src="/logo.png" style="height: 10mm; object-fit: contain; margin-top: 0; margin-bottom: 5mm;" />
            <div style="display: flex; flex-direction: column; justify-content: center; margin-bottom: 4mm;">
              <div style="font-size: 12pt; font-weight: 900; color: black; margin-bottom: 1mm; text-transform: uppercase;">${tool.descricao}</div>
              <div style="font-size: 9pt; font-family: monospace; font-weight: bold; color: #444;">${tool.codigo}</div>
            </div>
            <div style="flex: 1; display: flex; align-items: flex-end; justify-content: center;">
              <img src="${qrUrl}" style="width: 22mm; height: 22mm;" />
            </div>
          </div>
        `;
      }
      printWindow.document.write(html);
    });

    printWindow.document.write('</body></html>');
    printWindow.document.close();
    
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
            Imprimir Etiquetas Digitais
          </DialogTitle>
          <DialogDescription>
            {tools.length === 1 
              ? `Gerando etiqueta dinâmica para ${tools[0].codigo}.`
              : `Gerando ${tools.length} etiquetas dinâmicas.`}
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

          <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-900/20 text-sm">
            <p className="font-semibold mb-2 text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Globe className="h-4 w-4"/> Etiqueta Inteligente
            </p>
            <p className="text-blue-600 dark:text-blue-400 text-xs leading-relaxed">
              O endereço não é impresso no papel porque ele é dinâmico. Ao escanear o QR Code, você verá a localização atualizada no sistema em tempo real.
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