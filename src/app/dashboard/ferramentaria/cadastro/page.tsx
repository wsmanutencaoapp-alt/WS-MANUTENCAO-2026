'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Repeat2, FileText, Loader2, Image as ImageIcon, MoreHorizontal, ZoomIn } from 'lucide-react';
import SectorBudgetStatus from '@/components/SectorBudgetStatus';
import { Checkbox } from '@/components/ui/checkbox';
import LabelPrintDialog from '@/components/LabelPrintDialog';
import ReprintDialog from '@/components/ReprintDialog';
import LabelConfirmationDialog from '@/components/LabelConfirmationDialog';
import type { Tool } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';
import ToolDetailsDialog from '@/components/ToolDetailsDialog';

// A interface foi adaptada para corresponder ao que é usado no componente
interface Ferramenta extends Tool {
  id: string; // Já existe em Tool (como 'id')
  nome: string; // Mapeia para 'name'
  codigo: string; // Adicionado
  enderecamento: string; // Adicionado
  status: string; // Já existe
  quantidade_estoque: number; // Adicionado
  is_calibrable: boolean; // Adicionado
  aeronave_principal: string | null; // Adicionado
  label_url: string | null; // Adicionado
}

type ToolLabelData = Partial<Ferramenta>;

const Equipamentos = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ferramentasCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'tools') : null),
    [firestore]
  );
  
  const { data: ferramentas, isLoading, error: firestoreError, setData: setFerramentas } = useCollection<Ferramenta>(ferramentasCollectionRef);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para Impressão
  const [toolsToLabel, setToolsToLabel] = useState<ToolLabelData[]>([]);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [toolsToConfirm, setToolsToConfirm] = useState<ToolLabelData[]>([]);

  // Estados para Reimpressão
  const [isReprintDialogOpen, setIsReprintDialogOpen] = useState(false);
  const [toolToReprint, setToolToReprint] = useState<ToolLabelData | null>(null);

  // Estados para Detalhes
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Ferramenta | null>(null);
  
  // Estado para o preview da imagem
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
  
  const handleSave = async () => {
    if (!newFerramenta.name) {
      toast({ variant: "destructive", title: "Erro", description: "Nome é um campo obrigatório." });
      return;
    }
    if (!user || !firestore || !storage) {
      toast({ variant: "destructive", title: "Erro", description: "Usuário não autenticado ou falha na conexão com os serviços. Tente novamente." });
      return;
    }
  
    setIsSaving(true);
    const numUnits = newFerramenta.quantidade_estoque;
    const insertedTools: Ferramenta[] = [];
  
    try {
      // 1. Fazer o upload da imagem primeiro (se existir)
      let imageUrl = "https://picsum.photos/seed/tool/200/200"; // Placeholder
      let imageHint = "tool";
      if (previewImage) {
        const tempId = doc(collection(firestore, 'temp')).id; // ID temporário para a imagem
        const imageRef = storageRef(storage, `tool_images/${tempId}`);
        const snapshot = await uploadString(imageRef, previewImage, 'data_url');
        imageUrl = await getDownloadURL(snapshot.ref);
      }
  
      // 2. Loop para criar os documentos no Firestore
      for (let i = 0; i < numUnits; i++) {
        const toolDocRef = doc(collection(firestore, 'tools'));
        const codigo = `TOOL-${toolDocRef.id.substring(0, 4).toUpperCase()}`;
  
        const toolData = {
          name: newFerramenta.name,
          enderecamento: newFerramenta.enderecamento,
          aeronave_principal: newFerramenta.aeronave_principal || null,
          is_calibrable: newFerramenta.is_calibrable,
          status: 'Available',
          lastCalibration: 'N/A', // Campo placeholder
          calibratedBy: 'N/A', // Campo placeholder
          serialNumber: `SN-${Date.now()}-${i}`, // Campo placeholder
          imageUrl: imageUrl,
          imageHint: imageHint,
          codigo: codigo,
        };
  
        // Salva o documento no Firestore
        await setDoc(toolDocRef, toolData).catch(error => {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: toolDocRef.path,
              operation: 'create',
              requestResourceData: toolData,
            })
          );
          throw error; // Interrompe o loop em caso de erro
        });
        
        insertedTools.push({ ...newFerramenta, id: toolDocRef.id, codigo, imageUrl: toolData.imageUrl } as Ferramenta);
      }
  
      toast({ title: "Sucesso!", description: `${numUnits} equipamento(s) sendo processado(s).` });
      
      resetForm();
      setToolsToConfirm(insertedTools);
      setIsConfirmationDialogOpen(true);
      setIsDialogOpen(false);
  
    } catch (error) {
      if (!(error instanceof FirestorePermissionError)) {
        console.error("Erro ao salvar ferramenta:", error);
        toast({ variant: "destructive", title: "Erro ao Salvar", description: `Não foi possível cadastrar o equipamento. Verifique as permissões do Firebase.` });
      }
    } finally {
        setIsSaving(false);
    }
  };

  const handleFinalizeCadastro = () => {
    setIsConfirmationDialogOpen(false);
    setToolsToConfirm([]);
  };

  const handleOpenReprintDialog = (tool: Ferramenta) => {
    setToolToReprint({ id: tool.id, codigo: tool.codigo, nome: tool.name, label_url: tool.label_url });
    setIsReprintDialogOpen(true);
  };
  
  const handleReprintConfirmed = async (tool: ToolLabelData) => {
    setIsReprintDialogOpen(false);
    toast({ title: "Reimpressão", description: `Etiqueta para ${tool.codigo} será gerada.` });
  };
  
  const handleOpenDetails = (tool: Ferramenta) => {
    setSelectedTool(tool);
    setIsDetailsDialogOpen(true);
  };

  const handleToolDeleted = (toolId: string) => {
    if (ferramentas) {
        setFerramentas(ferramentas.filter(t => t.id !== toolId));
    }
    setIsDetailsDialogOpen(false);
    toast({
        title: "Sucesso!",
        description: "A ferramenta foi excluída."
    });
  };

  const handleToolUpdated = (updatedTool: Ferramenta) => {
    if (ferramentas) {
        setFerramentas(ferramentas.map(t => t.id === updatedTool.id ? updatedTool : t));
    }
    toast({
        title: "Sucesso!",
        description: "As informações da ferramenta foram atualizadas."
    });
  };
  
  const openImagePreview = (imageUrl: string) => {
    setPreviewImageUrl(imageUrl);
    setIsPreviewDialogOpen(true);
  };


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cadastro de Ferramentas</h1>

      <SectorBudgetStatus />

      <div className="flex items-center justify-end">
        <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) resetForm();
            setIsDialogOpen(isOpen);
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
                O código da ferramenta será gerado automaticamente.
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
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving}>
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
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px] sm:table-cell">Imagem</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Endereçamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Calibrável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Carregando...</TableCell>
                </TableRow>
              ) : firestoreError ? (
                 <TableRow>
                  <TableCell colSpan={7} className="text-center text-destructive">
                    Erro ao carregar ferramentas: Você não tem permissão para ver estes dados.
                  </TableCell>
                </TableRow>
              ) : ferramentas && ferramentas.length > 0 ? (
                ferramentas.map((ferramenta) => (
                  <TableRow key={ferramenta.id}>
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
                    <TableCell>{ferramenta.name}</TableCell>
                    <TableCell>{ferramenta.enderecamento}</TableCell>
                    <TableCell>{ferramenta.status}</TableCell>
                    <TableCell>{ferramenta.is_calibrable ? 'Sim' : 'Não'}</TableCell>
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
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Nenhuma ferramenta cadastrada.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
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
