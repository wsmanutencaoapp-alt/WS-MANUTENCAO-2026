

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
  getDoc,
  limit,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, uploadString } from 'firebase/storage';
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase, useStorage, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, FileText, Loader2, Image as ImageIcon, AlertTriangle, Upload, Paperclip, MoreHorizontal, Trash2, Edit, Check, ChevronsUpDown } from 'lucide-react';
import type { Tool, Employee, Address } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import LabelPrintDialog from '@/components/LabelPrintDialog';
import { useRouter } from 'next/navigation';
import { ToolingAlertHeader } from '@/components/ToolingAlertHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';


const familiaSuggestions: { [key in Tool['familia']]?: Tool['classificacao'] } = {
    TRQ: 'C', PRE: 'C', ELE: 'C', RIG: 'L', MET: 'C', SEG: 'V', MEC: 'N',
};

const CadastroFerramentasPage = () => {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docEngenhariaInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  const queryClient = useQueryClient();
  const allToolsQueryKey = 'allToolsForCadastroPage';

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [editingTool, setEditingTool] = useState<WithDocId<Tool> | null>(null);
  const [toolsToPrint, setToolsToPrint] = useState<any[]>([]);
  const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false);

  const [newFerramenta, setNewFerramenta] = useState<Partial<Tool>>({
      tipo: 'STD', familia: 'MEC', classificacao: 'N', descricao: '',
      pn_fabricante: '', pn_referencia: '', aeronave_aplicavel: '',
      enderecamento: '', status: 'Disponível', valor_estimado: 0,
  });

  const [generatedCode, setGeneratedCode] = useState('Gerado Automaticamente');
  const [toolImage, setToolImage] = useState<string | null>(null);
  const [docEngenhariaFile, setDocEngenhariaFile] = useState<File | null>(null);
  
  const [availableAddresses, setAvailableAddresses] = useState<{value: string, label: string}[]>([]);
  const [isAddressPopoverOpen, setIsAddressPopoverOpen] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData, isLoading: isEmployeeLoading } = useDoc<Employee>(userDocRef);

  const canFetchTools = useMemo(() => {
    if (isEmployeeLoading || !employeeData) return false;
    return employeeData.accessLevel === 'Admin' || (employeeData.permissions?.ferramentaria ?? false);
  }, [employeeData, isEmployeeLoading]);

  const allToolsQuery = useMemoFirebase(() => {
    if (firestore && canFetchTools) {
      return query(collection(firestore, 'tools'), orderBy('codigo'));
    }
    return null;
  }, [firestore, canFetchTools]);
  
  const { data: allTools, isLoading: isLoadingTools, error: toolsError } = useCollection<Tool>(allToolsQuery, {
    queryKey: [allToolsQueryKey],
    enabled: canFetchTools,
  });

  const [modelos, ferramentasUnicas] = useMemo(() => {
    if (!allTools) return [[], []];
    const modelos: WithDocId<Tool>[] = [];
    const unicas: WithDocId<Tool>[] = [];
    allTools.forEach(tool => {
        if (tool.enderecamento === 'LOGICA') {
            modelos.push(tool);
        } else {
            unicas.push(tool);
        }
    });
    return [modelos, unicas];
  }, [allTools]);
  
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!isFormDialogOpen || !firestore) return;
      setIsLoadingAddresses(true);
      try {
        const addressesRef = collection(firestore, 'addresses');
        const qAddresses = query(addressesRef, where('setor', '==', '01')); // Ferramentaria
        const addressesSnapshot = await getDocs(qAddresses);
        const allFerramentariaAddresses = addressesSnapshot.docs.map(doc => doc.data() as Address);

        const toolsRef = collection(firestore, 'tools');
        const toolsSnapshot = await getDocs(toolsRef);
        const occupiedAddresses = new Set(
          toolsSnapshot.docs
            .map(doc => doc.data().enderecamento)
            .filter(addr => !!addr && addr !== editingTool?.enderecamento) // Exclude the current tool's address
        );
        
        const unoccupied = allFerramentariaAddresses
            .filter(addr => !occupiedAddresses.has(addr.codigoCompleto))
            .map(addr => ({ value: addr.codigoCompleto, label: addr.codigoCompleto }));
            
        setAvailableAddresses(unoccupied);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar endereços.' });
      } finally {
        setIsLoadingAddresses(false);
      }
    };

    fetchAddresses();
  }, [isFormDialogOpen, firestore, toast, editingTool]);
  

  useEffect(() => {
    const { tipo, familia, classificacao } = newFerramenta;
    if (tipo && familia && classificacao) {
      setGeneratedCode(`${tipo}-${familia}-${classificacao}-XXXX`);
    }
  }, [newFerramenta.tipo, newFerramenta.familia, newFerramenta.classificacao]);

  useEffect(() => {
    if (newFerramenta.familia && !editingTool) {
      const suggestedClassificacao = familiaSuggestions[newFerramenta.familia as keyof typeof familiaSuggestions];
      if (suggestedClassificacao) {
        setNewFerramenta(prev => ({ ...prev, classificacao: suggestedClassificacao }));
      }
    }
  }, [newFerramenta.familia, editingTool]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    setNewFerramenta(prev => ({
        ...prev,
        [id]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    }));
};

  const handleSelectChange = (id: keyof Tool, value: string) => {
    setNewFerramenta(prev => ({ ...prev, [id]: value }));
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setToolImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDocEngenhariaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setDocEngenhariaFile(file);
    }
  };


  const resetForm = () => {
    setNewFerramenta({
      tipo: 'STD', familia: 'MEC', classificacao: 'N', descricao: '',
      pn_fabricante: '', pn_referencia: '', aeronave_aplicavel: '',
      enderecamento: '', status: 'Disponível', valor_estimado: 0,
    });
    setToolImage(null);
    setDocEngenhariaFile(null);
    setEditingTool(null);
    if(fileInputRef.current) fileInputRef.current.value = '';
    if(docEngenhariaInputRef.current) docEngenhariaInputRef.current.value = '';
  };


  const uploadFile = async (file: File, path: string): Promise<string> => {
    if (!storage) throw new Error("Storage service not available.");
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };
  
  const uploadImageAsDataUrl = async (dataUrl: string, path: string): Promise<string> => {
    if (!storage) throw new Error("Storage service not available.");
    const imageRef = storageRef(storage, path);
    const snapshot = await uploadString(imageRef, dataUrl, 'data_url');
    return getDownloadURL(snapshot.ref);
  };

  const handleSaveTool = async () => {
    if (!user || !firestore || !storage) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado ou falha na conexão.' });
        return;
    }
    const isTemplate = newFerramenta.tipo === 'STD' || newFerramenta.tipo === 'GSE';
    
    if (newFerramenta.tipo === 'ESP' && !newFerramenta.pn_fabricante) {
      toast({ variant: "destructive", description: "P/N Fabricante é obrigatório para tipo 'Especial'." }); return;
    }
    if (newFerramenta.tipo === 'EQV' && !newFerramenta.pn_referencia) {
      toast({ variant: "destructive", description: "P/N Referência é obrigatório para tipo 'Equivalente'." }); return;
    }
     if (newFerramenta.tipo === 'EQV' && !docEngenhariaFile && !editingTool?.doc_engenharia_url) {
      toast({ variant: "destructive", description: "Doc. Engenharia é obrigatório para tipo 'Equivalente'." }); return;
    }
     if (!toolImage && !editingTool?.imageUrl) {
      toast({ variant: "destructive", description: "A imagem de referência é obrigatória." }); return;
    }
    if (!isTemplate && !newFerramenta.enderecamento) {
        toast({ variant: "destructive", description: "Endereçamento é obrigatório para cadastro de ferramenta única (ESP/EQV)." }); return;
    }
  
    setIsSaving(true);
  
    const tempId = doc(collection(firestore, 'temp')).id;
    const toolDocId = editingTool?.docId || tempId;
    
    let imageUrl = editingTool?.imageUrl;
    if (toolImage && toolImage.startsWith('data:')) {
        imageUrl = await uploadImageAsDataUrl(toolImage, `tool_images/${toolDocId}.jpg`).catch((err) => {
            console.error("Image upload failed:", err);
            throw err;
        });
    }

    let docEngenhariaUrl = editingTool?.doc_engenharia_url;
    if (docEngenhariaFile) {
        docEngenhariaUrl = await uploadFile(docEngenhariaFile, `doc_engenharia/${toolDocId}_${docEngenhariaFile.name}`).catch((err) => {
            console.error("Doc upload failed:", err);
            throw err;
        });
    }
    
    const baseToolData: Partial<Tool> = {
        ...newFerramenta,
        valor_estimado: Number(newFerramenta.valor_estimado) || 0,
        imageUrl: imageUrl,
        doc_engenharia_url: docEngenhariaUrl
    };
    Object.keys(baseToolData).forEach(key => baseToolData[key as keyof Partial<Tool>] === undefined && delete baseToolData[key as keyof Partial<Tool>]);
    
    if (!editingTool) { // Creating new tool
        const { tipo, familia, classificacao } = newFerramenta;
        if (!tipo || !familia || !classificacao) {
            toast({ variant: "destructive", description: "Tipo, Família e Classificação são obrigatórios." });
            setIsSaving(false);
            return;
        }
        
        let sequencial = 0;
        if(!isTemplate) {
          const counterRef = doc(firestore, 'counters', `${tipo}-${familia}-${classificacao}`);
          try {
            sequencial = await runTransaction(firestore, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                if (!counterDoc.exists()) {
                    transaction.set(counterRef, { lastId: 0 });
                    return 0;
                }
                const newId = (counterDoc.data()?.lastId ?? 0) + 1;
                transaction.update(counterRef, { lastId: newId });
                return newId;
            });
          } catch(e) {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                  path: counterRef.path, operation: 'write', requestResourceData: { lastId: 'increment' }
              }));
              setIsSaving(false);
              return;
          }
        }
       
        const codigoCompleto = `${tipo}-${familia}-${classificacao}-${sequencial.toString().padStart(4, '0')}`;
        const status: Tool['status'] = tipo === 'EQV' ? 'Pendente' : 'Disponível';

        const toolData: Omit<Tool, 'id'> = {
            ...(baseToolData as Omit<Tool, 'id' | 'codigo' | 'sequencial' | 'status' | 'enderecamento'>),
            codigo: codigoCompleto,
            sequencial: sequencial,
            status: status,
            enderecamento: isTemplate ? 'LOGICA' : (baseToolData.enderecamento || ''),
        };
        
        const toolsCollection = collection(firestore, 'tools');
        addDoc(toolsCollection, toolData).then((docRef) => {
            if (!isTemplate) {
              setToolsToPrint([{...toolData, docId: docRef.id}]);
              setIsLabelPrintOpen(true);
            }
            toast({ title: "Sucesso!", description: `Ferramenta/Modelo ${codigoCompleto} criada.` });
            resetForm();
            setIsFormDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: [allToolsQueryKey] });
            setIsSaving(false);
        }).catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: toolsCollection.path, operation: 'create', requestResourceData: toolData
            }));
            setIsSaving(false);
        });

    } else { // Updating existing tool
        const toolRef = doc(firestore, 'tools', editingTool.docId);
        updateDoc(toolRef, baseToolData).then(() => {
            toast({ title: "Sucesso!", description: `Ferramenta/Modelo atualizada.` });
            resetForm();
            setIsFormDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: [allToolsQueryKey] });
            setIsSaving(false);
        }).catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: toolRef.path, operation: 'update', requestResourceData: baseToolData
            }));
            setIsSaving(false);
        });
    }
  };

  const handleDelete = async (tool: WithDocId<Tool>) => {
    if (!firestore || !storage) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível.' });
        return;
    }
    setIsDeleting(true);
    const docRef = doc(firestore, 'tools', tool.docId);
    
    deleteDoc(docRef).then(async () => {
        if (tool.imageUrl) {
            try {
              const imageRef = storageRef(storage, tool.imageUrl);
              await deleteObject(imageRef);
            } catch(err: any) {
               if (err.code !== 'storage/object-not-found') console.warn("Could not delete image:", err)
            }
        }
        if (tool.doc_engenharia_url) {
            try {
              const docUrlRef = storageRef(storage, tool.doc_engenharia_url);
              await deleteObject(docUrlRef);
            } catch(err: any) {
               if (err.code !== 'storage/object-not-found') console.warn("Could not delete engineering doc:", err)
            }
        }
        toast({ title: 'Sucesso', description: 'Modelo/Ferramenta excluído.' });
        queryClient.invalidateQueries({ queryKey: [allToolsQueryKey] });
        setIsDeleting(false);
    }).catch(() => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
        setIsDeleting(false);
    });
  };

  const handleOpenEditDialog = (tool: WithDocId<Tool>) => {
    setEditingTool(tool);
    setNewFerramenta(tool);
    setToolImage(tool.imageUrl || null);
    setDocEngenhariaFile(null); // Reset file input
    setIsFormDialogOpen(true);
  };
  
  const renderToolList = (list: WithDocId<Tool>[], emptyMessage: string) => {
    if (list.length === 0) {
        return (
             <div className="p-4 border-2 border-dashed rounded-lg bg-muted/20">
                <p className="text-sm text-center text-muted-foreground">{emptyMessage}</p>
            </div>
        );
    }
    
    return (
      <div className="space-y-3">
          {list.map(item => (
              <div key={item.docId} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Image 
                      src={item.imageUrl || 'https://picsum.photos/seed/default-tool/64/64'} 
                      alt={item.descricao}
                      width={64}
                      height={64}
                      className="rounded-md aspect-square object-cover"
                  />
                  <div className="flex-1 text-sm">
                      <p className="font-bold text-base">{item.descricao}</p>
                      <p className="font-mono text-muted-foreground">{item.codigo}</p>
                      {item.enderecamento !== 'LOGICA' && <p className="text-xs text-muted-foreground">Endereço: {item.enderecamento}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(item)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                      </Button>
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" disabled={isDeleting}>
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Tem certeza que deseja excluir <span className="font-bold">"{item.descricao}"</span>? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(item)} disabled={isDeleting}>
                                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Sim, Excluir
                              </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                  </div>
              </div>
          ))}
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <ToolingAlertHeader />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Ferramentas e Modelos</h1>
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) resetForm();
            setIsFormDialogOpen(isOpen);
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingTool(null); resetForm(); }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingTool ? 'Editar Ferramenta/Modelo' : 'Cadastrar Nova Ferramenta ou Modelo'}</DialogTitle>
              <DialogDescription>
                Use para cadastrar novas ferramentas únicas (<span className="font-bold">ESP/EQV</span>), ou criar modelos para adição em massa (<span className="font-bold">STD/GSE</span>).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Taxonomia e Codificação</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="tipo">Tipo</Label>
                    <Select value={newFerramenta.tipo} onValueChange={(v) => handleSelectChange('tipo', v)}><SelectTrigger id="tipo"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STD">STD (Modelo Standard)</SelectItem>
                        <SelectItem value="ESP">ESP (Ferramenta Específica)</SelectItem>
                        <SelectItem value="GSE">GSE (Modelo Apoio de Solo)</SelectItem>
                        <SelectItem value="EQV">EQV (Ferramenta Equivalente)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="familia">Família</Label>
                     <Select value={newFerramenta.familia} onValueChange={(v) => handleSelectChange('familia', v)}><SelectTrigger id="familia"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEC">MEC (Mecânica)</SelectItem>
                        <SelectItem value="TRQ">TRQ (Torque)</SelectItem>
                        <SelectItem value="PRE">PRE (Pressão/Hidr.)</SelectItem>
                        <SelectItem value="ELE">ELE (Elétrica/Aviônica)</SelectItem>
                        <SelectItem value="RIG">RIG (Içamento)</SelectItem>
                        <SelectItem value="MET">MET (Metrologia)</SelectItem>
                        <SelectItem value="SEG">SEG (Segurança)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="classificacao">Classificação</Label>
                    <Select value={newFerramenta.classificacao} onValueChange={(v) => handleSelectChange('classificacao', v)}><SelectTrigger id="classificacao"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="N">N (Normal)</SelectItem>
                        <SelectItem value="C">C (Calibrável)</SelectItem>
                        <SelectItem value="L">L (Load Test)</SelectItem>
                        <SelectItem value="V">V (Vencimento)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
              <Card>
                 <CardHeader><CardTitle className="text-lg">Dados Cadastrais</CardTitle></CardHeader>
                 <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <Label htmlFor="descricao">Descrição Genérica <span className='text-destructive'>*</span></Label>
                        <Input id="descricao" value={newFerramenta.descricao || ''} onChange={handleInputChange} required />
                    </div>
                     {(newFerramenta.tipo === 'ESP' || newFerramenta.tipo === 'EQV') && (
                         <>
                            <div className="col-span-1">
                                <Label htmlFor="enderecamento">Endereçamento <span className='text-destructive'>*</span></Label>
                                <Popover open={isAddressPopoverOpen} onOpenChange={setIsAddressPopoverOpen}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={isAddressPopoverOpen}
                                      className="w-full justify-between font-normal"
                                      disabled={isLoadingAddresses}
                                    >
                                      {isLoadingAddresses ? <Loader2 className="h-4 w-4 animate-spin"/> : newFerramenta.enderecamento || "Selecione um endereço..."}
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
                                                  handleSelectChange('enderecamento', currentValue === newFerramenta.enderecamento ? "" : currentValue)
                                                  setIsAddressPopoverOpen(false)
                                              }}
                                              >
                                              <Check
                                                  className={cn(
                                                  "mr-2 h-4 w-4",
                                                  newFerramenta.enderecamento === addr.value ? "opacity-100" : "opacity-0"
                                                  )}
                                              />
                                              {addr.label}
                                              </CommandItem>
                                          ))}
                                          </CommandGroup>
                                      </CommandList>
                                      </Command>
                                  </PopoverContent>
                                </Popover>
                            </div>
                             <div className="col-span-1">
                                <Label htmlFor="status">Status Inicial</Label>
                                <Select value={newFerramenta.status} onValueChange={(v) => handleSelectChange('status', v)}><SelectTrigger id="status"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Disponível">Disponível</SelectItem>
                                    <SelectItem value="Em Aferição">Em Aferição</SelectItem>
                                    <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                                    <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                                </SelectContent>
                                </Select>
                            </div>
                         </>
                     )}
                     <div className="md:col-span-1">
                        <Label htmlFor="valor_estimado">Valor Estimado (R$)</Label>
                        <Input id="valor_estimado" type="number" value={newFerramenta.valor_estimado || ''} onChange={handleInputChange} placeholder="Ex: 150.00" />
                    </div>
                     {newFerramenta.tipo === 'ESP' || newFerramenta.tipo === 'GSE' || newFerramenta.tipo === 'EQV' ? (
                        <div>
                            <Label htmlFor="pn_fabricante">P/N Fabricante {newFerramenta.tipo !== 'STD' && <span className='text-destructive'>*</span>}</Label>
                            <Input id="pn_fabricante" value={newFerramenta.pn_fabricante || ''} onChange={handleInputChange} required={newFerramenta.tipo !== 'STD'} />
                        </div>
                     ) : null}
                    {newFerramenta.tipo === 'EQV' ? (
                        <div>
                            <Label htmlFor="pn_referencia">P/N Referência (Substitui qual?) <span className='text-destructive'>*</span></Label>
                            <Input id="pn_referencia" value={newFerramenta.pn_referencia || ''} onChange={handleInputChange} required />
                        </div>
                     ) : null}
                    {newFerramenta.tipo === 'ESP' && (
                        <div>
                            <Label htmlFor="aeronave_aplicavel">Aeronave Aplicável <span className='text-destructive'>*</span></Label>
                            <Input id="aeronave_aplicavel" value={newFerramenta.aeronave_aplicavel || ''} onChange={handleInputChange} required />
                        </div>
                    )}
                     <div className="col-span-2 flex items-center gap-4">
                        {toolImage ? <Image src={toolImage} alt="Preview" width={48} height={48} className="rounded-md object-cover" /> : <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2"/>Foto de Referência<span className='text-destructive ml-1'>*</span></Button>
                        <Input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*"/>
                    </div>
                    {newFerramenta.tipo === 'EQV' && (
                       <div className="col-span-2 flex items-center gap-4">
                           {docEngenhariaFile ? <FileText className="h-10 w-10 text-muted-foreground"/> : (editingTool?.doc_engenharia_url && <a href={editingTool.doc_engenharia_url} target="_blank" rel="noopener noreferrer"><FileText className="h-10 w-10 text-blue-500 hover:text-blue-700"/></a>) || <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md"><Paperclip className="h-6 w-6 text-muted-foreground" /></div>}
                           <div className='flex-1'>
                             <Button type="button" variant="outline" size="sm" onClick={() => docEngenhariaInputRef.current?.click()}><Upload className="mr-2"/>Doc. Engenharia<span className='text-destructive ml-1'>*</span></Button>
                             <Input type="file" ref={docEngenhariaInputRef} onChange={handleDocEngenhariaChange} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"/>
                             {docEngenhariaFile && <p className="text-xs text-muted-foreground mt-1 truncate">{docEngenhariaFile.name}</p>}
                           </div>
                       </div>
                    )}
                 </CardContent>
              </Card>

                {(newFerramenta.tipo === 'EQV') && (
                    <div className="col-span-full bg-blue-100 dark:bg-blue-900/30 border border-blue-400 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-md flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5" />
                        <p className="text-sm">O status inicial para ferramentas 'EQV' será <span className="font-bold">"Pendente"</span> e aguardará aprovação da engenharia.</p>
                    </div>
                )}
                 {(newFerramenta.tipo === 'ESP' || newFerramenta.tipo === 'EQV') && !editingTool && (
                    <div className="col-span-full bg-green-100 dark:bg-green-900/30 border border-green-400 text-green-800 dark:text-green-200 px-4 py-3 rounded-md flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5" />
                        <p className="text-sm">Esta ferramenta será cadastrada diretamente no inventário. Após salvar, você poderá imprimir a etiqueta.</p>
                    </div>
                )}
                 {(newFerramenta.tipo === 'STD' || newFerramenta.tipo === 'GSE') && !editingTool && (
                    <div className="col-span-full bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-md flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5" />
                        <p className="text-sm">Você está criando um <span className="font-bold">Modelo (template)</span>. Ele não aparecerá no inventário, mas servirá de base para adicionar ferramentas ao estoque.</p>
                    </div>
                )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFormDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveTool} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTool ? 'Salvar Alterações' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

        <Tabs defaultValue="modelos">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="modelos">Modelos (STD/GSE)</TabsTrigger>
                <TabsTrigger value="unicas">Ferramentas Únicas (ESP/EQV)</TabsTrigger>
            </TabsList>
            <TabsContent value="modelos">
                <Card>
                    <CardHeader>
                        <CardTitle>Modelos Cadastrados (Templates)</CardTitle>
                        <CardDescription>Gerencie os modelos para ferramentas STD e GSE. Use-os para adicionar múltiplas ferramentas ao estoque de uma vez.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingTools ? (
                             <div className="space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                                        <Skeleton className="h-16 w-16 rounded-md" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </div>
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        ) : toolsError ? (
                            <div className="p-4 border rounded-lg bg-destructive/10 text-destructive text-center">
                                <p>Erro ao carregar os modelos. Verifique suas permissões.</p>
                            </div>
                        ) : renderToolList(modelos, 'Nenhum modelo de ferramenta cadastrado. Clique em "Adicionar" para criar um.')}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="unicas">
                <Card>
                    <CardHeader>
                        <CardTitle>Ferramentas Únicas Cadastradas</CardTitle>
                        <CardDescription>Gerencie ferramentas específicas ou equivalentes que foram cadastradas diretamente no inventário.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       {isLoadingTools ? (
                             <div className="space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                                        <Skeleton className="h-16 w-16 rounded-md" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </div>
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        ) : toolsError ? (
                             <div className="p-4 border rounded-lg bg-destructive/10 text-destructive text-center">
                                <p>Erro ao carregar as ferramentas. Verifique suas permissões.</p>
                            </div>
                        ) : renderToolList(ferramentasUnicas, 'Nenhuma ferramenta única (ESP/EQV) cadastrada. Clique em "Adicionar" para criar uma.')}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      
       <LabelPrintDialog
        isOpen={isLabelPrintOpen}
        onClose={() => {
            setIsLabelPrintOpen(false);
            setToolsToPrint([]);
            // Don't redirect, stay on the same page
        }}
        tools={toolsToPrint}
      />
    </div>
  );
};

export default CadastroFerramentasPage;
