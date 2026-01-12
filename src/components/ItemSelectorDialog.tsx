'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search } from 'lucide-react';
import { Button } from './ui/button';

interface ItemSelectorProps<T> {
  isOpen: boolean;
  onClose: () => void;
  items: T[];
  onSelect: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  filterFunction: (items: T[], searchTerm: string) => T[];
  title: string;
  description: string;
  isLoading?: boolean;
}

export default function ItemSelectorDialog<T>({
  isOpen,
  onClose,
  items,
  onSelect,
  renderItem,
  filterFunction,
  title,
  description,
  isLoading = false
}: ItemSelectorProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    return filterFunction(items || [], searchTerm);
  }, [items, searchTerm, filterFunction]);

  const handleSelect = (item: T) => {
    onSelect(item);
    // Do not close the dialog, allow multiple selections
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4 max-h-[60vh]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por código, P/N ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
          <ScrollArea className="h-72 border rounded-md">
            <div className="p-2 space-y-1">
              {isLoading && <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />}
              {!isLoading && filteredItems.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {searchTerm ? 'Nenhum item encontrado.' : 'Digite para começar a buscar.'}
                </p>
              )}
              {!isLoading && filteredItems.map((item, index) => (
                 <Button 
                    key={index}
                    variant="ghost" 
                    className="w-full justify-start h-auto p-2"
                    onClick={() => handleSelect(item)}
                 >
                    {renderItem(item)}
                 </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
