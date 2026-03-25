
'use client';

import { useState, useMemo, useRef, Fragment } from 'react';
import { useTechFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, query, orderBy, deleteDoc, addDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { 
    Loader2, 
    FileSpreadsheet, 
    ChevronRight, 
    ChevronLeft, 
    DatabaseBackup, 
    Factory, 
    PlusCircle, 
    FilterX, 
    Search, 
    Plane, 
    Trash2, 
    User, 
    Calendar,
    ArrowUpRight,
    ChevronDown,
    ChevronUp,
    Building2,
    Info,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Filter,
    ClipboardList,
    CheckSquare,
    X
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parse, differenceInDays, isValid, parseISO } from 'date-fns';
import type { MarketFleet, Aircraft } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useRouter } from 'next/navigation';

type AnacAircraft = {
  MARCAS: string;
  PROPRIETAR: string;
  OPERADORE: string;
  DS_MODELO: string;
  NM_FABRIC: string;
  DT_VALIDADI: string;
  CD_INTERDI: string;
  TP_MOTOR: string;
  CD_TIPO: string;
  DS_CATEGO: string;
  NR_SERIE: string;
  NR_ANO_FAI: string;
  NR_PMD: string;
};

type WizardStep = 'upload' | 'manufacturers' | 'models' | 'sync';

const getRowValue = (row: any, ...keys: string[]) => {
    if (!row) return '';
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        const foundKey = rowKeys.find(rk => {
            const normalizedRowKey = rk.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
            const normalizedSearchKey = key.toUpperCase().replace(/[^A-Z0-9_]/g, '');
            return normalizedRowKey === normalizedSearchKey;
        });
        if (foundKey) return row[foundKey];
    }
    return '';
};

export default function MapeamentoComercialPage() {
  const techFirestore = useTechFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [wizardStep, setWizardStep] = useState<WizardStep>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  
  const [anacData, setAnacData] = useState<AnacAircraft[]>([]);
  const [selectedManufacturers, setSelectedManufacturers] = useState<Set<string>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedItems, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const marketFleetQuery = useMemoFirebase(() => (
      techFirestore ? query(collection(techFirestore, 'market_fleet')) : null
  ), [techFirestore]);
  const { data: dbFleet, isLoading: isLoadingFleet } = useCollection<WithDocId<MarketFleet>>(marketFleetQuery, { queryKey: ['market_fleet_list'] });

  // DB Filters
  const [dbPrefixFilter, setDbPrefixFilter] = useState('');
  const [selectedPrefixCategory, setSelectedPrefixCategory] = useState<string>('todos');
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('todos');
  const [dbOperatorFilter, setDbOperatorFilter] = useState('');
  
  const [sortField, setSortField] = useState<keyof MarketFleet | 'lastSyncedAt'>('validadeCVA');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: keyof MarketFleet | 'lastSyncedAt') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const uniqueDbModels = useMemo(() => {
    if (!dbFleet) return [];
    const models = new Set(dbFleet.map(item => item.modelo));
    return Array.from(models).sort();
  }, [dbFleet]);

  const getCvaStatusInfo = (dateStr: string | undefined) => {
    if (!dateStr) return { label: 'N/A', variant: 'secondary' as const };
    
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let cvaDate: Date;
        const trimmedDate = dateStr.trim();

        if (trimmedDate.includes('/')) {
            cvaDate = parse(trimmedDate, 'dd/MM/yyyy', new Date());
        } else {
            cvaDate = parseISO(trimmedDate);
        }
        
        if (!isValid(cvaDate)) return { label: dateStr, variant: 'secondary' as const };
        
        const days = differenceInDays(cvaDate, today);

        if (days < 0) return { label: 'Vencida', variant: 'critical' as const };
        if (days <= 30) return { label: `Vence em ${days}d`, variant: 'attention' as const };
        if (days <= 90) return { label: `Vence em ${days}d`, variant: 'warning' as const };
        if (days <= 120) return { label: `Vence em ${days}d`, variant: 'info' as const };
        return { label: 'Válida', variant: 'success' as const };
    } catch (e) {
        return { label: dateStr, variant: 'secondary' as const };
    }
  };

  const filteredDbFleet = useMemo(() => {
      if (!dbFleet) return [];
      
      let result = dbFleet.filter(item => {
          const prefixLower = item.prefixo.toLowerCase();
          const searchLower = dbPrefixFilter.toLowerCase();
          
          // Text Prefix Match
          const prefixMatch = !dbPrefixFilter || prefixLower.includes(searchLower);
          
          // Category Match (PU, PP, PR, etc)
          const categoryMatch = selectedPrefixCategory === 'todos' || item.prefixo.toUpperCase().startsWith(selectedPrefixCategory);
          
          // Model Match
          const modelMatch = selectedModelFilter === 'todos' || item.modelo === selectedModelFilter;

          const operatorMatch = !dbOperatorFilter || (item.operador || item.proprietario || '').toLowerCase().includes(dbOperatorFilter.toLowerCase());
          
          return prefixMatch && categoryMatch && modelMatch && operatorMatch;
      });

      result.sort((a, b) => {
          let valA: any = a[sortField as keyof MarketFleet] || '';
          let valB: any = b[sortField as keyof MarketFleet] || '';

          if (sortField === 'validadeCVA') {
              const infoA = getCvaStatusInfo(valA);
              const infoB = getCvaStatusInfo(valB);
              valA = infoA.label === 'N/A' ? 0 : 1;
              valB = infoB.label === 'N/A' ? 0 : 1;
          }

          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
      });

      return result;
  }, [dbFleet, dbPrefixFilter, selectedPrefixCategory, selectedModelFilter, dbOperatorFilter, sortField, sortDirection]);

  // Bulk selection handlers
  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredDbFleet.length) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(filteredDbFleet.map(item => item.docId)));
    }
  };

  const handleBulkDelete = async () => {
    if (!techFirestore || selectedItems.size === 0) return;
    setIsBulkProcessing(true);
    try {
        const batch = writeBatch(techFirestore);
        selectedItems.forEach(id => {
            batch.delete(doc(techFirestore, 'market_fleet', id));
        });
        await batch.commit();
        toast({ title: 'Sucesso', description: `${selectedItems.size} registros removidos.` });
        setSelectedIds(new Set());
    } catch (e) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir os registros.' });
    } finally {
        setIsBulkProcessing(false);
    }
  };

  const handleBulkProspect = async () => {
    if (!techFirestore || selectedItems.size === 0) return;
    setIsBulkProcessing(true);
    try {
        const batch = writeBatch(techFirestore);
        const selectedObjects = dbFleet?.filter(item => selectedItems.has(item.docId)) || [];
        
        selectedObjects.forEach(prospect => {
            const aircraftRef = doc(collection(techFirestore, 'aircrafts'));
            const aircraftData: Omit<Aircraft, 'id'> = {
                prefix: prospect.prefixo,
                modelId: 'prospect',
                modelName: prospect.modelo,
                serialNumber: prospect.nrSerie || '',
                year: prospect.anoFabricacao || '',
                mtow: prospect.mtow || '0',
                operator: {
                    name: prospect.operador || prospect.proprietario || '',
                    cnpj: '', address: '', zipCode: '', isIcmsContributor: false, inscricaoEstadual: '', inscricaoMunicipal: ''
                },
                createdAt: new Date().toISOString()
            };
            batch.set(aircraftRef, aircraftData);
            batch.delete(doc(techFirestore, 'market_fleet', prospect.prefixo));
        });

        await batch.commit();
        toast({ title: 'Sucesso!', description: `${selectedItems.size} aeronaves prospectadas para sua frota.` });
        setSelectedIds(new Set());
        router.push('/dashboard/comercial/aeronaves');
    } catch (e) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Falha na conversão em lote.' });
    } finally {
        setIsBulkProcessing(false);
    }
  };

  const processRawData = (rawRows: any[]) => {
    if (!rawRows || rawRows.length === 0) {
        setIsProcessing(false);
        toast({ variant: 'destructive', title: 'Arquivo Vazio', description: 'O arquivo carregado não contém dados.' });
        return;
    }

    const allData: AnacAircraft[] = rawRows
      .map(row => ({
            MARCAS: String(getRowValue(row, 'MARCAS', 'MARCA', 'PREFIXO') || '').trim().toUpperCase(),
            PROPRIETAR: String(getRowValue(row, 'PROPRIETAR', 'PROPRIETARIO') || '').trim().toUpperCase(),
            OPERADORE: String(getRowValue(row, 'OPERADORE', 'OPERADOR') || '').trim().toUpperCase(),
            DS_MODELO: String(getRowValue(row, 'DS_MODELO', 'MODELO') || '').trim().toUpperCase(),
            NM_FABRIC: String(getRowValue(row, 'NM_FABRIC', 'FABRICANTE') || '').trim().toUpperCase(),
            DT_VALIDADI: String(getRowValue(row, 'DT_VALIDADI', 'VALIDADE', 'DT_VALIDADE_CVA') || '').trim(),
            CD_INTERDI: String(getRowValue(row, 'CD_INTERDI', 'INTERDICAO') || 'N').trim().toUpperCase(),
            TP_MOTOR: String(getRowValue(row, 'TP_MOTOR', 'MOTOR') || '').trim().toUpperCase(),
            CD_TIPO: String(getRowValue(row, 'CD_TIPO', 'TIPO') || '').trim().toUpperCase(),
            DS_CATEGO: String(getRowValue(row, 'DS_CATEGO', 'CATEGORIA') || '').trim().toUpperCase(),
            NR_SERIE: String(getRowValue(row, 'NR_SERIE', 'SERIE') || '').trim().toUpperCase(),
            NR_ANO_FAI: String(getRowValue(row, 'NR_ANO_FAI', 'ANO') || '').trim(),
            NR_PMD: String(getRowValue(row, 'NR_PMD', 'PMD', 'MTOW') || '').trim(),
      }))
      .filter(item => item.MARCAS && item.MARCAS.length >= 2);

    setAnacData(allData);
    setIsProcessing(false);
    
    if (allData.length > 0) {
        toast({ title: 'Arquivo Processado', description: `${allData.length} aeronaves identificadas.` });
        setWizardStep('manufacturers');
    } else {
        toast({ variant: 'destructive', title: 'Nenhum registro encontrado', description: 'Não conseguimos identificar os prefixos no arquivo.' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
        Papa.parse(file, {
            header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toUpperCase(),
            complete: (results) => processRawData(results.data as any[]),
            error: () => { setIsProcessing(false); toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao ler CSV.' }); }
        });
    } else {
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);
                processRawData(data);
            } catch (err) { setIsProcessing(false); toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao ler Excel.' }); }
        };
        reader.readAsBinaryString(file);
    }
  };

  const uniqueManufacturers = useMemo(() => {
    return Array.from(new Set(anacData.map(item => item.NM_FABRIC || 'DESCONHECIDO'))).sort()
        .filter(m => !searchFilter || m.toLowerCase().includes(searchFilter.toLowerCase()));
  }, [anacData, searchFilter]);

  const handleToggleManufacturer = (manuf: string) => {
    setSelectedManufacturers(prev => {
        const next = new Set(prev);
        if (next.has(manuf)) next.delete(manuf); else next.add(manuf);
        return next;
    });
  };

  const uniqueModels = useMemo(() => {
    return Array.from(new Set(anacData.filter(item => selectedManufacturers.has(item.NM_FABRIC)).map(item => item.DS_MODELO || 'DESCONHECIDO'))).sort()
        .filter(m => !searchFilter || m.toLowerCase().includes(searchFilter.toLowerCase()));
  }, [anacData, selectedManufacturers, searchFilter]);

  const handleToggleModel = (model: string) => {
    setSelectedModels(prev => {
        const next = new Set(prev);
        if (next.has(model)) next.delete(model); else next.add(model);
        return next;
    });
  };

  const finalFilteredData = useMemo(() => {
    return anacData.filter(item => selectedManufacturers.has(item.NM_FABRIC) && selectedModels.has(item.DS_MODELO));
  }, [anacData, selectedManufacturers, selectedModels]);

  const handleSync = async () => {
    if (!techFirestore || finalFilteredData.length === 0) return;
    setIsSyncing(true);
    setSyncProgress(0);
    try {
        const batchSize = 500;
        for (let i = 0; i < finalFilteredData.length; i += batchSize) {
            const batch = writeBatch(techFirestore);
            const chunk = finalFilteredData.slice(i, i + batchSize);
            chunk.forEach(item => {
                const rabRef = doc(collection(techFirestore, 'market_fleet'), item.MARCAS);
                batch.set(rabRef, {
                    prefixo: item.MARCAS, modelo: item.DS_MODELO, fabricante: item.NM_FABRIC,
                    operador: item.OPERADORE, proprietario: item.PROPRIETAR, validadeCVA: item.DT_VALIDADI,
                    tipoMotor: item.TP_MOTOR, tipoAeronave: item.CD_TIPO, categoria: item.DS_CATEGO,
                    nrSerie: item.NR_SERIE, anoFabricacao: item.NR_ANO_FAI, mtow: item.NR_PMD,
                    lastSyncedAt: new Date().toISOString()
                });
            });
            await batch.commit();
            setSyncProgress(Math.round(((i + chunk.length) / finalFilteredData.length) * 100));
        }
        toast({ title: 'Sucesso!', description: 'Base de mercado atualizada.' });
        resetWizard();
    } catch (err) { toast({ variant: 'destructive', title: 'Erro', description: 'Falha na sincronização.' }); }
    finally { setIsSyncing(false); }
  };

  const resetWizard = () => { setAnacData([]); setSelectedManufacturers(new Set()); setSelectedModels(new Set()); setWizardStep('upload'); setSearchFilter(''); };

  const handleDeleteProspect = async (id: string) => {
      if(!techFirestore) return;
      try {
          await deleteDoc(doc(techFirestore, 'market_fleet', id));
          toast({ title: 'Removido', description: 'Aeronave removida da base mapeada.' });
      } catch (e) { toast({ variant: 'destructive', title: 'Erro ao remover' }); }
  };

  const handleConvertToFleet = async (prospect: MarketFleet) => {
      if(!techFirestore) return;
      try {
          const aircraftData: Omit<Aircraft, 'id'> = {
              prefix: prospect.prefixo,
              modelId: 'prospect',
              modelName: prospect.modelo,
              serialNumber: prospect.nrSerie || '',
              year: prospect.anoFabricacao || '',
              mtow: prospect.mtow || '0',
              operator: {
                  name: prospect.operador || prospect.proprietario || '',
                  cnpj: '', address: '', zipCode: '', isIcmsContributor: false, inscricaoEstadual: '', inscricaoMunicipal: ''
              },
              createdAt: new Date().toISOString()
          };
          await addDoc(collection(techFirestore, 'aircrafts'), aircraftData);
          await deleteDoc(doc(techFirestore, 'market_fleet', prospect.prefixo));
          toast({ title: 'Sucesso!', description: `${prospect.prefixo} agora faz parte da sua frota.` });
          router.push('/dashboard/comercial/aeronaves');
      } catch (e) { toast({ variant: 'destructive', title: 'Erro na conversão' }); }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const SortIcon = ({ field }: { field: keyof MarketFleet | 'lastSyncedAt' }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Mapeamento de Mercado</h1>
          <p className="text-sm text-muted-foreground">Prospecte aeronaves do RAB ANAC e gerencie seu mercado alvo.</p>
        </div>
      </div>

      <Tabs defaultValue="db">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="db">Base Mapeada ({dbFleet?.length || 0})</TabsTrigger>
            <TabsTrigger value="garimpo">Atualização de Base (Upload)</TabsTrigger>
        </TabsList>

        <TabsContent value="db" className="space-y-4">
            {selectedItems.size > 0 && (
                <div className="sticky top-0 z-50 p-4 bg-primary text-primary-foreground rounded-lg shadow-xl flex items-center justify-between animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-4">
                        <CheckSquare className="h-5 w-5" />
                        <span className="font-bold">{selectedItems.size} itens selecionados</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={handleBulkProspect} disabled={isBulkProcessing}>
                            {isBulkProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}
                            Prospectar em Lote
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isBulkProcessing} className="bg-red-500 hover:bg-red-600">
                            {isBulkProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Excluir Selecionados
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedIds(new Set())} className="text-primary-foreground hover:bg-primary-foreground/10">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            )}

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3 bg-muted/10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-4 flex-1">
                            <div>
                                <CardTitle>Aeronaves do Mercado Alvo</CardTitle>
                                <CardDescription>Consulte a validade da CVA e informações de proprietários para prospecção.</CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Select value={selectedPrefixCategory} onValueChange={setSelectedPrefixCategory}>
                                    <SelectTrigger className="w-36 bg-background">
                                        <SelectValue placeholder="Categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Prefixos (Todos)</SelectItem>
                                        <SelectItem value="PP">PP-</SelectItem>
                                        <SelectItem value="PR">PR-</SelectItem>
                                        <SelectItem value="PS">PS-</SelectItem>
                                        <SelectItem value="PT">PT-</SelectItem>
                                        <SelectItem value="PU">PU-</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={selectedModelFilter} onValueChange={setSelectedModelFilter}>
                                    <SelectTrigger className="w-56 bg-background">
                                        <SelectValue placeholder="Modelo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos os Modelos</SelectItem>
                                        {uniqueDbModels.map(m => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className="relative">
                                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Prefixo"
                                        className="pl-8 w-32 bg-background"
                                        value={dbPrefixFilter}
                                        onChange={(e) => setDbPrefixFilter(e.target.value.toUpperCase())}
                                    />
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Filtrar Operador / Proprietário"
                                        className="pl-8 w-64 bg-background"
                                        value={dbOperatorFilter}
                                        onChange={(e) => setDbOperatorFilter(e.target.value)}
                                    />
                                </div>
                                {(selectedPrefixCategory !== 'todos' || selectedModelFilter !== 'todos' || dbPrefixFilter || dbOperatorFilter) && (
                                    <Button variant="ghost" size="sm" onClick={() => { 
                                        setSelectedPrefixCategory('todos'); 
                                        setSelectedModelFilter('todos');
                                        setDbPrefixFilter('');
                                        setDbOperatorFilter('');
                                    }}>Limpar</Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="w-12">
                                    <Checkbox 
                                        checked={filteredDbFleet.length > 0 && selectedItems.size === filteredDbFleet.length}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="w-12"></TableHead>
                                <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('prefixo')}>
                                    <div className="flex items-center">Prefixo <SortIcon field="prefixo" /></div>
                                </TableHead>
                                <TableHead>Modelo / Fabricante</TableHead>
                                <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('operador')}>
                                    <div className="flex items-center">Operador <SortIcon field="operador" /></div>
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('validadeCVA')}>
                                    <div className="flex items-center">Validade CVA <SortIcon field="validadeCVA" /></div>
                                </TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingFleet ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                            ) : filteredDbFleet.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhuma aeronave mapeada encontrada para estes filtros.</TableCell></TableRow>
                            ) : (
                                filteredDbFleet.map(item => {
                                    const isExpanded = expandedId === item.docId;
                                    const isSelected = selectedItems.has(item.docId);
                                    const cvaStatus = getCvaStatusInfo(item.validadeCVA);
                                    return (
                                        <Fragment key={item.docId}>
                                            <TableRow 
                                                className={cn("group cursor-pointer hover:bg-muted/30 transition-colors border-b-0", isExpanded && "bg-muted/40", isSelected && "bg-primary/5")}
                                                onClick={() => toggleExpand(item.docId)}
                                            >
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox 
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelectItem(item.docId)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </TableCell>
                                                <TableCell className="font-black text-primary text-lg tracking-tighter">{item.prefixo}</TableCell>
                                                <TableCell>
                                                    <p className="font-semibold text-sm">{item.modelo}</p>
                                                    <p className="text-[10px] uppercase text-muted-foreground font-medium">{item.fabricante}</p>
                                                </TableCell>
                                                <TableCell className="max-w-[220px]">
                                                    <div className="flex items-start gap-2">
                                                        <User className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                                                        <span className="text-xs truncate font-medium uppercase" title={item.operador || item.proprietario}>{item.operador || item.proprietario}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={cvaStatus.variant} className="whitespace-nowrap font-bold shadow-sm">
                                                        <Calendar className="mr-1 h-3 w-3" />
                                                        {cvaStatus.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="success" className="h-8 font-bold shadow-sm hover:scale-105 transition-transform" onClick={() => handleConvertToFleet(item)}>
                                                            <ArrowUpRight className="mr-1 h-3 w-3" /> Prospectar
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteProspect(item.docId)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {isExpanded && (
                                                <TableRow className="bg-muted/20 hover:bg-muted/20 border-b shadow-inner">
                                                    <TableCell colSpan={7} className="p-0">
                                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2">
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-2 text-primary font-bold border-b pb-2">
                                                                    <Plane className="h-4 w-4" />
                                                                    <h4 className="text-xs uppercase tracking-widest">Informações Técnicas (RAB)</h4>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                                    <div className="space-y-1">
                                                                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Número de Série (S/N)</p>
                                                                        <p className="font-mono bg-background p-2 rounded border border-primary/10 shadow-sm">{item.nrSerie || 'N/A'}</p>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Ano de Fabricação</p>
                                                                        <p className="p-2 bg-background rounded border border-primary/10 shadow-sm">{item.anoFabricacao || 'N/A'}</p>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Tipo de Motor</p>
                                                                        <p className="p-2 bg-background rounded border border-primary/10 shadow-sm font-medium text-xs">{item.tipoMotor || 'N/A'}</p>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Tipo / Categoria</p>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            <Badge variant="outline" className="text-[9px] uppercase">{item.tipoAeronave}</Badge>
                                                                            <Badge variant="outline" className="text-[9px] uppercase">{item.categoria}</Badge>
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Peso Máximo (PMD)</p>
                                                                        <p className="p-2 bg-background rounded border border-primary/10 shadow-sm">{item.mtow ? `${parseInt(item.mtow).toLocaleString()} kg` : 'N/A'}</p>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Data Validade CVA</p>
                                                                        <p className="p-2 bg-background rounded border border-primary/10 shadow-sm">{item.validadeCVA || '-'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-2 text-primary font-bold border-b pb-2">
                                                                    <Building2 className="h-4 w-4" />
                                                                    <h4 className="text-xs uppercase tracking-widest">Propriedade e Operação</h4>
                                                                </div>
                                                                <div className="grid grid-cols-1 gap-3 text-sm">
                                                                    <div className="flex items-start gap-3 bg-background p-3 rounded-lg border border-primary/5 shadow-sm">
                                                                        <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                                                                        <div>
                                                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Proprietário Legal</p>
                                                                            <p className="font-bold text-sm">{item.proprietario || 'N/A'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
                                                                        <User className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                                                                        <div>
                                                                            <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider mb-1">Operador Atual</p>
                                                                            <p className="font-bold text-sm text-blue-900 dark:text-blue-100">{item.operador || 'N/A'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-4 p-3 rounded-lg border border-dashed border-primary/20 bg-muted/5">
                                                                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                                                                            <DatabaseBackup className="h-3 w-3" />
                                                                            Última Sincronização do RAB
                                                                        </div>
                                                                        <p className="text-[10px] font-mono">{item.lastSyncedAt ? format(new Date(item.lastSyncedAt), 'dd/MM/yyyy HH:mm') : '-'}</p>
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
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="garimpo" className="space-y-4">
            <div className="flex justify-end">
                {anacData.length > 0 && (
                    <Button variant="ghost" onClick={resetWizard} className="text-destructive">
                        <FilterX className="mr-2 h-4 w-4" /> Cancelar Atualização
                    </Button>
                )}
            </div>

            {wizardStep === 'upload' && (
                <Card className="border-dashed border-2 flex flex-col items-center justify-center py-20 bg-muted/10">
                    <div className="text-center space-y-4">
                        <div className="bg-primary/10 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                            <FileSpreadsheet className="h-10 w-10 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Carregar Novo Arquivo do RAB</CardTitle>
                            <CardDescription>Planilha Excel (.xlsx) ou CSV oficial da ANAC.</CardDescription>
                        </div>
                        <Input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv, .xlsx, .xls" className="hidden" />
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} size="lg" className="px-10">
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            Selecionar Arquivo
                        </Button>
                    </div>
                </Card>
            )}

            {wizardStep === 'manufacturers' && (
                <Card>
                    <CardHeader className="border-b bg-muted/20">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="flex items-center gap-2"><Factory className="h-5 w-5" /> Selecionar Fabricantes</CardTitle>
                                <CardDescription>Escolha quais marcas sua oficina atende.</CardDescription>
                            </div>
                            <Badge variant="secondary">{selectedManufacturers.size} selecionados</Badge>
                        </div>
                        <Input placeholder="Filtrar marcas..." className="mt-4" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[400px]">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                                {uniqueManufacturers.map(manuf => (
                                    <div key={manuf} className={cn("flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors", selectedManufacturers.has(manuf) ? "bg-primary/5 border-primary" : "hover:bg-muted/50")} onClick={() => handleToggleManufacturer(manuf)}>
                                        <Checkbox checked={selectedManufacturers.has(manuf)} />
                                        <span className="font-medium text-sm truncate">{manuf}</span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="border-t bg-muted/10 justify-end p-4">
                        <Button onClick={() => { setWizardStep('models'); setSearchFilter(''); }} disabled={selectedManufacturers.size === 0} size="lg">
                            Próximo: Selecionar Modelos <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {wizardStep === 'models' && (
                <Card>
                    <CardHeader className="border-b bg-muted/20">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Selecionar Modelos</CardTitle>
                                <CardDescription>Escolha os modelos específicos das marcas selecionadas.</CardDescription>
                            </div>
                            <Badge variant="secondary">{selectedModels.size} selecionados</Badge>
                        </div>
                        <Input placeholder="Filtrar modelos..." className="mt-4" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[400px]">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                                {uniqueModels.map(model => (
                                    <div key={model} className={cn("flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors", selectedModels.has(model) ? "bg-primary/5 border-primary" : "hover:bg-muted/50")} onClick={() => handleToggleModel(model)}>
                                        <Checkbox checked={selectedModels.has(model)} />
                                        <span className="font-medium text-sm truncate">{model}</span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="border-t bg-muted/10 justify-between p-4">
                        <Button variant="outline" onClick={() => { setWizardStep('manufacturers'); setSearchFilter(''); }}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                        </Button>
                        <Button onClick={setWizardStep('sync')} disabled={selectedModels.size === 0} size="lg">
                            Revisar e Sincronizar <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {wizardStep === 'sync' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Revisão Final</CardTitle>
                        <CardDescription>Confirme o resumo antes de gravar no Firestore.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 border rounded-lg text-center space-y-1"><p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Fabricantes</p><p className="text-2xl font-black">{selectedManufacturers.size}</p></div>
                            <div className="p-4 border rounded-lg text-center space-y-1"><p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Modelos</p><p className="text-2xl font-black">{selectedModels.size}</p></div>
                            <div className="p-4 border rounded-lg text-center space-y-1 bg-primary/5"><p className="text-xs font-bold uppercase text-primary tracking-widest">Total de Aeronaves</p><p className="text-2xl font-black text-primary">{finalFilteredData.length}</p></div>
                        </div>
                        {isSyncing && (
                            <div className="space-y-2 animate-in fade-in">
                                <div className="flex justify-between text-sm font-medium"><span>Sincronizando...</span><span>{syncProgress}%</span></div>
                                <Progress value={syncProgress} className="h-2" />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="border-t bg-muted/10 justify-between p-4">
                        <Button variant="outline" onClick={() => setWizardStep('models')} disabled={isSyncing}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                        </Button>
                        <Button onClick={handleSync} disabled={isSyncing || finalFilteredData.length === 0} size="lg" className="bg-green-600 hover:bg-green-700">
                            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />}
                            Finalizar e Sincronizar
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
