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
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, uploadString } from 'firebase/storage';
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase, useStorage } from '@/firebase';
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
import { PlusCircle, FileText, Loader2, Image as ImageIcon, AlertTriangle, Upload, Paperclip, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import type { Tool } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import LabelPrintDialog from '@/components/LabelPrintDialog';
import { useRouter } from 'next/navigation';


const familiaSuggestions: { [key in Tool['familia']]: Tool['classificacao'] } = {
    TRQ: 'C', PRE: 'C', ELE: 'C', RIG: 'L', MET: 'C', SEG: 'V', MEC: 'N',
};

const CadastroLogicaFerramentas = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docEngenhariaInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  const queryClient = useQueryClient();
  const logicasQueryKey = 'logicasFerramentas';

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [editingLogic, setEditingLogic] = useState<WithDocId<Tool> | null>(null);
  const [toolsToPrint, setToolsToPrint] = useState<any[]>([]);
  const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false);

  const [newFerramenta, setNewFerramenta] = useState<Partial<Tool>>({
      tipo: 'STD', familia: 'MEC', classificacao: 'N', descricao: '',
      pn_fabricante: '', pn_referencia: '', aeronave_aplicavel: '',
      enderecamento: '', status: 'Disponível',
  });

  const [generatedCode, setGeneratedCode] = useState('Gerado Automaticamente');
  const [toolImage, setToolImage] = useState<string | null>(null);
  const [docEngenhariaFile, setDocEngenhariaFile] = useState<File | null>(null);


  const toolsQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'tools'), orderBy('codigo')) : null
  ), [firestore]);
  
  const { data: allTools, isLoading: isLoadingTools, error: toolsError } = useCollection<Tool>(toolsQuery, {
    queryKey: ['allToolsForLogicPage']
  });

  const logicas = useMemo(() => {
    return allTools?.filter(tool => tool.enderecamento === 'LOGICA') || [];
  }, [allTools]);
  
  const isLoadingLogicas = isLoadingTools;
  const logicasError = toolsError;


  useEffect(() => {
    const { tipo, familia, classificacao } = newFerramenta;
    if (tipo && familia && classificacao) {
      setGeneratedCode(`${tipo}-${familia}-${classificacao}-XXXX`);
    }
  }, [newFerramenta.tipo, newFerramenta.familia, newFerramenta.classificacao]);

  useEffect(() => {
    if (newFerramenta.familia) {
      const suggestedClassificacao = familiaSuggestions[newFerramenta.familia];
      if (suggestedClassificacao) {
        setNewFerramenta(prev => ({ ...prev, classificacao: suggestedClassificacao }));
      }
    }
  }, [newFerramenta.familia]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
     setNewFerramenta((prev) => ({ ...prev, [id]: value }));
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
      enderecamento: '', status: 'Disponível',
    });
    setToolImage(null);
    setDocEngenhariaFile(null);
    setEditingLogic(null);
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

  const handleSaveToolLogic = async () => {
    if (!user || !firestore || !storage) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado ou falha na conexão.' });
        return;
    }
    const isDirectCreation = newFerramenta.tipo === 'ESP' || newFerramenta.tipo === 'EQV';
    
    if (newFerramenta.tipo === 'ESP' && !newFerramenta.pn_fabricante) {
      toast({ variant: "destructive", description: "P/N Fabricante é obrigatório para tipo 'Especial'." }); return;
    }
    if (newFerramenta.tipo === 'EQV' && !newFerramenta.pn_referencia) {
      toast({ variant: "destructive", description: "P/N Referência é obrigatório para tipo 'Equivalente'." }); return;
    }
     if (newFerramenta.tipo === 'EQV' && !docEngenhariaFile && !editingLogic?.doc_engenharia_url) {
      toast({ variant: "destructive", description: "Doc. Engenharia é obrigatório para tipo 'Equivalente'." }); return;
    }
     if (!toolImage && !editingLogic?.imageUrl) {
      toast({ variant: "destructive", description: "A imagem de referência é obrigatória." }); return;
    }
    if (isDirectCreation && !newFerramenta.enderecamento) {
        toast({ variant: "destructive", description: "Endereçamento é obrigatório para cadastro direto." }); return;
    }
  
    setIsSaving(true);
  
    try {
        const tempId = doc(collection(firestore, 'temp')).id;
        const logicId = editingLogic?.docId || tempId;
        
        let imageUrl = editingLogic?.imageUrl;
        if (toolImage && toolImage.startsWith('data:')) {
            imageUrl = await uploadImageAsDataUrl(toolImage, `tool_images/${logicId}.jpg`);
        }

        let docEngenhariaUrl = editingLogic?.doc_engenharia_url;
        if (docEngenhariaFile) {
            docEngenhariaUrl = await uploadFile(docEngenhariaFile, `doc_engenharia/${logicId}_${docEngenhariaFile.name}`);
        }
        
        const baseToolData: Partial<Tool> = {
            ...newFerramenta,
            imageUrl: imageUrl,
            doc_engenharia_url: docEngenhariaUrl
        };
        // Remove undefined properties to avoid overwriting existing data with nothing
        Object.keys(baseToolData).forEach(key => baseToolData[key as keyof Partial<Tool>] === undefined && delete baseToolData[key as keyof Partial<Tool>]);
        
        if (isDirectCreation && !editingLogic) { // Only for new ESP or EQV tools
            const { tipo, familia, classificacao } = newFerramenta;
            const counterRef = doc(firestore, 'counters', `tool_${tipo}_${familia}_${classificacao}`);
            
            const newSequencial = await runTransaction(firestore, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                 if (!counterDoc.exists()) {
                    transaction.set(counterRef, { lastId: 1 });
                    return 1;
                }
                const newId = (counterDoc.data().lastId || 0) + 1;
                transaction.update(counterRef, { lastId: newId });
                return newId;
            });
            
            const codigoCompleto = `${tipo}-${familia}-${classificacao}-${newSequencial.toString().padStart(4, '0')}`;
            const status: Tool['status'] = tipo === 'EQV' ? 'Pendente' : 'Disponível';

            const toolData: Omit<Tool, 'id'> = {
                ...(baseToolData as Omit<Tool, 'id' | 'codigo' | 'sequencial' | 'status'>),
                codigo: codigoCompleto,
                sequencial: newSequencial,
                status: status,
            };
            
            const docRef = await addDoc(collection(firestore, 'tools'), toolData);
            setToolsToPrint([{...toolData, id: docRef.id}]);
            setIsLabelPrintOpen(true);
            toast({ title: "Sucesso!", description: `Ferramenta ${codigoCompleto} criada.` });

        } else if (editingLogic) {
            // Update existing logic OR existing unique tool
            const logicRef = doc(firestore, 'tools', editingLogic.docId);
            await updateDoc(logicRef, baseToolData);
            toast({ title: "Sucesso!", description: `Ferramenta/Lógica atualizada.` });
        } else {
            // Add new logic template (STD or GSE)
            const sequencial = 0;
            const codigoCompleto = `${newFerramenta.tipo}-${newFerramenta.familia}-${newFerramenta.classificacao}-${sequencial.toString().padStart(4, '0')}`;
            const toolData: Partial<Tool> = {
                ...baseToolData,
                codigo: codigoCompleto,
                sequencial: sequencial,
                status: 'Disponível', // Status for a logic is just a default
                enderecamento: 'LOGICA', // Mark this as a logic template
            };

            await addDoc(collection(firestore, 'tools'), toolData);
            toast({ title: "Sucesso!", description: `Nova lógica de ferramenta cadastrada.` });
        }
        
        resetForm();
        setIsFormDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: [logicasQueryKey, 'allToolsForLogicPage'] });

    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: `Não foi possível salvar. Verifique as permissões.` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (logica: WithDocId<Tool>) => {
    if (!firestore || !storage) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível.' });
        return;
    }
    setIsDeleting(true);
    try {
        const docRef = doc(firestore, 'tools', logica.docId);
        await deleteDoc(docRef);

        if (logica.imageUrl) {
            try {
              const imageRef = storageRef(storage, logica.imageUrl);
              await deleteObject(imageRef);
            } catch(err: any) {
               if (err.code !== 'storage/object-not-found') console.warn("Could not delete image:", err)
            }
        }

        if (logica.doc_engenharia_url) {
            try {
              const docUrlRef = storageRef(storage, logica.doc_engenharia_url);
              await deleteObject(docUrlRef);
            } catch(err: any) {
               if (err.code !== 'storage/object-not-found') console.warn("Could not delete engineering doc:", err)
            }
        }

        toast({ title: 'Sucesso', description: 'Lógica/Ferramenta excluída.' });
        queryClient.invalidateQueries({ queryKey: [logicasQueryKey, 'allToolsForLogicPage'] });
    } catch (error) {
        console.error("Erro ao excluir:", error);
        toast({ variant: 'destructive', title: 'Erro ao Excluir', description: 'Não foi possível excluir o item.' });
    } finally {
        setIsDeleting(false);
    }
  };

  const handleOpenEditDialog = (logic: WithDocId<Tool>) => {
    setEditingLogic(logic);
    setNewFerramenta(logic);
    setToolImage(logic.imageUrl || null);
    setDocEngenhariaFile(null); // Reset file input
    setIsFormDialogOpen(true);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Ferramentas</h1>
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) resetForm();
            setIsFormDialogOpen(isOpen);
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingLogic(null); resetForm(); }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingLogic ? 'Editar Ferramenta/Lógica' : 'Cadastrar Nova Ferramenta ou Lógica'}</DialogTitle>
              <DialogDescription>
                Use para cadastrar novas ferramentas <span className="font-bold">ESP/EQV</span> diretamente, ou criar modelos <span className="font-bold">STD/GSE</span> para adição em massa.
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
                        <SelectItem value="STD">STD (Standard - Modelo)</SelectItem>
                        <SelectItem value="ESP">ESP (Específico - Cadastro Direto)</SelectItem>
                        <SelectItem value="GSE">GSE (Apoio de Solo - Modelo)</SelectItem>
                        <SelectItem value="EQV">EQV (Equivalente - Cadastro Direto)</SelectItem>
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
                                <Input id="enderecamento" value={newFerramenta.enderecamento || ''} onChange={handleInputChange} required placeholder="Ex: GAV-01-A" />
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
                           {docEngenhariaFile ? <FileText className="h-10 w-10 text-muted-foreground"/> : (editingLogic?.doc_engenharia_url && <a href={editingLogic.doc_engenharia_url} target="_blank" rel="noopener noreferrer"><FileText className="h-10 w-10 text-blue-500 hover:text-blue-700"/></a>) || <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md"><Paperclip className="h-6 w-6 text-muted-foreground" /></div>}
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
                 {(newFerramenta.tipo === 'ESP' || newFerramenta.tipo === 'EQV') && !editingLogic && (
                    <div className="col-span-full bg-green-100 dark:bg-green-900/30 border border-green-400 text-green-800 dark:text-green-200 px-4 py-3 rounded-md flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5" />
                        <p className="text-sm">Esta ferramenta será cadastrada diretamente. Após salvar, você poderá imprimir a etiqueta.</p>
                    </div>
                )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFormDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveToolLogic} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingLogic ? 'Salvar Alterações' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Modelos Cadastrados (STD/GSE)</CardTitle>
            <CardDescription>Gerencie os modelos (templates) para ferramentas STD e GSE.</CardDescription>
        </CardHeader>
        <CardContent>
             {isLoadingLogicas && (
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
             )}
             {logicasError && (
                <div className="p-4 border rounded-lg bg-destructive/10 text-destructive text-center">
                    <p>Erro ao carregar os modelos de ferramentas. Verifique suas permissões.</p>
                </div>
             )}
             {!isLoadingLogicas && !logicasError && logicas && logicas.length > 0 && (
                <div className="space-y-3">
                    {logicas.map(logica => (
                        <div key={logica.docId} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <Image 
                                src={logica.imageUrl || 'https://picsum.photos/seed/default-tool/64/64'} 
                                alt={logica.descricao}
                                width={64}
                                height={64}
                                className="rounded-md aspect-square object-cover"
                            />
                            <div className="flex-1 text-sm">
                                <p className="font-bold text-base">{logica.descricao}</p>
                                <p className="font-mono text-muted-foreground">{logica.codigo}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(logica)}>
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
                                            Tem certeza que deseja excluir o modelo <span className="font-bold">"{logica.descricao}"</span>? Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(logica)} disabled={isDeleting}>
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
             )}
             {!isLoadingLogicas && !logicasError && (!logicas || logicas.length === 0) && (
                <div className="p-4 border-2 border-dashed rounded-lg bg-muted/20">
                    <p className="text-sm text-center text-muted-foreground">
                        Nenhum modelo de ferramenta cadastrado ainda. Clique em "Adicionar" para criar um.
                    </p>
                </div>
             )}
        </CardContent>
      </Card>
      
       <LabelPrintDialog
        isOpen={isLabelPrintOpen}
        onClose={() => {
            setIsLabelPrintOpen(false);
            setToolsToPrint([]);
            router.push('/dashboard/ferramentaria/lista-ferramentas');
        }}
        tools={toolsToPrint}
      />
    </div>
  );
};

export default CadastroLogicaFerramentas;

    