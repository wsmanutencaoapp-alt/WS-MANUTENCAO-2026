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
  runTransaction,
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
  
  useEffect(() => {
    const handleSearch = async () => {
      if (!firestore || searchCodigo.length < 5) {
        setFoundTool(null);
        return;
      }
      setIsSearching(true);
      setFoundTool(null);
      setLastUnitCode(null);
  
      try {
        const toolsRef = collection(firestore, 'tools');
        // Consulta simplificada para evitar erro de índice: filtra apenas por código.
        const q = query(
          toolsRef,
          where('codigo', '==', searchCodigo.toUpperCase())
        );
  
        const querySnapshot = await getDocs(q);
  
        if (querySnapshot.empty) {
          setFoundTool(null);
        } else {
          // Ordena os resultados no lado do cliente para encontrar a última unidade.
          const tools = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoundTool));
          tools.sort((a, b) => (b.unitCode || '').localeCompare(a.unitCode || ''));
          
          const lastTool = tools[0];
          setFoundTool(lastTool);
          setLastUnitCode(lastTool.unitCode || 'A0000');
        }
      } catch (error) {
        console.error('Erro ao pesquisar ferramenta:', error);
        toast({ variant: 'destructive', title: 'Erro na Busca', description: 'Não foi possível realizar a busca.' });
      } finally {
        setIsSearching(false);
      }
    };

    const debounceSearch = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(debounceSearch);
  }, [searchCodigo, firestore, toast]);


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
    const newTools: FoundTool[] = [];
    const mainToolCode = foundTool.codigo;

    try {
      await runTransaction(firestore, async (transaction) => {
        const lastToolQuery = query(
            collection(firestore, 'tools'), 
            where('codigo', '==', mainToolCode), 
            orderBy('unitCode', 'desc'), 
            limit(1)
        );
        const lastToolSnapshot = await getDocs(lastToolQuery);
        let lastUnitNumber = 0;
        if (!lastToolSnapshot.empty) {
            const lastTool = lastToolSnapshot.docs[0].data();
            lastUnitNumber = parseInt(lastTool.unitCode.replace('A', ''), 10);
        }

        for (let i = 0; i < quantityToAdd; i++) {
          const newUnitNumber = lastUnitNumber + 1 + i;
          const newUnitCode = `A${newUnitNumber.toString().padStart(4, '0')}`;
          
          const newToolDocRef = doc(collection(firestore, 'tools'));
          
          const { id, ...baseData } = foundTool;

          const newToolData = {
            ...baseData,
            unitCode: newUnitCode,
            status: 'Disponível',
          };
          
          transaction.set(newToolDocRef, newToolData);
          newTools.push({ ...newToolData, id: newToolDocRef.id });
        }
      });
      

      toast({ title: 'Sucesso!', description: `${quantityToAdd} nova(s) unidade(s) de ${foundTool.name} foram adicionadas.` });
      onSuccess(newTools);

    } catch (error) {
      console.error('Erro ao adicionar unidades:', error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível adicionar as novas unidades. Verifique as permissões.' });
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
          <div className="relative">
            <Label htmlFor="searchCodigo">Pesquisar por Código</Label>
            <Search className="absolute bottom-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="searchCodigo"
              placeholder="Digite o código (ex: FE000001)"
              value={searchCodigo}
              onChange={(e) => setSearchCodigo(e.target.value)}
              className="pl-8"
            />
             {isSearching && <Loader2 className="absolute right-2.5 bottom-2.5 h-4 w-4 animate-spin" />}
          </div>

          {!isSearching && foundTool && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-3 animate-in fade-in-50">
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
                    onChange={(e) => setQuantityToAdd(parseInt(e.target.value, 10) || 1)}
                  />
              </div>
            </div>
          )}

          {!isSearching && !foundTool && searchCodigo.length > 4 && (
             <div className="p-4 text-center text-sm text-muted-foreground">
                <p>Nenhuma ferramenta encontrada com este código.</p>
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
