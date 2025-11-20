'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Printer, FileText } from 'lucide-react';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import JsBarcode from 'jsbarcode';

type ToolLabelData = {
  id: string;
  name?: string;
  codigo?: string;
  unitCode?: string;
  enderecamento?: string;
  label_url?: string | null;
};

interface LabelPrintDialogProps {
  tools: ToolLabelData[];
  isOpen: boolean;
  onClose: () => void;
}

const generateLabelSvgLocally = (tool: ToolLabelData): string => {
    const { codigo = 'N/A', name = 'N/A', unitCode = 'N/A', enderecamento = '' } = tool;
    const uniqueBarcodeValue = `${codigo}-${unitCode}`;

    const svgContainer = document.createElement('div');
    const barcodeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    
    try {
        JsBarcode(barcodeSvg, uniqueBarcodeValue, {
            format: "CODE128",
            displayValue: false, // Do not display text value under the barcode
            width: 1.5, 
            height: 40,
            margin: 0,
        });
    } catch(e) {
        console.error("JsBarcode error:", e);
        return `<svg width="100mm" height="60mm"><text x="10" y="10" fill="red">Barcode Error</text></svg>`;
    }
    
    const barcodeSvgContent = barcodeSvg.innerHTML;
    const barcodeWidth = parseFloat(barcodeSvg.getAttribute('width') || '0');

    // Label dimensions: 100mm x 60mm. (378 x 227 viewBox units)
    const labelWidth = 378;
    const labelHeight = 227;
    
    // Position text at the top
    const textBlockY = 30; 
    
    // Calculate barcode position to center it in the remaining space
    const textBlockHeight = 60; // Estimated height for the text block
    const remainingHeight = labelHeight - textBlockHeight;
    const barcodeGroupYPosition = textBlockHeight + (remainingHeight / 2) - 20; // Center barcode vertically

    return `
        <svg width="100mm" height="60mm" viewBox="0 0 ${labelWidth} ${labelHeight}" xmlns="http://www.w3.org/2000/svg" style="background-color:white; border: 1px solid #ccc;">
            <style>
                .name { font: bold 16px sans-serif; text-anchor: middle; }
                .details { font: 14px sans-serif; text-anchor: middle; }
                .barcode-text { font: 12px sans-serif; text-anchor: middle; }
            </style>
            
            <text x="${labelWidth / 2}" y="${textBlockY}" class="name">${name.length > 40 ? name.substring(0, 37) + '...' : name}</text>
            <text x="${labelWidth / 2}" y="${textBlockY + 20}" class="details">
                Lote/Unid.: ${unitCode} ${enderecamento ? `| Local: ${enderecamento}` : ''}
            </text>
             <text x="${labelWidth / 2}" y="${textBlockY + 40}" class="details">Código: ${codigo}</text>

            <g transform="translate(${(labelWidth - barcodeWidth) / 2}, ${barcodeGroupYPosition})">
                ${barcodeSvgContent}
            </g>
        </svg>
    `;
};


export default function LabelPrintDialog({ tools, isOpen, onClose }: LabelPrintDialogProps) {
  const [generatedLabels, setGeneratedLabels] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printableAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();


  useEffect(() => {
    if (isOpen && tools.length > 0 && firestore && storage) {
      const generateAndSaveLabels = async () => {
        setIsLoading(true);
        setError(null);
        const newLabels = new Map<string, string>();
        let success = true;

        for (const tool of tools) {
          if (!tool.id || !tool.codigo) continue;

          try {
            const svgContent = generateLabelSvgLocally(tool);

            const svgRef = storageRef(storage, `tool-labels/${tool.id}.svg`);
            await uploadString(svgRef, svgContent, 'raw', { contentType: 'image/svg+xml' });
            const downloadURL = await getDownloadURL(svgRef);

            const toolDocRef = doc(firestore, 'tools', tool.id);
            await updateDoc(toolDocRef, { label_url: downloadURL });
            
            newLabels.set(tool.id, svgContent);

          } catch (e) {
            console.error(`Failed to generate or save label for ${tool.codigo}:`, e);
            setError(`Erro ao gerar etiqueta para ${tool.codigo}.`);
            success = false;
            break; 
          }
        }
        
        if (success) {
           toast({ title: 'Etiquetas Geradas!', description: 'As etiquetas estão prontas para impressão.' });
        } else {
           toast({ variant: 'destructive', title: 'Falha na Geração', description: error || 'Ocorreu um erro desconhecido.' });
        }
        
        setGeneratedLabels(newLabels);
        setIsLoading(false);
      };

      generateAndSaveLabels();
    }
  }, [isOpen, tools, toast, firestore, storage]);

  const handlePrint = () => {
    const printableContent = printableAreaRef.current;
    if (!printableContent) return;

    const printWindow = window.open('', '', 'height=800,width=1000');
    if (!printWindow) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.' });
      return;
    }
    
    const styles = `
      @media print {
        @page { 
          size: 100mm 60mm; 
          margin: 0; 
        }
        body { 
          margin: 0;
          -webkit-print-color-adjust: exact;
        }
        .label-container {
          page-break-inside: avoid;
          page-break-after: always;
          border: none !important;
          margin: 0;
          padding: 0;
          width: 100mm;
          height: 60mm;
          display: block;
        }
        .label-container:last-child {
          page-break-after: auto;
        }
      }
    `;

    printWindow.document.write('<html><head><title>Imprimir Etiquetas</title>');
    printWindow.document.write(`<style>${styles}</style>`);
    printWindow.document.write('</head><body>');
    printWindow.document.write(printableContent.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
  };

  const handleClose = () => {
    setGeneratedLabels(new Map());
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Imprimir Etiqueta(s)</DialogTitle>
          <DialogDescription>
            Abaixo estão as etiquetas geradas. Clique em "Imprimir" para enviá-las para a impressora.
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto p-4 border rounded-md bg-muted/50">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-muted-foreground">Gerando e salvando etiquetas...</p>
            </div>
          )}
          {error && !isLoading && (
             <div className="flex flex-col items-center justify-center h-40 text-destructive">
                <FileText className="h-8 w-8" />
                <p className="mt-2 text-center">{error}</p>
             </div>
          )}
          {!isLoading && !error && generatedLabels.size > 0 && (
            <div ref={printableAreaRef} className="space-y-4">
              {Array.from(generatedLabels.entries()).map(([id, svg]) => (
                <div key={id} className="label-container" dangerouslySetInnerHTML={{ __html: svg }} />
              ))}
            </div>
          )}
           {!isLoading && !error && generatedLabels.size === 0 && tools.length > 0 && (
            <div className="flex flex-col items-center justify-center h-40">
              <p className="mt-2 text-muted-foreground">Nenhuma etiqueta para exibir.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
          <Button onClick={handlePrint} disabled={isLoading || error != null || generatedLabels.size === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
