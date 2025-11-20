'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  setDoc,
} from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search } from 'lucide-react';
import type { Tool } from '@/lib/types';
import Image from 'next/image';

interface AddQuantityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTools: any[]) => void;
}

type FoundTool = Tool & {
  id: string;
};

export default function AddQuantityDialog({ isOpen, onClose, onSuccess }: AddQuantityDialogProps) {
  const [searchCodigo, setSearchCodigo] = useState('');
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [foundTool, setFoundTool] = useState<FoundTool | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastUnitCode, setLastUnitCode] = useState<string | null>(null);

  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    // Reset state when dialog is closed
    if (!isOpen) {
      setSearchCodigo('');
      setQuantityToAdd(1);
      setFoundTool(null);
      setIsSearching(false);
      setIsSaving(false);
      setLastUnitCode(null);
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!firestore || !searchCodigo) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Digite um código para pesquisar.' });
      return;
    }
    setIsSearching(true);
    setFoundTool(null);
    setLastUnitCode(null);

    try {
      const toolsRef = collection(firestore, 'tools');
      const q = query(
        toolsRef,
        where('codigo', '==', searchCodigo.toUpperCase()),
        orderBy('unitCode', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: 'destructive', title: 'Não Encontrado', description: 'Nenhuma ferramenta encontrada com este código.' });
        setFoundTool(null);
      } else {
        const doc = querySnapshot.docs[0];
        setFoundTool({ id: doc.id, ...doc.data() } as FoundTool);
        setLastUnitCode(doc.data().unitCode || 'A0000');
        toast({ title: 'Ferramenta Encontrada', description: doc.data().name });
      }
    } catch (error) {
      console.error('Erro ao pesquisar ferramenta:', error);
      toast({ variant: 'destructive', title: 'Erro na Busca', description: 'Não foi possível realizar a busca.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    if (!firestore || !foundTool || !lastUnitCode) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma ferramenta selecionada para adicionar unidades.' });
      return;
    }
    if (quantityToAdd <= 0) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A quantidade deve ser maior que zero.' });
      return;
    }

    setIsSaving(true);
    const newTools = [];

    try {
      const lastUnitNumber = parseInt(lastUnitCode.replace('A', ''), 10);
      
      for (let i = 0; i < quantityToAdd; i++) {
        const newUnitNumber = lastUnitNumber + 1 + i;
        const newUnitCode = `A${newUnitNumber.toString().padStart(4, '0')}`;
        
        const newToolDocRef = doc(collection(firestore, 'tools'));
        
        const newToolData = {
          ...foundTool, // Spread all properties from the found tool
          id: newToolDocRef.id, // Set the new unique ID
          unitCode: newUnitCode, // Set the new sequential unit code
          status: 'Disponível', // New units should be available
        };

        await setDoc(newToolDocRef, newToolData);
        newTools.push(newToolData);
      }

      toast({ title: 'Sucesso!', description: `${quantityToAdd} nova(s) unidade(s) de ${foundTool.name} foram adicionadas.` });
      onSuccess(newTools);

    } catch (error) {
      console.error('Erro ao adicionar unidades:', error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível adicionar as novas unidades.' });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Quantidade</DialogTitle>
          <DialogDescription>
            Pesquise uma ferramenta pelo código e adicione novas unidades.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex w-full items-center space-x-2">
            <Input
              id="searchCodigo"
              placeholder="Pesquisar por Código (ex: FE000001)"
              value={searchCodigo}
              onChange={(e) => setSearchCodigo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button type="button" size="icon" onClick={handleSearch} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {foundTool && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
              <h4 className="font-semibold text-center">Ferramenta Encontrada</h4>
               <div className="flex items-start gap-4">
                 <Image
                    src={foundTool.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                    alt={foundTool.name}
                    width={64}
                    height={64}
                    className="aspect-square rounded-md object-cover"
                  />
                  <div className="text-sm">
                      <p className="font-bold">{foundTool.name}</p>
                      <p><strong>Código:</strong> {foundTool.codigo}</p>
                      <p><strong>Último Lote:</strong> {lastUnitCode}</p>
                  </div>
              </div>
              <div className="grid w-full max-w-sm items-center gap-1.5 pt-2">
                  <Label htmlFor="quantityToAdd">Quantidade a Adicionar</Label>
                  <Input
                    id="quantityToAdd"
                    type="number"
                    min="1"
                    value={quantityToAdd}
                    onChange={(e) => setQuantityToAdd(parseInt(e.target.value, 10))}
                  />
              </div>
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!foundTool || isSaving || isSearching}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar e Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
