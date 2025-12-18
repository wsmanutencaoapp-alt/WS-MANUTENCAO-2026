'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, documentId, doc, updateDoc } from 'firebase/firestore';
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
import { Loader2, Edit, Save, X } from 'lucide-react';
import type { Kit, Tool } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import Image from 'next/image';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface KitDetailsDialogProps {
  kit: WithDocId<Kit> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function KitDetailsDialog({ kit, isOpen, onClose }: KitDetailsDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editableKit, setEditableKit] = useState<Partial<Kit>>({});

  useEffect(() => {
    if (kit) {
      setEditableKit({
        descricao: kit.descricao,
        enderecamento: kit.enderecamento,
      });
    }
    setIsEditing(false); // Reset editing mode when kit changes
  }, [kit]);

  const toolsQuery = useMemoFirebase(() => {
    if (!firestore || !kit || !kit.toolIds || kit.toolIds.length === 0) return null;
    return query(collection(firestore, 'tools'), where(documentId(), 'in', kit.toolIds));
  }, [firestore, kit]);

  const { data: tools, isLoading, error } = useCollection<WithDocId<Tool>>(toolsQuery, {
      queryKey: ['kitTools', kit?.docId],
      enabled: !!kit && !!kit.toolIds && kit.toolIds.length > 0,
  });

  const handleSaveChanges = async () => {
    if (!firestore || !kit) return;
    setIsSaving(true);
    const kitRef = doc(firestore, 'kits', kit.docId);
    try {
        await updateDoc(kitRef, {
            descricao: editableKit.descricao,
            enderecamento: editableKit.enderecamento,
        });
        toast({ title: "Sucesso!", description: "As informações do kit foram atualizadas." });
        queryClient.invalidateQueries({ queryKey: ['kits'] });
        queryClient.invalidateQueries({ queryKey: ['ferramentas'] }); // Also invalidates the main inventory list
        setIsEditing(false);
        onClose();
    } catch(err) {
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível salvar as alterações." });
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setEditableKit(prev => ({ ...prev, [id]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Kit" : "Itens do Kit"}: {kit?.codigo}</DialogTitle>
          {!isEditing && <DialogDescription>{kit?.descricao}</DialogDescription>}
        </DialogHeader>

        {isEditing ? (
            <div className="space-y-4 py-4">
                <div className="space-y-1">
                    <Label htmlFor="descricao">Descrição do Kit</Label>
                    <Input id="descricao" value={editableKit.descricao || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="enderecamento">Endereçamento do Kit</Label>
                    <Input id="enderecamento" value={editableKit.enderecamento || ''} onChange={handleInputChange} />
                </div>
            </div>
        ) : (
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
        )}
        
        <DialogFooter className="sm:justify-between">
            {isEditing ? (
                <>
                    <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
                        <X className="mr-2 h-4 w-4" /> Cancelar
                    </Button>
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar
                    </Button>
                </>
            ) : (
                <>
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <Edit className="mr-2 h-4 w-4"/> Editar Kit
                    </Button>
                    <Button onClick={onClose}>Fechar</Button>
                </>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
