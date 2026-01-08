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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { Tool, Address, Kit } from '@/lib/types';
import { Edit, ZoomIn, Save, Trash2, X, Loader2, Upload, AlertTriangle, FileText, ChevronsUpDown, Check } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';

type DialogTool = Tool & Partial<WithDocId<Tool>>;

interface ToolDetailsDialogProps {
  tool: DialogTool | null;
  isOpen: boolean;
  onClose: () => void;
  onToolUpdated: (updatedTool: any) => void;
  onToolDeleted: (toolId: string) => void;
}

export default function ToolDetailsDialog({ tool, isOpen, onClose, onToolUpdated, onToolDeleted }: ToolDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editableTool, setEditableTool] = useState<Partial<DialogTool>>(tool || {});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [availableAddresses, setAvailableAddresses] = useState<{value: string, label: string}[]>([]);
  const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  useEffect(() => {
    if (tool) {
      setEditableTool(tool);
      setPreviewImage(tool.imageUrl || null);
    }
    // Reset edit mode when dialog is closed or tool changes
    setIsEditing(false);
  }, [tool, isOpen]);
  
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!firestore || !isEditing) return;
      setIsLoadingAddresses(true);
      try {
        const toolsSnapshot = await getDocs(collection(firestore, 'tools'));
        const kitsSnapshot = await getDocs(collection(firestore, 'kits'));
        
        // Create a set of all occupied addresses, but exclude the current tool's address
        const occupiedAddresses = new Set(
          [
            ...toolsSnapshot.docs.map(d => d.data().enderecamento),
            ...kitsSnapshot.docs.map(d => d.data().enderecamento)
          ].filter(addr => !!addr && addr !== tool?.enderecamento)
        );
        
        const addressesRef = collection(firestore, 'addresses');
        const qAddresses = query(addressesRef, where('setor', '==', '01'));
        const addressesSnapshot = await getDocs(qAddresses);
        
        const unoccupied = addressesSnapshot.docs
            .map(doc => doc.data() as Address)
            .filter(addr => addr.codigoCompleto && !occupiedAddresses.has(addr.codigoCompleto))
            .map(addr => ({ value: addr.codigoCompleto, label: addr.codigoCompleto }));
            
        // If the tool has a current address, add it to the list so it can be re-selected
        if (tool?.enderecamento && !unoccupied.some(a => a.value === tool.enderecamento)) {
            unoccupied.unshift({ value: tool.enderecamento, label: tool.enderecamento });
        }
            
        setAvailableAddresses(unoccupied);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar endereços.' });
      } finally {
        setIsLoadingAddresses(false);
      }
    };

    fetchAddresses();
  }, [isEditing, firestore, toast, tool]);


  if (!tool) {
    return null;
  }

  const getStatusVariant = (status: string) => {
    const statusMap: { [key: string]: 'success' | 'destructive' | 'default' | 'warning' } = {
        'Disponível': 'success',
        'Vencido': 'destructive',
        'Bloqueado': 'destructive',
        'Inoperante': 'destructive',
        'Refugo': 'destructive',
        'Pendente': 'default',
        'Em Empréstimo': 'default',
        'Em Aferição': 'default',
        'Liberado Condicional': 'warning',
    }
    return statusMap[status] || 'default';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    setEditableTool(prev => ({
        ...prev,
        [id]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    }));
};

  const handleAddressChange = (value: string) => {
    setEditableTool((prev) => ({ ...prev, enderecamento: value }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async () => {
    if (!firestore || !storage || !tool.docId) {
      toast({ variant: "destructive", title: "Erro", description: "Serviço indisponível ou ID da ferramenta ausente." });
      return;
    }
    setIsSaving(true);
    try {
      const toolRef = doc(firestore, 'tools', tool.docId);
      
      let imageUrl = tool.imageUrl;
      // Se a imagem de preview foi alterada, faz o upload da nova imagem
      if (previewImage && previewImage !== tool.imageUrl) {
        const imageRef = storageRef(storage, `tool_images/${tool.docId}.jpg`);
        const snapshot = await uploadString(imageRef, previewImage, 'data_url');
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const { docId, ...baseData } = editableTool;
      const dataToUpdate = {
        ...baseData,
        valor_estimado: Number(editableTool.valor_estimado) || 0,
        imageUrl: imageUrl, // usa a nova URL ou a antiga
      };

      await updateDoc(toolRef, dataToUpdate);
      onToolUpdated({ ...editableTool, valor_estimado: dataToUpdate.valor_estimado, imageUrl: imageUrl });
      setIsEditing(false);
    } catch (error) {
      console.error("Erro ao atualizar ferramenta:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as alterações." });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteTool = async () => {
     if (!firestore || !storage || !tool.docId) {
      toast({ variant: "destructive", title: "Erro", description: "Serviço indisponível ou ID da ferramenta ausente." });
      return;
    }
    setIsDeleting(true);
     try {
      const toolRef = doc(firestore, 'tools', tool.docId);
      await deleteDoc(toolRef);

      if (tool.imageUrl) {
          try {
              await deleteObject(storageRef(storage, tool.imageUrl));
          } catch (e: any) {
              if (e.code !== 'storage/object-not-found') console.warn("Could not delete image:", e);
          }
      }
      if (tool.doc_engenharia_url) {
           try {
              await deleteObject(storageRef(storage, tool.doc_engenharia_url));
          } catch (e: any) {
              if (e.code !== 'storage/object-not-found') console.warn("Could not delete eng doc:", e);
          }
      }

      onToolDeleted(tool.docId);
    } catch (error) {
      console.error("Erro ao excluir ferramenta:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível excluir a ferramenta." });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Ferramenta" : "Detalhes da Ferramenta"}</DialogTitle>
          <DialogDescription>
            {isEditing ? `Modifique as informações de ${tool.descricao}.` : `Informações completas sobre ${tool.descricao}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative group">
            <Image
              alt={tool.descricao}
              className="aspect-video w-full rounded-md object-cover"
              height="250"
              src={previewImage || tool.imageUrl || "https://picsum.photos/seed/tool/400/250"}
              width="400"
            />
            {!isEditing && tool.imageUrl && (
              <a 
                  href={tool.imageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
              >
                  <ZoomIn className="h-8 w-8 text-white" />
              </a>
            )}
          </div>

          {isEditing ? (
             <div className="grid grid-cols-2 gap-4 text-sm max-h-[40vh] overflow-y-auto pr-4">
                <div className="col-span-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" />
                        Trocar Imagem
                    </Button>
                    <Input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden" 
                        accept="image/png, image/jpeg"
                    />
                </div>
                <div className="col-span-2 space-y-1">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Input id="descricao" value={editableTool.descricao || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="enderecamento">Endereçamento</Label>
                    <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                        <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isAddressPopoverOpen}
                            className="w-full justify-between font-normal"
                            disabled={isLoadingAddresses}
                        >
                            {isLoadingAddresses ? <Loader2 className="h-4 w-4 animate-spin"/> : editableTool.enderecamento || "Selecione..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom" align="start">
                            <Command>
                            <CommandInput placeholder="Pesquisar endereço..." />
                            <CommandList>
                                <CommandEmpty>Nenhum endereço disponível.</CommandEmpty>
                                <CommandGroup>
                                {availableAddresses.map((addr) => (
                                    <CommandItem
                                    key={addr.value}
                                    value={addr.value}
                                    onSelect={(currentValue) => {
                                        handleAddressChange(currentValue === editableTool.enderecamento ? "" : currentValue)
                                        setIsAddressPopoverOpen(false)
                                    }}
                                    >
                                    <Check className={cn("mr-2 h-4 w-4", editableTool.enderecamento === addr.value ? "opacity-100" : "opacity-0")} />
                                    {addr.label}
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="marca">Marca</Label>
                    <Input id="marca" value={editableTool.marca || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="pn_fabricante">P/N Fabricante</Label>
                    <Input id="pn_fabricante" value={editableTool.pn_fabricante || ''} onChange={handleInputChange} />
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="pn_referencia">P/N Referência</Label>
                    <Input id="pn_referencia" value={editableTool.pn_referencia || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="valor_estimado">Valor Estimado (R$)</Label>
                    <Input id="valor_estimado" type="number" value={editableTool.valor_estimado || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="patrimonio">Patrimônio</Label>
                    <Input id="patrimonio" value={editableTool.patrimonio || ''} onChange={handleInputChange} />
                </div>
                <div className="col-span-2 space-y-1">
                    <Label htmlFor="aeronave_aplicavel">Aeronave Aplicável</Label>
                    <Input id="aeronave_aplicavel" value={editableTool.aeronave_aplicavel || ''} onChange={handleInputChange} />
                </div>
            </div>
          ) : (
            <>
              {tool.status === 'Liberado Condicional' && tool.observacao_condicional && (
                <Alert variant="default" className="border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 [&>svg]:text-orange-600 dark:[&>svg]:text-orange-400">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="font-bold">Detalhes da Liberação Condicional</AlertTitle>
                  <AlertDescription>
                    {tool.observacao_condicional}
                  </AlertDescription>
                </Alert>
              )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="col-span-2">
                  <p className="font-semibold text-muted-foreground">Código</p>
                  <p className="font-mono text-base">{tool.codigo || 'N/A'}</p>
                </div>
                 <div className="col-span-2">
                  <p className="font-semibold text-muted-foreground">Descrição</p>
                  <p>{tool.descricao}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Status</p>
                  <Badge variant={getStatusVariant(tool.status || '')}>
                    {tool.status || 'N/A'}
                  </Badge>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Endereçamento</p>
                  <p>{tool.enderecamento || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Marca</p>
                  <p>{tool.marca || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">P/N Fabricante</p>
                  <p>{tool.pn_fabricante || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Aeronave Aplicável</p>
                  <p>{tool.aeronave_aplicavel || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Vencimento</p>
                  <p>{tool.data_vencimento ? new Date(tool.data_vencimento).toLocaleDateString() : 'N/A'}</p>
                </div>
                 <div>
                  <p className="font-semibold text-muted-foreground">Valor Estimado</p>
                  <p>{(tool.valor_estimado ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                {tool.doc_engenharia_url && (
                    <div className="col-span-2">
                         <p className="font-semibold text-muted-foreground">Documento de Engenharia</p>
                         <Button asChild variant="link" className="p-0 h-auto">
                            <a href={tool.doc_engenharia_url} target="_blank" rel="noopener noreferrer" className="text-sm">
                                <FileText className="mr-2 h-4 w-4"/>
                                Visualizar Documento
                            </a>
                         </Button>
                    </div>
                )}
            </div>
            </>
          )}
        </div>
        <DialogFooter className="sm:justify-between flex-wrap gap-2">
            {isEditing ? (
                 <div className="flex w-full justify-between">
                    <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
                        <X className="mr-2 h-4 w-4" />
                        Cancelar
                    </Button>
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar
                    </Button>
                 </div>
            ) : (
                <>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso irá excluir permanentemente a ferramenta
                            <span className="font-bold"> {tool.codigo} ({tool.descricao})</span>.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteTool}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sim, Excluir
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                    </Button>
                    <Button onClick={onClose}>Fechar</Button>
                </div>
                </>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
