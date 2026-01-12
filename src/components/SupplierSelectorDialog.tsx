'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, Search } from 'lucide-react';
import type { Supplier } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';

interface SupplierSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (supplier: WithDocId<Supplier>) => void;
  suppliers: WithDocId<Supplier>[];
  isLoading: boolean;
}

export default function SupplierSelectorDialog({
  isOpen,
  onClose,
  onSelect,
  suppliers,
  isLoading,
}: SupplierSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Fornecedor</DialogTitle>
          <DialogDescription>
            Pesquise e selecione um fornecedor para este orçamento.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
