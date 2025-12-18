'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, documentId } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Loader2 } from 'lucide-react';
import type { Kit, Tool } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import Image from 'next/image';
import { Badge } from './ui/badge';

interface KitDetailsDialogProps {
  kit: WithDocId<Kit> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function KitDetailsDialog({ kit, isOpen, onClose }: KitDetailsDialogProps) {
  const firestore = useFirestore();

  const toolsQuery = useMemoFirebase(() => {
    if (!firestore || !kit || !kit.toolIds || kit.toolIds.length === 0) return null;
    return query(collection(firestore, 'tools'), where(documentId(), 'in', kit.toolIds));
  }, [firestore, kit]);

  const { data: tools, isLoading, error } = useCollection<WithDocId<Tool>>(toolsQuery, {
      queryKey: ['kitTools', kit?.docId],
      enabled: !!kit && !!kit.toolIds && kit.toolIds.length > 0,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Itens do Kit: {kit?.codigo}</DialogTitle>
          <DialogDescription>{kit?.descricao}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] h-96 border rounded-md">
           <div className="p-4 space-y-3">
             {isLoading && <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />}
             {error && <p className="text-destructive text-center">Erro ao carregar ferramentas.</p>}
             {!isLoading && !tools?.length && (
                 <p className="text-muted-foreground text-center">Nenhuma ferramenta encontrada neste kit.</p>
             )}
            {!isLoading && tools?.map(tool => (
                <div key={tool.docId} className="flex items-center gap-4 p-2 border rounded-md">
                     <Image
                        src={tool.imageUrl || "https://picsum.photos/seed/tool/40/40"}
                        alt={tool.descricao}
                        width={40}
                        height={40}
                        className="aspect-square rounded-md object-cover"
                    />
                    <div className="flex-1 text-sm">
                        <p className="font-bold">{tool.descricao}</p>
                        <p className="font-mono text-xs text-muted-foreground">{tool.codigo}</p>
                    </div>
                     <Badge variant="secondary">{tool.status}</Badge>
                </div>
            ))}
           </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
