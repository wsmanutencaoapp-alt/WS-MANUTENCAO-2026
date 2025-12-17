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
import { PlusCircle, FileText, Loader2, Image as ImageIcon, AlertTriangle, Upload, Paperclip } from 'lucide-react';
import type { Tool } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const docSegurancaInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const logicasQueryKey = 'logicasFerramentas';

  const [isNewToolDialogOpen, setIsNewToolDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [newFerramenta, setNewFerramenta] = useState<Partial<Tool>>({
      tipo: 'STD', familia: 'MEC', classificacao: 'N', descricao: '',
      pn_fabricante: '', pn_referencia: '', aeronave_aplicavel: '',
  });

  const [generatedCode, setGeneratedCode] = useState('Gerado Automaticamente');
  const [toolImage, setToolImage] = useState<string | null>(null);
  const [docEngenharia, setDocEngenharia] = useState<File | null>(null);
  const [docSeguranca, setDocSeguranca] = useState<File | null>(null);

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
    if(fileInputRef.current) fileInputRef.current.value = '';
    if(docEngenhariaInputRef.current) docEngenhariaInputRef.current.value = '';
    if(docSegurancaInputRef.current) docSegurancaInputRef.current.value = '';
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    if (!storage) throw new Error("Storage service not available.");
    const fileRef = storageRef(storage, path);
    // Convert file to data URL to upload
    const fileAsDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    const snapshot = await uploadString(fileRef, fileAsDataUrl, 'data_url');
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
    if (newFerramenta.tipo === 'ESP' && !newFerramenta.pn_fabricante) {
      toast({ variant: "destructive", description: "P/N Fabricante é obrigatório para tipo 'Especial'." }); return;
    }
    if (newFerramenta.tipo === 'EQV' && !newFerramenta.pn_referencia) {
      toast({ variant: "destructive", description: "P/N Referência é obrigatório para tipo 'Equivalente'." }); return;
    }
     if (newFerramenta.tipo === 'EQV' && !docEngenharia) {
      toast({ variant: "destructive", description: "Doc. Engenharia é obrigatório para tipo 'Equivalente'." }); return;
    }
     if (!toolImage) {
      toast({ variant: "destructive", description: "A imagem de referência é obrigatória para a lógica." }); return;
    }
  
    setIsSaving(true);
  
    try {
        const counterRef = doc(firestore, 'counters', `tool_${newFerramenta.tipo}_${newFerramenta.familia}_${newFerramenta.classificacao}`);
        
        const existingCounter = await getDoc(counterRef);
        if (!existingCounter.exists()) {
             await setDoc(counterRef, { lastId: 0 });
        }
        
        const tempId = doc(collection(firestore, 'temp')).id;
        let imageUrl = await uploadImage(toolImage, `tool_logic_images/${tempId}.jpg`);
        let docEngenhariaUrl;
        if (docEngenharia) docEngenhariaUrl = await uploadFile(docEngenharia, `docs_engenharia/${tempId}_${docEngenharia.name}`);
        let docSegurancaUrl;
        if (docSeguranca) docSegurancaUrl = await uploadFile(docSeguranca, `docs_seguranca/${tempId}_${docSeguranca.name}`);
        
        let status = 'Disponível';
        if(newFerramenta.tipo === 'EQV') status = 'Pendente';

        const sequencial = 0; // Logic template has no sequencial, it's a template
        const codigoCompleto = `${newFerramenta.tipo}-${newFerramenta.familia}-${newFerramenta.classificacao}-${sequencial.toString().padStart(4, '0')}`;
        
        const toolData: Omit<Tool, 'id'> = {
            ...newFerramenta,
            codigo: codigoCompleto,
            sequencial: sequencial,
            status: status,
            status_inicial: newFerramenta.tipo === 'EQV' ? 'Bloqueado' : 'Ativo',
            imageUrl: imageUrl,
            doc_engenharia_url: docEngenhariaUrl,
            doc_seguranca_url: docSegurancaUrl,
            enderecamento: 'LOGICA', // Mark this as a logic template
        };
        await addDoc(collection(firestore, 'tools'), toolData);
        
        toast({ title: "Sucesso!", description: `Nova lógica de ferramenta cadastrada.` });
        resetForm();
        setIsNewToolDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: [logicasQueryKey] });

    } catch (error) {
      console.error("Erro ao salvar lógica:", error);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: `Não foi possível cadastrar a lógica. Verifique as permissões.` });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cadastro de Lógica de Ferramentas</h1>
        <Dialog open={isNewToolDialogOpen} onOpenChange={(isOpen) => {
            if (!isOpen) resetForm();
            setIsNewToolDialogOpen(isOpen);
        }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Lógica
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
              <Card>
                 <CardHeader><CardTitle className="text-lg">Dados Cadastrais Genéricos</CardTitle></CardHeader>
                 <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <Label htmlFor="descricao">Descrição Genérica</Label>
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
              <Card>
                 <CardHeader><CardTitle className="text-lg">Documentos e Imagem de Referência</CardTitle></CardHeader>
                 <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        {toolImage ? <Image src={toolImage} alt="Preview" width={48} height={48} className="rounded-md object-cover" /> : <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-md"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2"/>Anexar Foto de Referência <span className='text-destructive ml-1'>*</span></Button>
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

       <Card>
        <CardHeader>
            <CardTitle>Lógicas Cadastradas</CardTitle>
            <CardDescription>Gerencie os modelos (templates) de ferramentas.</CardDescription>
        </CardHeader>
        <CardContent>
            {/* TODO: Listar aqui as lógicas já cadastradas */}
             <div className="p-4 border rounded-lg bg-muted/20">
                <p className="text-sm text-center text-muted-foreground">
                    A lista de lógicas de ferramentas será implementada aqui.
                </p>
            </div>
        </CardContent>
      </Card>
      
    </div>
  );
};

export default CadastroLogicaFerramentas;

    