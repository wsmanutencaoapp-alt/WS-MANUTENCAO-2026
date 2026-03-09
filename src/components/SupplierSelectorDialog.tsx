'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, Search, PlusCircle, ArrowLeft } from 'lucide-react';
import type { Supplier } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';

interface SupplierSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (supplier: WithDocId<Supplier>) => void;
}

export default function SupplierSelectorDialog({
  isOpen,
  onClose,
  onSelect,
}: SupplierSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    cnpj: '',
    contactEmail: '',
    contactPhone: '',
    segmento: '',
  });
  const [isSaving, setIsSaving] = useState(false);


  const suppliersQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'suppliers')) : null
  ), [firestore]);

  const { data: suppliers, isLoading } = useCollection<WithDocId<Supplier>>(suppliersQuery, {
    queryKey: ['allSuppliersForSelection'],
    enabled: isOpen,
  });

  const filteredSuppliers = useMemo(() => {
    if (isLoading || !suppliers) return [];
    if (!searchTerm) return suppliers;
    const lowercasedTerm = searchTerm.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(lowercasedTerm) ||
        s.cnpj.toLowerCase().includes(lowercasedTerm)
    );
  }, [suppliers, searchTerm, isLoading]);

  const handleSelect = (supplier: WithDocId<Supplier>) => {
    onSelect(supplier);
    onClose();
  };

  const handleCloseDialog = () => {
    setShowCreateForm(false);
    setNewSupplierData({ name: '', cnpj: '', contactEmail: '', contactPhone: '', segmento: '' });
    onClose();
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { id, value } = e.target;
      setNewSupplierData(prev => ({...prev, [id]: value}));
  }

  const handleSaveNewSupplier = async () => {
    if (!firestore) return;
    if (!newSupplierData.name || !newSupplierData.cnpj) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Nome e CNPJ são obrigatórios.' });
        return;
    }
    setIsSaving(true);
    try {
        await addDoc(collection(firestore, 'suppliers'), {
            ...newSupplierData,
            rating: 0
        });
        toast({ title: 'Sucesso', description: 'Novo fornecedor cadastrado.' });
        queryClient.invalidateQueries({ queryKey: ['allSuppliersForSelection'] });
        setShowCreateForm(false); 
        setNewSupplierData({ name: '', cnpj: '', contactEmail: '', contactPhone: '', segmento: '' }); 
    } catch(err) {
        console.error("Erro ao salvar fornecedor:", err);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar o novo fornecedor.' });
    } finally {
        setIsSaving(false);
    }
  }


  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {showCreateForm ? 'Cadastrar Novo Fornecedor' : 'Selecionar Fornecedor'}
          </DialogTitle>
          <DialogDescription>
            {showCreateForm 
              ? 'Preencha os dados do novo fornecedor.'
              : 'Pesquise e selecione um fornecedor para este orçamento.'
            }
          </DialogDescription>
        </DialogHeader>

        {showCreateForm ? (
            <div className="py-4 space-y-4">
                <div className="space-y-1"><Label htmlFor="name">Nome</Label><Input id="name" value={newSupplierData.name} onChange={handleInputChange} autoFocus /></div>
                <div className="space-y-1"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" value={newSupplierData.cnpj} onChange={handleInputChange} /></div>
                <div className="space-y-1"><Label htmlFor="segmento">Segmento</Label><Input id="segmento" value={newSupplierData.segmento} onChange={handleInputChange} placeholder="Ex: Usinagem, Matéria-Prima"/></div>
                <div className="space-y-1"><Label htmlFor="contactEmail">E-mail</Label><Input id="contactEmail" type="email" value={newSupplierData.contactEmail} onChange={handleInputChange}/></div>
                <div className="space-y-1"><Label htmlFor="contactPhone">Telefone</Label><Input id="contactPhone" value={newSupplierData.contactPhone} onChange={handleInputChange}/></div>
            </div>
        ) : (
            <div className="py-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
              </div>
              <ScrollArea className="h-72 border rounded-md">
                <div className="p-2 space-y-1">
                  {isLoading ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : filteredSuppliers.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Nenhum fornecedor encontrado.
                    </p>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <Button
                        key={supplier.docId}
                        variant="ghost"
                        className="w-full justify-start h-auto p-2 text-left"
                        onClick={() => handleSelect(supplier)}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold">{supplier.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {supplier.cnpj}
                          </span>
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
        )}
        
        <DialogFooter>
          {showCreateForm ? (
            <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={() => setShowCreateForm(false)} disabled={isSaving}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para a Lista
              </Button>
              <Button onClick={handleSaveNewSupplier} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  Salvar Fornecedor
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowCreateForm(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Cadastrar Novo Fornecedor
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
