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
import { PlusCircle, Repeat2, FileText, Loader2, Image as ImageIcon, MoreHorizontal, ZoomIn, Search, PlusSquare, AlertTriangle, Upload, Paperclip } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface Ferramenta extends Tool {
  docId: string;
}

const familiaSuggestions: { [key in Tool['familia']]: Tool['classificacao'] } = {
    TRQ: 'C',
    PRE: 'C',
    ELE: 'C',
    RIG: 'L',
    MET: 'C',
    SEG: 'V',
    MEC: 'N',
};

const Equipamentos = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docEngenhariaInputRef = useRef<HTMLInputElement>(null);
  const docSegurancaInputRef = useRef<HTMLInputElement>(null);
  const docAnexoInputRef = useRef<HTMLInputElement>(null);

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
  const [isLabelPrintDialogOpen, setIsLabelPrintDialogOpen] = useState(false);
  const [toolsToPrint, setToolsToPrint] = useState<any[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newFerramenta, setNewFerramenta] = useState<Partial<Tool>>({
      tipo: 'STD',
      familia: 'MEC',
      classificacao: 'N',
      descricao: '',
      pn_fabricante: '',
      pn_referencia: '',
      aeronave_aplicavel: '',
  });

  const [generatedCode, setGeneratedCode] = useState('Gerado Automaticamente');

  const [toolImage, setToolImage] = useState<string | null>(null);
  const [docEngenharia, setDocEngenharia] = useState<File | null>(null);
  const [docSeguranca, setDocSeguranca] = useState<File | null>(null);
  const [docAnexo, setDocAnexo] = useState<File | null>(null);

  const [dataReferencia, setDataReferencia] = useState<Date | undefined>();
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();


  // Update generated code preview
  useEffect(() => {
    const { tipo, familia, classificacao } = newFerramenta;
    if (tipo && familia && classificacao) {
      setGeneratedCode(`${tipo}-${familia}-${classificacao}-XXXX`);
    }
  }, [newFerramenta.tipo, newFerramenta.familia, newFerramenta.classificacao]);


  // Handle automatic suggestion for 'Classificação'
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

  const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File | null>>, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setter(file || null);
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setToolImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setNewFerramenta({
      tipo: 'STD', familia: 'MEC', classificacao: 'N', descricao: '',
      pn_fabricante: '', pn_referencia: '', aeronave_aplicavel: '',
    });
    setToolImage(null);
    setDocEngenharia(null);
    setDocSeguranca(null);
    setDocAnexo(null);
    setDataReferencia(undefined);
    setDataVencimento(undefined);
    if(fileInputRef.current) fileInputRef.current.value = '';
    if(docEngenhariaInputRef.current) docEngenhariaInputRef.current.value = '';
    if(docSegurancaInputRef.current) docSegurancaInputRef.current.value = '';
    if(docAnexoInputRef.current) docAnexoInputRef.current.value = '';
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    if (!storage) throw new Error("Storage service not available.");
    const fileRef = storageRef(storage, path);
    const snapshot = await uploadString(fileRef, await file.text(), 'raw', { contentType: file.type });
    return getDownloadURL(snapshot.ref);
  };

  const uploadImage = async (dataUrl: string, path: string): Promise<string> => {
    if (!storage) throw new Error("Storage service not available.");
    const imageRef = storageRef(storage, path);
    const snapshot = await uploadString(imageRef, dataUrl, 'data_url');
    return getDownloadURL(snapshot.ref);
  };

  const handleSaveNewTool = async () => {
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado ou falha na conexão.' });
        return;
    }
    // Validation based on Matrix
    if (newFerramenta.tipo === 'ESP' && !newFerramenta.pn_fabricante) {
      toast({ variant: "destructive", description: "P/N Fabricante é obrigatório para tipo 'Especial'." }); return;
    }
    if (newFerramenta.tipo === 'EQV' && !newFerramenta.pn_referencia) {
      toast({ variant: "destructive", description: "P/N Referência é obrigatório para tipo 'Equivalente'." }); return;
    }
     if (newFerramenta.tipo === 'EQV' && !docEngenharia) {
      toast({ variant: "destructive", description: "Doc. Engenharia é obrigatório para tipo 'Equivalente'." }); return;
    }
    if ((newFerramenta.classificacao === 'C' || newFerramenta.classificacao === 'L' || newFerramenta.classificacao === 'V') && !dataVencimento) {
      toast({ variant: "destructive", description: "Data de Vencimento é obrigatória para esta classificação." }); return;
    }
    if ((newFerramenta.classificacao === 'C' || newFerramenta.classificacao === 'L') && !docAnexo) {
        toast({ variant: "destructive", description: "Anexo de Certificado/Laudo é obrigatório para esta classificação." }); return;
    }
  
    setIsSaving(true);
  
    try {
        const counterRef = doc(firestore, 'counters', `tool_${newFerramenta.tipo}_${newFerramenta.familia}_${newFerramenta.classificacao}`);
        
        let newTools = [];
        const quantity = 1; // Always 1 for logic creation

        const newLastId = await runTransaction(firestore, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let currentId = 0;
            if (!counterDoc.exists()) {
                transaction.set(counterRef, { lastId: quantity });
                currentId = 0;
            } else {
                currentId = counterDoc.data().lastId;
                transaction.update(counterRef, { lastId: currentId + quantity });
            }
            return currentId;
        });


        // Handle file uploads
        let imageUrl;
        if (toolImage) imageUrl = await uploadImage(toolImage, `tool_images/${doc(collection(firestore, 'temp')).id}.jpg`);
        let docEngenhariaUrl;
        if (docEngenharia) docEngenhariaUrl = await uploadFile(docEngenharia, `docs_engenharia/${doc(collection(firestore, 'temp')).id}_${docEngenharia.name}`);
        let docSegurancaUrl;
        if (docSeguranca) docSegurancaUrl = await uploadFile(docSeguranca, `docs_seguranca/${doc(collection(firestore, 'temp')).id}_${docSeguranca.name}`);
        let docAnexoUrl;
        if (docAnexo) docAnexoUrl = await uploadFile(docAnexo, `docs_anexos/${doc(collection(firestore, 'temp')).id}_${docAnexo.name}`);
        
        let status = 'Disponível';
        if(newFerramenta.tipo === 'EQV') status = 'Pendente';

        for (let i = 0; i < quantity; i++) {
            const sequencial = newLastId + 1 + i;
            const codigoCompleto = `${newFerramenta.tipo}-${newFerramenta.familia}-${newFerramenta.classificacao}-${sequencial.toString().padStart(4, '0')}`;
            
            const toolData: Omit<Tool, 'id'> = {
                ...newFerramenta,
                codigo: codigoCompleto,
                sequencial: sequencial,
                status: status,
                status_inicial: newFerramenta.tipo === 'EQV' ? 'Bloqueado' : 'Ativo',
                data_referencia: dataReferencia?.toISOString(),
                data_vencimento: dataVencimento?.toISOString(),
                imageUrl,
                doc_engenharia_url: docEngenhariaUrl,
                doc_seguranca_url: docSegurancaUrl,
                documento_anexo_url: docAnexoUrl,
            };
            const docRef = await addDoc(collection(firestore, 'tools'), toolData);
            newTools.push({ ...toolData, id: docRef.id });
        }
        
        toast({ title: "Sucesso!", description: `Nova lógica de ferramenta cadastrada.` });
        resetForm();
        setIsNewToolDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: [ferramentasQueryKey] });

        // Don't auto-print label for logic creation
        // setToolsToPrint(newTools);
        // setIsLabelPrintDialogOpen(true);

    } catch (error) {
      console.error("Erro ao salvar ferramenta:", error);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: `Não foi possível cadastrar a lógica. Verifique as permissões.` });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredFerramentas = useMemo(() => {
    if (!ferramentas) return [];
    if (!searchTerm) return ferramentas;

    const lowercasedTerm = searchTerm.toLowerCase();
    return ferramentas.filter(ferramenta => 
        (ferramenta.descricao && ferramenta.descricao.toLowerCase().includes(lowercasedTerm)) ||
        (ferramenta.codigo && ferramenta.codigo.toLowerCase().includes(lowercasedTerm))
    );
  }, [ferramentas, searchTerm]);

  const getStatusVariant = (status: string) => {
    const statusMap: { [key: string]: 'success' | 'destructive' | 'default' } = {
        'Disponível': 'success',
        'Vencido': 'destructive',
        'Bloqueado': 'destructive',
        'Inoperante': 'destructive',
        'Pendente': 'default',
        'Em Empréstimo': 'default',
        'Em Aferição': 'default'
    }
    return statusMap[status] || 'default';
  };
  
  const handleAddQuantitySuccess = (newTools: any[]) => {
      setIsAddQuantityDialogOpen(false);
      setToolsToPrint(newTools);
      setIsLabelPrintDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: [ferramentasQueryKey] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Ferramentas</h1>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsAddQuantityDialogOpen(true)}>
              <PlusSquare className="mr-2 h-4 w-4" />
              Adicionar Item Existente
            </Button>
            <Dialog open={isNewToolDialogOpen} onOpenChange={(isOpen) => {
                if (!isOpen) resetForm();
                setIsNewToolDialogOpen(isOpen);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Adicionar Ferramenta (Lógica)
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Cadastrar Nova Lógica de Ferramenta</DialogTitle>
                  <DialogDescription>
                    Preencha os campos para criar um modelo (template) de ferramenta. O código será: <span className="font-mono font-bold text-primary">{generatedCode}</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
                  {/* --- TAXONOMIA --- */}
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Taxonomia e Codificação</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="tipo">Tipo</Label>
                        <Select value={newFerramenta.tipo} onValueChange={(v) => handleSelectChange('tipo', v)}><SelectTrigger id="tipo"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="STD">STD (Standard)</SelectItem>
                            <SelectItem value="ESP">ESP (Específico)</SelectItem>
                            <SelectItem value="GSE">GSE (Apoio de Solo)</SelectItem>
                            <SelectItem value="EQV">EQV (Equivalente)</SelectItem>
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

                  {/* --- DADOS CADASTRAIS (Matriz Principal) --- */}
                  <Card>
                     <CardHeader><CardTitle className="text-lg">Dados Cadastrais</CardTitle></CardHeader>
                     <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Label htmlFor="descricao">Descrição</Label>
                            <Input id="descricao" value={newFerramenta.descricao} onChange={handleInputChange} required />
                        </div>
                         {newFerramenta.tipo === 'ESP' || newFerramenta.tipo === 'GSE' || newFerramenta.tipo === 'EQV' ? (
                            <div>
                                <Label htmlFor="pn_fabricante">P/N Fabricante {newFerramenta.tipo !== 'STD' && <span className='text-destructive'>*</span>}</Label>
                                <Input id="pn_fabricante" value={newFerramenta.pn_fabricante} onChange={handleInputChange} required={newFerramenta.tipo !== 'STD'} />
                            </div>
                         ) : null}
                        {newFerramenta.tipo === 'EQV' ? (
                            <div>
                                <Label htmlFor="pn_referencia">P/N Referência (Substitui qual?) <span className='text-destructive'>*</span></Label>
                                <Input id="pn_referencia" value={newFerramenta.pn_referencia} onChange={handleInputChange} required />
                            </div>
                         ) : null}
                        {newFerramenta.tipo === 'ESP' && (
                            <div>
                                <Label htmlFor="aeronave_aplicavel">Aeronave Aplicável <span className='text-destructive'>*</span></Label>
                                <Input id="aeronave_aplicavel" value={newFerramenta.aeronave_aplicavel} onChange={handleInputChange} required />
                            </div>
                        )}
                     </CardContent>
                  </Card>

                  {/* --- DOCUMENTOS (Matriz Principal) --- */}
                  <Card>
                     <CardHeader><CardTitle className="text-lg">Documentos e Anexos</CardTitle></CardHeader>
                     <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                            {toolImage ? <Image src={toolImage} alt="Preview" width={48} height={48} className="rounded-md object-cover" /> : <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}
                            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2"/>Anexar Foto <span className='text-destructive ml-1'>*</span></Button>
                            <Input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" required/>
                        </div>
                         {newFerramenta.tipo === 'EQV' && (
                            <div className="flex items-center gap-4">
                                {docEngenharia ? <FileText/> : <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md"><Paperclip className="h-6 w-6 text-muted-foreground" /></div>}
                                <Button type="button" variant="outline" size="sm" onClick={() => docEngenhariaInputRef.current?.click()}>Doc. Engenharia <span className='text-destructive ml-1'>*</span></Button>
                                <Input type="file" ref={docEngenhariaInputRef} onChange={(e) => handleFileChange(setDocEngenharia, e)} className="hidden" required/>
                                 {docEngenharia && <span className="text-sm text-muted-foreground truncate">{docEngenharia.name}</span>}
                            </div>
                         )}
                         {newFerramenta.tipo === 'GSE' || newFerramenta.tipo === 'EQV' ? (
                            <div className="flex items-center gap-4">
                                {docSeguranca ? <FileText/> : <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md"><Paperclip className="h-6 w-6 text-muted-foreground" /></div>}
                                <Button type="button" variant="outline" size="sm" onClick={() => docSegurancaInputRef.current?.click()}>Doc. Segurança</Button>
                                <Input type="file" ref={docSegurancaInputRef} onChange={(e) => handleFileChange(setDocSeguranca, e)} className="hidden" />
                                 {docSeguranca && <span className="text-sm text-muted-foreground truncate">{docSeguranca.name}</span>}
                            </div>
                         ) : null}
                     </CardContent>
                  </Card>

                  {/* --- CONTROLE E VALIDADE (Matriz de Controle) --- */}
                  {newFerramenta.classificacao !== 'N' && (
                      <Card>
                        <CardHeader><CardTitle className="text-lg">Controle e Validade</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                               <Label>
                                    {newFerramenta.classificacao === 'C' ? 'Data Última Calibração' : newFerramenta.classificacao === 'L' ? 'Data Último Teste' : 'Data Fabricação/Insp.'}
                               </Label>
                                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{dataReferencia ? format(dataReferencia, 'PPP') : <span>Escolha uma data</span>}</Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dataReferencia} onSelect={setDataReferencia} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                            <div>
                               <Label>Data de Vencimento <span className='text-destructive'>*</span></Label>
                               <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{dataVencimento ? format(dataVencimento, 'PPP') : <span>Escolha uma data</span>}</Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dataVencimento} onSelect={setDataVencimento} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                            {(newFerramenta.classificacao === 'C' || newFerramenta.classificacao === 'L') && (
                                <div className="flex items-center gap-4 col-span-2">
                                    {docAnexo ? <FileText/> : <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md"><Paperclip className="h-6 w-6 text-muted-foreground" /></div>}
                                    <Button type="button" variant="outline" size="sm" onClick={() => docAnexoInputRef.current?.click()}>Anexar Certificado/Laudo <span className='text-destructive ml-1'>*</span></Button>
                                    <Input type="file" ref={docAnexoInputRef} onChange={(e) => handleFileChange(setDocAnexo, e)} className="hidden" required/>
                                    {docAnexo && <span className="text-sm text-muted-foreground truncate">{docAnexo.name}</span>}
                                </div>
                            )}
                        </CardContent>
                      </Card>
                  )}

                    {newFerramenta.tipo === 'EQV' && (
                        <div className="col-span-full bg-blue-100 dark:bg-blue-900/30 border border-blue-400 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-md flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5" />
                            <p className="text-sm">O status inicial para ferramentas 'EQV' será <span className="font-bold">"Pendente"</span> e aguardará aprovação da engenharia.</p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewToolDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSaveNewTool} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Lógica
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </div>
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
                   placeholder="Pesquisar por descrição ou código..."
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
                <TableHead className="w-[64px] sm:table-cell">Foto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Endereçamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow key="loading">
                  <TableCell colSpan={6} className="text-center">Carregando...</TableCell>
                </TableRow>
              ) : firestoreError ? (
                 <TableRow key="error">
                  <TableCell colSpan={6} className="text-center text-destructive">
                    Erro ao carregar ferramentas: {firestoreError.message}
                  </TableCell>
                </TableRow>
              ) : filteredFerramentas && filteredFerramentas.length > 0 ? (
                filteredFerramentas.map((ferramenta) => (
                  <TableRow key={ferramenta.docId}>
                    <TableCell className="hidden sm:table-cell">
                        <button className="relative group focus:outline-none">
                          <Image
                              alt={ferramenta.descricao}
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
                    <TableCell>{ferramenta.descricao}</TableCell>
                    <TableCell>{ferramenta.enderecamento}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(ferramenta.status)}>
                        {ferramenta.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button
                        variant="ghost"
                        size="icon"
                        title="Detalhes"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reimprimir Etiqueta"
                      >
                        <Repeat2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow key="no-results">
                  <TableCell colSpan={6} className="text-center">Nenhuma ferramenta encontrada.</TableCell>
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
        isOpen={isLabelPrintDialogOpen}
        onClose={() => setIsLabelPrintDialogOpen(false)}
        tools={toolsToPrint}
      />
    </div>
  );
};

export default Equipamentos;
