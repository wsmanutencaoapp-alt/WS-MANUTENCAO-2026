'use client';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { Tool } from '@/lib/types';
import { Edit, ZoomIn } from 'lucide-react';

interface ToolDetailsDialogProps {
  tool: Tool | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ToolDetailsDialog({ tool, isOpen, onClose }: ToolDetailsDialogProps) {
  if (!tool) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes da Ferramenta</DialogTitle>
          <DialogDescription>
            Informações completas sobre {tool.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative group">
            <Image
              alt={tool.name}
              className="aspect-video w-full rounded-md object-cover"
              height="250"
              src={tool.imageUrl || "https://picsum.photos/seed/tool/400/250"}
              width="400"
            />
             <a 
                href={tool.imageUrl || "#"} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
            >
                <ZoomIn className="h-8 w-8 text-white" />
            </a>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="font-semibold text-muted-foreground">Código</p>
              <p>{tool.codigo || 'N/A'}</p>
            </div>
             <div>
              <p className="font-semibold text-muted-foreground">Status</p>
              <div>
                 <Badge variant={tool.status === 'Available' ? 'secondary' : 'default'}>
                    {tool.status || 'N/A'}
                 </Badge>
              </div>
            </div>
            <div className="col-span-2">
              <p className="font-semibold text-muted-foreground">Nome</p>
              <p>{tool.name}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">Endereçamento</p>
              <p>{tool.enderecamento || 'N/A'}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">Aeronave Principal</p>
              <p>{tool.aeronave_principal || 'N/A'}</p>
            </div>
             <div>
              <p className="font-semibold text-muted-foreground">Calibrável</p>
              <p>{tool.is_calibrable ? 'Sim' : 'Não'}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">Última Calibração</p>
              <p>{tool.lastCalibration || 'N/A'}</p>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => { /* Lógica de edição aqui */ }}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
            </Button>
            <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
