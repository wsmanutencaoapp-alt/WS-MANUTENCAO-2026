'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase, useStorage } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Repeat2, FileText, Loader2, Image as ImageIcon, MoreHorizontal, ZoomIn, Search, PlusSquare } from 'lucide-react';
import SectorBudgetStatus from '@/components/SectorBudgetStatus';
import { Checkbox } from '@/components/ui/checkbox';
import LabelPrintDialog from '@/components/LabelPrintDialog';
import ReprintDialog from '@/components/ReprintDialog';
import LabelConfirmationDialog from '@/components/LabelConfirmationDialog';
import AddQuantityDialog from '@/components/AddQuantityDialog';
import type { Tool } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';
import ToolDetailsDialog from '@/components/ToolDetailsDialog';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from '@/firebase/firestore/use-collection';


interface Ferramenta extends Tool {
  docId: string; 
  nome: string; 
  codigo: string; 
  unitCode: string; 
  enderecamento: string; 
  status: string; 
  quantidade_estoque: number;
  is_calibrable: boolean; 
  aeronave_principal: string | null;
  label_url: string | null;
}

type ToolLabelData = Partial<Ferramenta> & { id?: string };

const Equipamentos = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const ferramentasQueryKey = 'ferramentas';

  const ferramentasCollectionRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tools'), orderBy('codigo', 'desc')) : null),
    [firestore]
  );
  
  const { data: ferramentas, isLoading, error: firestoreError } = useCollection<Ferramenta>(ferramentasCollectionRef, {
    queryKey: [ferramentasQueryKey]
  });

  const [isNewToolDialogOpen, setIsNewToolDialogOpen] = useState(false);
  const [isAddQuantityDialogOpen, setIsAddQuantityDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [toolsToLabel, setToolsToLabel] = useState<ToolLabelData[]>([]);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [toolsToConfirm, setToolsToConfirm] = useState<ToolLabelData[]>([]);

  const [isReprintDialogOpen, setIsReprintDialogOpen] = useState(false);
  const [toolToReprint, setToolToReprint] = useState<ToolLabelData | null>(null);

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Ferramenta | null>(null);
  
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);


  const [newFerramenta, setNewFerramenta] = useState({
    name: '',
    enderecamento: '',
    aeronave_principal: '',
    quantidade_estoque: 1,
    is_calibrable: true,
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === 'quantidade_estoque') {
      const num = parseInt(value) || 0;
      setNewFerramenta((prev) => ({ ...prev, [id]: num > 0 ? num : 1 }));
    } else {
      setNewFerramenta((prev) => ({ ...prev, [id]: value }));
    }
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

  const resetForm = () => {
    setNewFerramenta({ name: '', enderecamento: '', aeronave_principal: '', quantidade_estoque: 1, is_calibrable: true });
    setPreviewImage(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleCheckboxChange = (checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      setNewFerramenta((prev) => ({ ...prev, is_calibrable: checked }));
    }
  };
  
  const handleSaveNewTool = async () => {
    if (!newFerramenta.name) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nome é um campo obrigatório.' });
      return;
    }
    if (!user || !firestore || !storage) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado ou falha na conexão.' });
      return;
    }
  
    setIsSaving(true);
    const insertedTools: ToolLabelData[] = [];
  
    try {
      let imageUrl = "https://picsum.photos/seed/tool/200/200"; // Placeholder
      if (previewImage) {
        try {
          const tempId = doc(collection(firestore, 'temp')).id;
          const imageRef = storageRef(storage, `tool_images/${tempId}`);
          const snapshot = await uploadString(imageRef, previewImage, 'data_url');
          imageUrl = await getDownloadURL(snapshot.ref);
        } catch (storageError) {
          console.error("Erro no upload da imagem:", storageError);
          toast({ variant: 'destructive', title: 'Erro de Upload', description: 'Não foi possível salvar a imagem. Verifique as permissões do Storage.' });
          setIsSaving(false);
          return;
        }
      }
  
      const counterRef = doc(firestore, 'counters', 'tools');
      const mainToolCode = await runTransaction(firestore, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (!counterDoc.exists()) {
              transaction.set(counterRef, { lastId: 1 });
              return 1;
          }
          const newId = counterDoc.data().lastId + 1;
          transaction.update(counterRef, { lastId: newId });
          return newId;
      }).catch(error => {
          const permissionError = new FirestorePermissionError({
            path: counterRef.path,
            operation: 'write', 
            requestResourceData: { lastId: 'newId' }
          });
          errorEmitter.emit('permission-error', permissionError);
          throw permissionError;
      });
  
      const codigo = `FE${mainToolCode.toString().padStart(6, '0')}`;
  
      for (let i = 0; i < newFerramenta.quantidade_estoque; i++) {
        const toolDocRef = doc(collection(firestore, 'tools'));
        const unitCode = `A${(i + 1).toString().padStart(4, '0')}`;
  
        const toolData: Omit<Tool, 'id'> = {
          name: newFerramenta.name,
          enderecamento: newFerramenta.enderecamento,
          aeronave_principal: newFerramenta.aeronave_principal || null,
          is_calibrable: newFerramenta.is_calibrable,
          status: 'Disponível',
          lastCalibration: 'N/A',
          calibratedBy: 'N/A',
          serialNumber: `SN-${Date.now()}-${i}`,
          imageUrl: imageUrl,
          imageHint: "tool",
          codigo: codigo,
          unitCode: unitCode,
        };
  
        await setDoc(toolDocRef, toolData).catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: toolDocRef.path,
            operation: 'create',
            requestResourceData: toolData
          }));
          throw error; 
        });
        insertedTools.push({ ...toolData, id: toolDocRef.id });
      }
  
      toast({ title: "Sucesso!", description: `${newFerramenta.quantidade_estoque} unidade(s) de ${newFerramenta.name} cadastrada(s).` });
      
      resetForm();
      queryClient.invalidateQueries({ queryKey: [ferramentasQueryKey] });
      setToolsToConfirm(insertedTools);
      setIsConfirmationDialogOpen(true);
      setIsNewToolDialogOpen(false);
  
    } catch (error) {
      if (!(error instanceof FirestorePermissionError)) {
          console.error("Erro ao salvar ferramenta:", error);
          toast({ variant: "destructive", title: "Erro ao Salvar", description: `Não foi possível cadastrar o equipamento. Verifique as permissões.` });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddQuantitySuccess = (newTools: ToolLabelData[]) => {
    setIsAddQuantityDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: [ferramentasQueryKey] });
    setToolsToLabel(newTools); 
  };

  const handleFinalizeCadastro = () => {
    setToolsToLabel(toolsToConfirm);
    setIsConfirmationDialogOpen(false);
    setToolsToConfirm([]);
  };

  const handleOpenReprintDialog = (tool: Ferramenta) => {
    setToolToReprint({ id: tool.docId, codigo: tool.codigo, name: tool.name, label_url: tool.label_url, unitCode: tool.unitCode, enderecamento: tool.enderecamento });
    setIsReprintDialogOpen(true);
  };
  
  const handleReprintConfirmed = (tools: ToolLabelData[]) => {
    setToolsToLabel(tools);
    setIsReprintDialogOpen(false);
    setToolToReprint(null);
  };
  
  const handleOpenDetails = (tool: Ferramenta) => {
    setSelectedTool(tool);
    setIsDetailsDialogOpen(true);
  };

  const handleToolDeleted = (toolId: string) => {
    queryClient.invalidateQueries({ queryKey: [ferramentasQueryKey] });
    setIsDetailsDialogOpen(false);
    toast({
        title: "Sucesso!",
        description: "A ferramenta foi excluída."
    });
  };

  const handleToolUpdated = (updatedTool: Ferramenta) => {
    queryClient.invalidateQueries({ queryKey: [ferramentasQueryKey] });
    toast({
        title: "Sucesso!",
        description: "As informações da ferramenta foram atualizadas."
    });
  };
  
  const openImagePreview = (imageUrl: string) => {
    setPreviewImageUrl(imageUrl);
    setIsPreviewDialogOpen(true);
  };

  const filteredFerramentas = useMemo(() => {
    if (!ferramentas) return [];
    if (!searchTerm) return ferramentas;

    const lowercasedTerm = searchTerm.toLowerCase();
    return ferramentas.filter(ferramenta => 
        (ferramenta.name && ferramenta.name.toLowerCase().includes(lowercasedTerm)) ||
        (ferramenta.codigo && ferramenta.codigo.toLowerCase().includes(lowercasedTerm))
    );
  }, [ferramentas, searchTerm]);

  const getStatusVariant = (status: string) => {
    return status === 'Disponível' || status === 'Available' ? 'success' : 'default';
  };

  const translateStatus = (status: string) => {
    return status === 'Available' ? 'Disponível' : status;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cadastro de Ferramentas</h1>

      <SectorBudgetStatus />

      <div className="flex items-center justify-end gap-2">
         <Button variant="outline" onClick={() => setIsAddQuantityDialogOpen(true)}>
            <PlusSquare className="mr-2 h-4 w-4" />
            Adicionar Quantidade
         </Button>

        <Dialog open={isNewToolDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) resetForm();
            setIsNewToolDialogOpen(isOpen);
        }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Ferramenta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Ferramenta</DialogTitle>
              <DialogDescription>
                O código da ferramenta e o lote serão gerados automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Nome
                </Label>
                <Input id="name" value={newFerramenta.name} onChange={handleInputChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="enderecamento" className="text-right">
                  Endereçamento
                </Label>
                <Input id="enderecamento" value={newFerramenta.enderecamento} onChange={handleInputChange} className="col-span-3" placeholder="Ex: Gaveta 1A" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="aeronave_principal" className="text-right">
                  Aeronave Principal
                </Label>
                <Input id="aeronave_principal" value={newFerramenta.aeronave_principal} onChange={handleInputChange} className="col-span-3" placeholder="Ex: PR-ABC" />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="quantidade_estoque" className="text-right">
                  Qtd. Unidades
                </Label>
                <Input 
                    id="quantidade_estoque" 
                    type="number" 
                    step="1"
                    min="1"
                    value={newFerramenta.quantidade_estoque} 
                    onChange={handleInputChange} 
                    className="col-span-3" 
                    required 
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="is_calibrable" className="text-right">
                  Calibrável?
                </Label>
                <div className="col-span-3 flex items-center space-x-2">
                  <Checkbox
                    id="is_calibrable"
                    checked={newFerramenta.is_calibrable}
                    onCheckedChange={handleCheckboxChange}
                  />
                  <Label htmlFor="is_calibrable" className="text-sm font-normal">
                    Requer controle de calibração.
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">
                  Imagem
                </Label>
                <div className="col-span-3 flex items-center gap-4">
                    {previewImage ? (
                        <Image src={previewImage} alt="Preview" width={48} height={48} className="rounded-md object-cover" />
                    ) : (
                        <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md">
                           <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        Anexar Imagem
                    </Button>
                    <Input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden" 
                        accept="image/png, image/jpeg"
                    />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewToolDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveNewTool} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Ferramentas</CardTitle>
          <CardDescription>
            Pesquise e gerencie os equipamentos cadastrados.
          </CardDescription>
            <div className="relative pt-4">
               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                   placeholder="Pesquisar por nome ou código..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
               />
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px] sm:table-cell">Imagem</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Lote/Unid.</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Endereçamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow key="loading">
                  <TableCell colSpan={7} className="text-center">Carregando...</TableCell>
                </TableRow>
              ) : firestoreError ? (
                 <TableRow key="error">
                  <TableCell colSpan={7} className="text-center text-destructive">
                    Erro ao carregar ferramentas: {firestoreError.message}
                  </TableCell>
                </TableRow>
              ) : filteredFerramentas && filteredFerramentas.length > 0 ? (
                filteredFerramentas.map((ferramenta) => (
                  <TableRow key={ferramenta.docId}>
                    <TableCell className="hidden sm:table-cell">
                        <button
                          onClick={() => openImagePreview(ferramenta.imageUrl || "https://picsum.photos/seed/tool/64/64")}
                          className="relative group focus:outline-none"
                        >
                          <Image
                              alt={ferramenta.name}
                              className="aspect-square rounded-md object-cover"
                              height="64"
                              src={ferramenta.imageUrl || "https://picsum.photos/seed/tool/64/64"}
                              width="64"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity rounded-md">
                            <ZoomIn className="h-6 w-6 text-white" />
                          </div>
                        </button>
                    </TableCell>
                    <TableCell className="font-medium">{ferramenta.codigo}</TableCell>
                    <TableCell className="font-mono text-xs">{ferramenta.unitCode}</TableCell>
                    <TableCell>{ferramenta.name}</TableCell>
                    <TableCell>{ferramenta.enderecamento}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(ferramenta.status)}>
                        {translateStatus(ferramenta.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDetails(ferramenta)}
                        title="Detalhes"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenReprintDialog(ferramenta)}
                        title="Reimprimir Etiqueta"
                      >
                        <Repeat2 className="h-4 w-4" />
                      </Button>
                      {ferramenta.label_url && (
                        <a
                          href={ferramenta.label_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center text-primary hover:text-primary/80"
                          title="Ver Etiqueta Salva"
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow key="no-results">
                  <TableCell colSpan={7} className="text-center">Nenhuma ferramenta encontrada.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <AddQuantityDialog
        isOpen={isAddQuantityDialogOpen}
        onClose={() => setIsAddQuantityDialogOpen(false)}
        onSuccess={handleAddQuantitySuccess}
      />
      
      <LabelPrintDialog 
        tools={toolsToLabel} 
        isOpen={toolsToLabel.length > 0} 
        onClose={() => setToolsToLabel([])} 
      />
      
      {toolsToConfirm.length > 0 && (
          <LabelConfirmationDialog
              tool={toolsToConfirm[0]}
              isOpen={isConfirmationDialogOpen}
              onConfirm={handleFinalizeCadastro}
              onCancel={() => {
                  setIsConfirmationDialogOpen(false);
                  setToolsToConfirm([]);
              }}
          />
      )}
      
      <ReprintDialog
        tool={toolToReprint}
        isOpen={isReprintDialogOpen}
        onClose={() => setIsReprintDialogOpen(false)}
        onReprintConfirmed={handleReprintConfirmed}
      />

      <ToolDetailsDialog
        tool={selectedTool}
        isOpen={isDetailsDialogOpen}
        onClose={() => setIsDetailsDialogOpen(false)}
        onToolDeleted={handleToolDeleted}
        onToolUpdated={handleToolUpdated}
      />

      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Visualização da Imagem</DialogTitle>
          </DialogHeader>
          {previewImageUrl && (
            <div className="relative mt-4" style={{ paddingBottom: '75%' }}>
              <Image
                src={previewImageUrl}
                alt="Visualização ampliada da ferramenta"
                layout="fill"
                className="object-contain"
              />
            </div>
          )}
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>Fechar</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Equipamentos;

    