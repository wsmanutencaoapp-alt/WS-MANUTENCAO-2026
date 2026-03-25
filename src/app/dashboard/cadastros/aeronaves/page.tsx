
'use client';

import { useState, useMemo, Fragment } from 'react';
import { useCollection, useTechFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, orderBy, limit, getDocs, writeBatch } from 'firebase/firestore';
import type { Aircraft, AircraftModel } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, Plane, Building2, MoreHorizontal, Search, History, ChevronDown, ChevronUp, MapPin, CreditCard, Info, FileText, CalendarClock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const CadastroAeronavesPage = () => {
  const techFirestore = useTechFirestore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['tech_aircrafts'];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState<WithDocId<Aircraft> | null>(null);
  const [aircraftToDelete, setAircraftToDelete] = useState<WithDocId<Aircraft> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Aircraft>>({
    prefix: '',
    modelId: '',
    modelName: '',
    serialNumber: '',
    year: new Date().getFullYear().toString(),
    mtow: '0',
    operator: {
      name: '',
      cnpj: '',
      inscricaoEstadual: '',
      inscricaoMunicipal: '',
      address: '',
      zipCode: '',
      isIcmsContributor: false,
    }
  });

  // Fetch Aircrafts from Tech DB (operation-manager)
  const aircraftsQuery = useMemoFirebase(
    () => (techFirestore ? query(collection(techFirestore, 'aircrafts'), orderBy('prefix')) : null),
    [techFirestore]
  );
  const { data: aircrafts, isLoading: isLoadingAircrafts } = useCollection<WithDocId<Aircraft>>(aircraftsQuery, {
      queryKey,
  });

  // Fetch Aircraft Models from Tech DB
  const modelsQuery = useMemoFirebase(
    () => (techFirestore ? query(collection(techFirestore, 'aircraftModels')) : null),
    [techFirestore]
  );
  const { data: models, isLoading: isLoadingModels } = useCollection<WithDocId<AircraftModel>>(modelsQuery, {
      queryKey: ['aircraftModelsForSelect'],
  });

  // Filter aircrafts based on search term
  const filteredAircrafts = useMemo(() => {
    if (!aircrafts) return [];
    if (!searchTerm) return aircrafts;
    const lowerSearch = searchTerm.toLowerCase();
    return aircrafts.filter(ac => 
      ac.prefix.toLowerCase().includes(lowerSearch) ||
      ac.modelName.toLowerCase().includes(lowerSearch) ||
      ac.operator?.name.toLowerCase().includes(lowerSearch) ||
      ac.operator?.cnpj.toLowerCase().includes(lowerSearch) ||
      ac.serialNumber.toLowerCase().includes(lowerSearch)
    );
  }, [aircrafts, searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id.startsWith('operator.')) {
        const field = id.split('.')[1];
        setFormData(prev => ({
            ...prev,
            operator: {
                ...prev.operator!,
                [field]: value
            }
        }));
    } else {
        setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleSelectModel = (modelId: string) => {
    const model = models?.find(m => m.docId === modelId);
    setFormData(prev => ({ 
        ...prev, 
        modelId, 
        modelName: model ? model.model : '' 
    }));
  };

  const resetForm = () => {
    setFormData({
      prefix: '',
      modelId: '',
      modelName: '',
      serialNumber: '',
      year: new Date().getFullYear().toString(),
      mtow: '0',
      operator: {
        name: '',
        cnpj: '',
        inscricaoEstadual: '',
        inscricaoMunicipal: '',
        address: '',
        zipCode: '',
        isIcmsContributor: false,
      }
    });
    setEditingAircraft(null);
  };
  
  const handleOpenDialog = (aircraft: WithDocId<Aircraft> | null) => {
    if (aircraft) {
      setEditingAircraft(aircraft);
      setFormData(aircraft);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!techFirestore) return;
    if (!formData.prefix || !formData.modelId || !formData.serialNumber || !formData.operator?.name || !formData.operator?.cnpj) {
        toast({ variant: 'destructive', title: 'Campos Obrigatórios', description: 'Por favor, preencha os campos obrigatórios (*).' });
        return;
    }

    setIsSaving(true);
    
    try {
        let finalId = formData.id;

        if (!editingAircraft) {
            const q = query(collection(techFirestore, 'aircrafts'), orderBy('id', 'desc'), limit(1));
            const snapshot = await getDocs(q);
            let lastId = 0;
            if (!snapshot.empty) {
                lastId = snapshot.docs[0].data().id || 0;
            }
            finalId = lastId + 1;
        }

        const dataToSave = { 
            ...formData,
            id: finalId,
            prefix: formData.prefix!.toUpperCase(),
            createdAt: editingAircraft?.createdAt || new Date().toISOString()
        };

        if (editingAircraft) {
            const docRef = doc(techFirestore, 'aircrafts', editingAircraft.docId);
            await updateDoc(docRef, dataToSave as any);
            toast({ title: 'Sucesso!', description: 'Aeronave atualizada.' });
        } else {
            await addDoc(collection(techFirestore, 'aircrafts'), dataToSave);
            toast({ title: 'Sucesso!', description: `Aeronave ${formData.prefix} cadastrada com ID ${finalId}.` });
        }

        queryClient.invalidateQueries({ queryKey });
        setIsDialogOpen(false);
        resetForm();
    } catch (e: any) {
        console.error("Erro ao salvar aeronave: ", e);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar os dados.' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleSyncDates = async () => {
    if (!techFirestore || !aircrafts) return;
    setIsSyncing(true);
    try {
        const batch = writeBatch(techFirestore);
        let count = 0;
        const today = new Date().toISOString();

        aircrafts.forEach(ac => {
            if (!ac.createdAt) {
                const docRef = doc(techFirestore, 'aircrafts', ac.docId);
                batch.update(docRef, { createdAt: today });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            toast({ title: 'Sucesso!', description: `${count} aeronaves tiveram a data de cadastro atualizada para hoje.` });
            queryClient.invalidateQueries({ queryKey });
        } else {
            toast({ title: 'Info', description: 'Todas as aeronaves já possuem data de cadastro.' });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao sincronizar datas.' });
    } finally {
        setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!techFirestore || !aircraftToDelete) return;
    try {
      await deleteDoc(doc(techFirestore, 'aircrafts', aircraftToDelete.docId));
      toast({ title: 'Sucesso!', description: 'Aeronave removida do sistema.' });
      queryClient.invalidateQueries({ queryKey });
      setAircraftToDelete(null);
    } catch (e: any) {
       toast({ variant: 'destructive', title: 'Erro na Exclusão', description: 'Não foi possível remover a aeronave.' });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plane className="h-6 w-6 text-primary" />
              Cadastro de Aeronaves
          </h1>
          <p className="text-sm text-muted-foreground">Gerenciamento da frota de clientes e detalhes do operador.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleSyncDates} disabled={isSyncing || isLoadingAircrafts}>
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
                Sincronizar Datas
            </Button>
            <Button onClick={() => handleOpenDialog(null)} className="md:w-auto w-full shadow-lg hover:scale-105 transition-transform">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova Aeronave
            </Button>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="pb-3 bg-muted/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Frota Gerenciada</CardTitle>
              <CardDescription>
                Visualize e gerencie as aeronaves registradas no banco de dados técnico.
              </CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar aeronave..."
                className="pl-8 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-none border-t">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-[80px] font-bold">ID</TableHead>
                  <TableHead className="w-[120px] font-bold">Prefixo</TableHead>
                  <TableHead className="font-bold">Modelo</TableHead>
                  <TableHead className="font-bold">Operador</TableHead>
                  <TableHead className="font-bold hidden md:table-cell">S/N</TableHead>
                  <TableHead className="text-right font-bold w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAircrafts ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Carregando frota...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAircrafts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      {searchTerm ? 'Nenhuma aeronave encontrada para esta busca.' : 'Nenhuma aeronave cadastrada.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAircrafts.map(ac => {
                    const isExpanded = expandedId === ac.docId;
                    return (
                      <Fragment key={ac.docId}>
                        <TableRow 
                          className={cn(
                            "hover:bg-muted/30 transition-colors cursor-pointer border-b-0",
                            isExpanded && "bg-muted/40"
                          )}
                          onClick={() => toggleExpand(ac.docId)}
                        >
                          <TableCell className="text-center">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{ac.id || '-'}</TableCell>
                          <TableCell className="font-bold text-primary">{ac.prefix}</TableCell>
                          <TableCell>{ac.modelName}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={ac.operator?.name}>
                            {ac.operator?.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs hidden md:table-cell">{ac.serialNumber}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Abrir menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Opções</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleOpenDialog(ac)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar Cadastro
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-blue-600">
                                  <History className="mr-2 h-4 w-4" />
                                  Histórico Técnico
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setAircraftToDelete(ac)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir Aeronave
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        
                        {/* Detalhes Expandidos (Menu Sanfona) */}
                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20 border-b">
                            <TableCell colSpan={7} className="p-0">
                              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2">
                                {/* Coluna 1: Dados Técnicos */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 text-primary font-bold border-b pb-2">
                                    <Plane className="h-4 w-4" />
                                    <h4 className="text-sm uppercase tracking-wider">Dados Técnicos</h4>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="space-y-1">
                                      <p className="text-muted-foreground text-xs uppercase font-semibold">Número de Série (S/N)</p>
                                      <p className="font-mono bg-background p-2 rounded border">{ac.serialNumber}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-muted-foreground text-xs uppercase font-semibold">Ano de Fabricação</p>
                                      <p className="p-2 bg-background rounded border">{ac.year || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-muted-foreground text-xs uppercase font-semibold">Peso Máx. Decolagem (MTOW)</p>
                                      <p className="p-2 bg-background rounded border">{ac.mtow ? `${parseInt(ac.mtow).toLocaleString()} kg` : 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-muted-foreground text-xs uppercase font-semibold">Data Cadastro</p>
                                      <p className="p-2 bg-background rounded border">{ac.createdAt ? new Date(ac.createdAt).toLocaleDateString() : '-'}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Coluna 2: Dados do Operador */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 text-primary font-bold border-b pb-2">
                                    <Building2 className="h-4 w-4" />
                                    <h4 className="text-sm uppercase tracking-wider">Dados do Operador</h4>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 text-sm">
                                    <div className="flex items-start gap-2">
                                      <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                                      <div>
                                        <p className="text-xs text-muted-foreground font-semibold">RAZÃO SOCIAL / PROPRIETÁRIO</p>
                                        <p className="font-bold">{ac.operator?.name}</p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="flex items-start gap-2">
                                        <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div>
                                          <p className="text-xs text-muted-foreground font-semibold">CNPJ</p>
                                          <p>{ac.operator?.cnpj}</p>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground font-semibold uppercase">Contribuinte ICMS</p>
                                        <Badge variant={ac.operator?.isIcmsContributor ? 'success' : 'outline'} className="mt-1">
                                          {ac.operator?.isIcmsContributor ? 'SIM' : 'NÃO'}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-xs text-muted-foreground font-semibold uppercase">Ins. Estadual</p>
                                        <p>{ac.operator?.inscricaoEstadual || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground font-semibold uppercase">Ins. Municipal</p>
                                        <p>{ac.operator?.inscricaoMunicipal || '-'}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2 pt-2 border-t mt-1">
                                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                      <div>
                                        <p className="text-xs text-muted-foreground font-semibold uppercase">Localização e CEP</p>
                                        <p className="text-xs italic">{ac.operator?.address}</p>
                                        <p className="mt-1 font-mono">{ac.operator?.zipCode}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
           if (!open) resetForm();
           setIsDialogOpen(open);
        }} modal={false}>
        <DialogContent className="max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingAircraft ? 'Editar Aeronave' : 'Novo Cadastro de Aeronave'}</DialogTitle>
            <DialogDescription>
                {editingAircraft ? `Editando aeronave ID: ${editingAircraft.id}` : 'Preencha os dados técnicos e informações do operador. O ID será gerado automaticamente.'}
            </DialogDescription>
          </DialogHeader>
          
          <Separator />

          <div className="flex-1 overflow-y-auto pr-4 space-y-6 py-4">
            {/* Seção 1: Dados da Aeronave */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold">
                    <Plane className="h-5 w-5" />
                    <h3>Dados da Aeronave</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1.5">
                        <Label htmlFor="modelId">Modelo da Aeronave <span className="text-destructive">*</span></Label>
                        <Select value={formData.modelId} onValueChange={handleSelectModel} disabled={isLoadingModels}>
                            <SelectTrigger id="modelId">
                                <SelectValue placeholder={isLoadingModels ? "Carregando..." : "Selecione o modelo"} />
                            </SelectTrigger>
                            <SelectContent>
                                {models?.map(m => (
                                    <SelectItem key={m.docId} value={m.docId}>{m.manufacturer} {m.model}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="prefix">Prefixo <span className="text-destructive">*</span></Label>
                        <Input id="prefix" value={formData.prefix || ''} onChange={handleInputChange} placeholder="Ex: PR-XYZ" className="uppercase" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="serialNumber">Número de Série (S/N) <span className="text-destructive">*</span></Label>
                        <Input id="serialNumber" value={formData.serialNumber || ''} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="year">Ano de Fabricação</Label>
                        <Input id="year" value={formData.year || ''} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="mtow">Peso Máx. Decolagem (kg)</Label>
                        <Input id="mtow" value={formData.mtow || ''} onChange={handleInputChange} />
                    </div>
                </div>
            </div>

            <Separator />

            {/* Seção 2: Dados do Operador */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold">
                    <Building2 className="h-5 w-5" />
                    <h3>Dados do Operador / Proprietário</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="operator.name">Nome / Razão Social <span className="text-destructive">*</span></Label>
                        <Input id="operator.name" value={formData.operator?.name || ''} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="operator.cnpj">CNPJ <span className="text-destructive">*</span></Label>
                        <Input id="operator.cnpj" value={formData.operator?.cnpj || ''} onChange={handleInputChange} placeholder="00.000.000/0000-00" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="operator.inscricaoEstadual">Inscrição Estadual</Label>
                        <Input id="operator.inscricaoEstadual" value={formData.operator?.inscricaoEstadual || ''} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="operator.inscricaoMunicipal">Inscrição Municipal</Label>
                        <Input id="operator.inscricaoMunicipal" value={formData.operator?.inscricaoMunicipal || ''} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="operator.zipCode">CEP</Label>
                        <Input id="operator.zipCode" value={formData.operator?.zipCode || ''} onChange={handleInputChange} placeholder="00000-000" />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="operator.address">Endereço Completo</Label>
                    <Input id="operator.address" value={formData.operator?.address || ''} onChange={handleInputChange} />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                    <Checkbox 
                        id="isIcmsContributor" 
                        checked={formData.operator?.isIcmsContributor} 
                        onCheckedChange={(checked) => setFormData(p => ({
                            ...p, 
                            operator: {
                                ...p.operator!,
                                isIcmsContributor: !!checked
                            }
                        }))} 
                    />
                    <Label htmlFor="isIcmsContributor" className="text-sm font-medium leading-none cursor-pointer">
                        É contribuinte de ICMS?
                    </Label>
                </div>
            </div>
          </div>

          <Separator />

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Cadastro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aircraftToDelete} onOpenChange={(open) => !open && setAircraftToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir permanentemente a aeronave <span className="font-bold">{aircraftToDelete?.prefix}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default CadastroAeronavesPage;
