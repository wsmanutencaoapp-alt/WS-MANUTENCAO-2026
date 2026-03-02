'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import type { Employee, Vehicle, TemporaryEmployee, GatePersonnel } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Edit, Users, Car, HardHat, PlusCircle, Trash2 } from 'lucide-react';
import { format, differenceInDays, parse, isValid } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import EditCredenciamentoDialog from '@/components/EditCredenciamentoDialog';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


// =====================================================================
// Helper function for credential status
// =====================================================================
const getCredentialStatus = (dueDate: string | undefined): { text: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' } => {
    if (!dueDate) return { text: 'Não emitida', variant: 'secondary' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDateObj = new Date(dueDate);
    
    const daysUntilDue = differenceInDays(dueDateObj, today);

    if (daysUntilDue < 0) return { text: 'Vencida', variant: 'destructive' };
    if (daysUntilDue <= 30) return { text: `Vence em ${daysUntilDue + 1} dias`, variant: 'warning' };
    return { text: 'Válida', variant: 'success' };
};


// =====================================================================
// Funcionários Ativos Tab Component
// =====================================================================
const FuncionariosAtivosTab = ({ onEdit }: { onEdit: (item: WithDocId<Employee>) => void }) => {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const employeesQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'employees'), where('status', 'in', ['Ativo', 'Pendente'])) : null
  ), [firestore]);

  const { data: employees, isLoading, error } = useCollection<WithDocId<Employee>>(employeesQuery, {
      queryKey: ['active_employees_for_credenciamento']
  });

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    
    const sortedEmployees = [...employees].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));

    if (!searchTerm) return sortedEmployees;
    const lowercasedTerm = searchTerm.toLowerCase();
    return sortedEmployees.filter(e => 
      e.firstName.toLowerCase().includes(lowercasedTerm) ||
      e.lastName.toLowerCase().includes(lowercasedTerm) ||
      e.id.toString().includes(lowercasedTerm) ||
      (e.cargo && e.cargo.toLowerCase().includes(lowercasedTerm))
    );
  }, [employees, searchTerm]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credenciamento de Funcionários Ativos</CardTitle>
        <CardDescription>Gerencie as credenciais, cargos e bases dos funcionários ativos e pendentes.</CardDescription>
        <div className="relative pt-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, matrícula, cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-background pl-8 md:w-[300px]"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matrícula</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status Credencial</TableHead>
              <TableHead>Colete</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
            {error && <TableRow><TableCell colSpan={9} className="text-center h-24 text-destructive">{error.message}</TableCell></TableRow>}
            {!isLoading && filteredEmployees.map(employee => {
              const status = getCredentialStatus(employee.dataVencimento);
              return (
                <TableRow key={employee.docId}>
                  <TableCell className="font-mono">{employee.id}</TableCell>
                  <TableCell className="font-medium">{employee.firstName} {employee.lastName}</TableCell>
                  <TableCell>{employee.base || '-'}</TableCell>
                  <TableCell>{employee.acesso || '-'}</TableCell>
                  <TableCell>{employee.cargo || '-'}</TableCell>
                  <TableCell>{employee.dataVencimento ? format(new Date(employee.dataVencimento), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell><Badge variant={status.variant}>{status.text}</Badge></TableCell>
                  <TableCell>{employee.coleteNumero || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="icon" onClick={() => onEdit(employee)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};


// =====================================================================
// Ex-Funcionários Tab Component
// =====================================================================
const ExFuncionariosTab = () => {
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');

    const employeesQuery = useMemoFirebase(() => (
        firestore ? query(collection(firestore, 'employees'), where('status', '==', 'Inativo')) : null
    ), [firestore]);

    const { data: employees, isLoading, error } = useCollection<WithDocId<Employee>>(employeesQuery, {
        queryKey: ['inactive_employees_for_credenciamento']
    });

    const filteredEmployees = useMemo(() => {
        if (!employees) return [];
        
        const sortedEmployees = [...employees].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));

        if (!searchTerm) return sortedEmployees;
        const lowercasedTerm = searchTerm.toLowerCase();
        return sortedEmployees.filter(e =>
            e.firstName.toLowerCase().includes(lowercasedTerm) ||
            e.lastName.toLowerCase().includes(lowercasedTerm) ||
            e.id.toString().includes(lowercasedTerm)
        );
    }, [employees, searchTerm]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ex-Funcionários</CardTitle>
                <CardDescription>Lista de funcionários com status "Inativo" e o último estado de suas credenciais.</CardDescription>
                <div className="relative pt-4">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Pesquisar por nome ou matrícula..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg bg-background pl-8 md:w-[300px]"
                    />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Matrícula</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Base</TableHead>
                            <TableHead>Acesso</TableHead>
                            <TableHead>Cargo</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Colete</TableHead>
                            <TableHead>Data Devolução</TableHead>
                            <TableHead>Observação</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={10} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
                        {error && <TableRow><TableCell colSpan={10} className="text-center h-24 text-destructive">{error.message}</TableCell></TableRow>}
                        {!isLoading && filteredEmployees.length === 0 && <TableRow><TableCell colSpan={10} className="text-center h-24">Nenhum ex-funcionário encontrado.</TableCell></TableRow>}
                        {!isLoading && filteredEmployees.map(employee => {
                            return (
                                <TableRow key={employee.docId}>
                                    <TableCell className="font-mono">{employee.id}</TableCell>
                                    <TableCell className="font-medium">{employee.firstName} {employee.lastName}</TableCell>
                                    <TableCell>{employee.base || '-'}</TableCell>
                                    <TableCell>{employee.acesso || '-'}</TableCell>
                                    <TableCell>{employee.cargo || '-'}</TableCell>
                                    <TableCell>{employee.dataVencimento ? format(new Date(employee.dataVencimento), 'dd/MM/yyyy') : '-'}</TableCell>
                                    <TableCell>{employee.coleteNumero || '-'}</TableCell>
                                    <TableCell>{employee.dataDevolucao ? format(new Date(employee.dataDevolucao), 'dd/MM/yyyy') : '-'}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{employee.motivoBaixa || '-'}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


// =====================================================================
// Temporários Tab Component
// =====================================================================
const TemporariosTab = () => {
    const firestore = useFirestore();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTemp, setEditingTemp] = useState<WithDocId<TemporaryEmployee> | null>(null);
    const [formData, setFormData] = useState<Partial<TemporaryEmployee>>({});
    const [isSaving, setIsSaving] = useState(false);

    const tempEmployeesQuery = useMemoFirebase(() => (
        firestore ? query(collection(firestore, 'temporary_employees'), orderBy('name')) : null
    ), [firestore]);

    const { data: tempEmployees, isLoading, error } = useCollection<WithDocId<TemporaryEmployee>>(tempEmployeesQuery, {
        queryKey: ['temporary_employees']
    });

    const filteredTempEmployees = useMemo(() => {
        if (!tempEmployees) return [];
        if (!searchTerm) return tempEmployees;
        const lowercasedTerm = searchTerm.toLowerCase();
        return tempEmployees.filter(e => 
            e.name.toLowerCase().includes(lowercasedTerm) ||
            (e.company && e.company.toLowerCase().includes(lowercasedTerm)) ||
            (e.servico && e.servico.toLowerCase().includes(lowercasedTerm))
        );
    }, [tempEmployees, searchTerm]);

    const handleOpenDialog = (temp: WithDocId<TemporaryEmployee> | null) => {
        if (temp) {
            setEditingTemp(temp);
            setFormData({
                ...temp,
                dataSolicitacao: temp.dataSolicitacao ? format(new Date(temp.dataSolicitacao), 'yyyy-MM-dd') : '',
                dataVencimento: temp.dataVencimento ? format(new Date(temp.dataVencimento), 'yyyy-MM-dd') : '',
                dataDevolucao: temp.dataDevolucao ? format(new Date(temp.dataDevolucao), 'yyyy-MM-dd') : '',
            });
        } else {
            setEditingTemp(null);
            setFormData({
                name: '', company: '', status: 'Ativo', base: '', servico: '',
                observacao: '', acesso: '', coleteNumero: '',
                dataSolicitacao: '', dataVencimento: '', dataDevolucao: ''
            });
        }
        setDialogOpen(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (value: 'Ativo' | 'Inativo') => {
        setFormData(prev => ({...prev, status: value}));
    };

    const handleSave = async () => {
        if (!firestore) return;
        if (!formData.name || !formData.company) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Nome e Empresa são obrigatórios.' });
            return;
        }

        setIsSaving(true);
        try {
            const dataToSave: Partial<TemporaryEmployee> = {
                name: formData.name, company: formData.company, status: formData.status,
                base: formData.base, servico: formData.servico, observacao: formData.observacao,
                acesso: formData.acesso, coleteNumero: formData.coleteNumero,
            };

            if (formData.dataSolicitacao) {
                const parsed = parse(formData.dataSolicitacao, 'yyyy-MM-dd', new Date());
                if (isValid(parsed)) dataToSave.dataSolicitacao = parsed.toISOString();
            }
             if (formData.dataVencimento) {
                const parsed = parse(formData.dataVencimento, 'yyyy-MM-dd', new Date());
                if (isValid(parsed)) dataToSave.dataVencimento = parsed.toISOString();
            }
             if (formData.dataDevolucao) {
                const parsed = parse(formData.dataDevolucao, 'yyyy-MM-dd', new Date());
                if (isValid(parsed)) dataToSave.dataDevolucao = parsed.toISOString();
            }


            if (editingTemp) {
                const docRef = doc(firestore, 'temporary_employees', editingTemp.docId);
                await updateDoc(docRef, dataToSave);
                toast({ title: 'Sucesso', description: 'Dados do temporário atualizados.' });
            } else {
                await addDoc(collection(firestore, 'temporary_employees'), dataToSave);
                toast({ title: 'Sucesso', description: 'Funcionário temporário cadastrado.' });
            }
            queryClient.invalidateQueries({ queryKey: ['temporary_employees'] });
            setDialogOpen(false);
        } catch (err: any) {
            console.error("Error saving temporary employee:", err);
            toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar os dados.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (tempId: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'temporary_employees', tempId));
            toast({ title: 'Sucesso', description: 'Funcionário temporário excluído.'});
            queryClient.invalidateQueries({ queryKey: ['temporary_employees'] });
        } catch (err) {
             toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir.'});
        }
    };
    
    return (
      <>
        <Card>
            <CardHeader>
                <CardTitle>Controle de Temporários e Terceirizados</CardTitle>
                <CardDescription>Gerencie as credenciais para funcionários que não possuem acesso ao sistema.</CardDescription>
                <div className="flex justify-between items-center pt-4">
                     <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Pesquisar por nome, serviço, empresa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg bg-background pl-8 md:w-[300px]"
                        />
                    </div>
                    <Button onClick={() => handleOpenDialog(null)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Temporário
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Serviço</TableHead>
                            <TableHead>Base</TableHead>
                            <TableHead>Acesso</TableHead>
                            <TableHead>Nº Colete</TableHead>
                            <TableHead>Solicitação</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Devolução</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={11} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
                        {error && <TableRow><TableCell colSpan={11} className="text-center h-24 text-destructive">{error.message}</TableCell></TableRow>}
                        {!isLoading && filteredTempEmployees.map(temp => {
                            const status = getCredentialStatus(temp.dataVencimento);
                            return (
                                <TableRow key={temp.docId}>
                                    <TableCell className="font-medium">{temp.name}</TableCell>
                                    <TableCell>{temp.company}</TableCell>
                                    <TableCell>{temp.servico || '-'}</TableCell>
                                    <TableCell>{temp.base || '-'}</TableCell>
                                    <TableCell>{temp.acesso || '-'}</TableCell>
                                    <TableCell>{temp.coleteNumero || '-'}</TableCell>
                                    <TableCell>{temp.dataSolicitacao ? format(new Date(temp.dataSolicitacao), 'dd/MM/yyyy') : '-'}</TableCell>
                                    <TableCell>{temp.dataVencimento ? format(new Date(temp.dataVencimento), 'dd/MM/yyyy') : '-'}</TableCell>
                                    <TableCell>{temp.dataDevolucao ? format(new Date(temp.dataDevolucao), 'dd/MM/yyyy') : '-'}</TableCell>
                                    <TableCell><Badge variant={status.variant}>{status.text}</Badge></TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="icon" onClick={() => handleOpenDialog(temp)}><Edit className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                    <AlertDialogDescription>Tem certeza que deseja excluir o registro de <span className="font-bold">{temp.name}</span>?</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(temp.docId)}>Sim, Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingTemp ? 'Editar' : 'Adicionar'} Funcionário Temporário</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div className="space-y-1.5"><Label htmlFor="name">Nome Completo</Label><Input id="name" value={formData.name || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="company">Empresa</Label><Input id="company" value={formData.company || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="base">Base</Label><Input id="base" value={formData.base || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="servico">Serviço</Label><Input id="servico" value={formData.servico || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="observacao">Observação</Label><Input id="observacao" value={formData.observacao || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="acesso">Acesso</Label><Input id="acesso" value={formData.acesso || ''} onChange={handleInputChange}/></div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5"><Label htmlFor="dataSolicitacao">Data Solicitação</Label><Input id="dataSolicitacao" type="date" value={formData.dataSolicitacao || ''} onChange={handleInputChange}/></div>
                        <div className="space-y-1.5"><Label htmlFor="dataVencimento">Data Vencimento</Label><Input id="dataVencimento" type="date" value={formData.dataVencimento || ''} onChange={handleInputChange}/></div>
                        <div className="space-y-1.5"><Label htmlFor="dataDevolucao">Data Devolução</Label><Input id="dataDevolucao" type="date" value={formData.dataDevolucao || ''} onChange={handleInputChange}/></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="coleteNumero">Nº Colete</Label><Input id="coleteNumero" value={formData.coleteNumero || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="status">Status</Label>
                        <Select onValueChange={handleSelectChange} value={formData.status}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Ativo">Ativo</SelectItem>
                                <SelectItem value="Inativo">Inativo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </>
    );
};


// =====================================================================
// Portaria Tab Component
// =====================================================================
const PortariaTab = () => {
    const firestore = useFirestore();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPersonnel, setEditingPersonnel] = useState<WithDocId<GatePersonnel> | null>(null);
    const [formData, setFormData] = useState<Partial<GatePersonnel>>({});
    const [isSaving, setIsSaving] = useState(false);

    const personnelQuery = useMemoFirebase(() => (
        firestore ? query(collection(firestore, 'gate_personnel'), orderBy('name')) : null
    ), [firestore]);

    const { data: personnel, isLoading, error } = useCollection<WithDocId<GatePersonnel>>(personnelQuery, {
        queryKey: ['gate_personnel']
    });

    const filteredPersonnel = useMemo(() => {
        if (!personnel) return [];
        if (!searchTerm) return personnel;
        const lowercasedTerm = searchTerm.toLowerCase();
        return personnel.filter(p => 
            p.name.toLowerCase().includes(lowercasedTerm) ||
            (p.company && p.company.toLowerCase().includes(lowercasedTerm)) ||
            (p.position && p.position.toLowerCase().includes(lowercasedTerm))
        );
    }, [personnel, searchTerm]);

    const handleOpenDialog = (p: WithDocId<GatePersonnel> | null) => {
        if (p) {
            setEditingPersonnel(p);
            setFormData({
                ...p,
                dueDate: p.dueDate ? format(new Date(p.dueDate), 'yyyy-MM-dd') : '',
            });
        } else {
            setEditingPersonnel(null);
            setFormData({
                name: '', company: '', position: '', dueDate: '', accessLevel: '', vestNumber: '', status: 'Ativo'
            });
        }
        setDialogOpen(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (value: 'Ativo' | 'Inativo') => {
        setFormData(prev => ({...prev, status: value}));
    };

    const handleSave = async () => {
        if (!firestore) return;
        if (!formData.name || !formData.company || !formData.position) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Nome, Empresa e Cargo são obrigatórios.' });
            return;
        }

        setIsSaving(true);
        try {
            const dataToSave: Partial<GatePersonnel> = {
                name: formData.name,
                company: formData.company,
                position: formData.position,
                status: formData.status,
                accessLevel: formData.accessLevel,
                vestNumber: formData.vestNumber,
            };

            if (formData.dueDate) {
                const parsed = parse(formData.dueDate, 'yyyy-MM-dd', new Date());
                if (isValid(parsed)) dataToSave.dueDate = parsed.toISOString();
            }

            if (editingPersonnel) {
                const docRef = doc(firestore, 'gate_personnel', editingPersonnel.docId);
                await updateDoc(docRef, dataToSave);
                toast({ title: 'Sucesso', description: 'Dados do pessoal da portaria atualizados.' });
            } else {
                await addDoc(collection(firestore, 'gate_personnel'), dataToSave);
                toast({ title: 'Sucesso', description: 'Novo pessoal da portaria cadastrado.' });
            }
            queryClient.invalidateQueries({ queryKey: ['gate_personnel'] });
            setDialogOpen(false);
        } catch (err: any) {
            console.error("Error saving gate personnel:", err);
            toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível salvar os dados.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (personnelId: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'gate_personnel', personnelId));
            toast({ title: 'Sucesso', description: 'Registro excluído.'});
            queryClient.invalidateQueries({ queryKey: ['gate_personnel'] });
        } catch (err) {
             toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir.'});
        }
    };
    
    return (
      <>
        <Card>
            <CardHeader>
                <CardTitle>Controle da Portaria</CardTitle>
                <CardDescription>Gerencie as credenciais para a equipe da portaria.</CardDescription>
                <div className="flex justify-between items-center pt-4">
                     <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Pesquisar por nome, empresa ou cargo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg bg-background pl-8 md:w-[300px]"
                        />
                    </div>
                    <Button onClick={() => handleOpenDialog(null)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Pessoal
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Cargo</TableHead>
                            <TableHead>Acesso</TableHead>
                            <TableHead>Nº Colete</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={8} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
                        {error && <TableRow><TableCell colSpan={8} className="text-center h-24 text-destructive">{error.message}</TableCell></TableRow>}
                        {!isLoading && filteredPersonnel.length === 0 && <TableRow><TableCell colSpan={8} className="text-center h-24">Nenhum registro encontrado.</TableCell></TableRow>}
                        {!isLoading && filteredPersonnel.map(p => {
                            const status = getCredentialStatus(p.dueDate);
                            return (
                                <TableRow key={p.docId}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell>{p.company}</TableCell>
                                    <TableCell>{p.position}</TableCell>
                                    <TableCell>{p.accessLevel || '-'}</TableCell>
                                    <TableCell>{p.vestNumber || '-'}</TableCell>
                                    <TableCell>{p.dueDate ? format(new Date(p.dueDate), 'dd/MM/yyyy') : '-'}</TableCell>
                                    <TableCell><Badge variant={status.variant}>{status.text}</Badge></TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="icon" onClick={() => handleOpenDialog(p)}><Edit className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                    <AlertDialogDescription>Tem certeza que deseja excluir o registro de <span className="font-bold">{p.name}</span>?</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(p.docId)}>Sim, Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingPersonnel ? 'Editar' : 'Adicionar'} Pessoal da Portaria</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div className="space-y-1.5"><Label htmlFor="name">Nome Completo</Label><Input id="name" value={formData.name || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="company">Empresa</Label><Input id="company" value={formData.company || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="position">Cargo</Label><Input id="position" value={formData.position || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="accessLevel">Acesso</Label><Input id="accessLevel" value={formData.accessLevel || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="vestNumber">Nº Colete</Label><Input id="vestNumber" value={formData.vestNumber || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="dueDate">Vencimento</Label><Input id="dueDate" type="date" value={formData.dueDate || ''} onChange={handleInputChange}/></div>
                    <div className="space-y-1.5"><Label htmlFor="status">Status</Label>
                        <Select onValueChange={handleSelectChange} value={formData.status}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Ativo">Ativo</SelectItem>
                                <SelectItem value="Inativo">Inativo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </>
    );
};


// =====================================================================
// Veículos Tab Component
// =====================================================================
const VeiculosTab = ({ onEdit }: { onEdit: (item: WithDocId<Vehicle>) => void }) => {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const vehiclesQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'vehicles'), orderBy('prefixo')) : null
  ), [firestore]);

  const { data: vehicles, isLoading, error } = useCollection<WithDocId<Vehicle>>(vehiclesQuery, {
      queryKey: ['all_vehicles_for_credenciamento']
  });
  
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    if (!searchTerm) return vehicles;
    const lowercasedTerm = searchTerm.toLowerCase();
    return vehicles.filter(v =>
      v.prefixo.toLowerCase().includes(lowercasedTerm) ||
      v.placa.toLowerCase().includes(lowercasedTerm) ||
      v.modelo.toLowerCase().includes(lowercasedTerm)
    );
  }, [vehicles, searchTerm]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credenciamento de Veículos</CardTitle>
        <CardDescription>Gerencie as credenciais de acesso para a frota de veículos.</CardDescription>
        <div className="relative pt-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por prefixo, placa, modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-background pl-8 md:w-[300px]"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prefixo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Marca/Modelo</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status Credencial</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
            {error && <TableRow><TableCell colSpan={7} className="text-center h-24 text-destructive">{error.message}</TableCell></TableRow>}
            {!isLoading && filteredVehicles.map(vehicle => {
                const status = getCredentialStatus(vehicle.dataVencimento);
                return (
                    <TableRow key={vehicle.docId}>
                        <TableCell className="font-mono">{vehicle.prefixo}</TableCell>
                        <TableCell>{vehicle.placa}</TableCell>
                        <TableCell>{vehicle.marca} {vehicle.modelo}</TableCell>
                        <TableCell>{vehicle.base || '-'}</TableCell>
                        <TableCell>{vehicle.dataVencimento ? format(new Date(vehicle.dataVencimento), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell><Badge variant={status.variant}>{status.text}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="icon" onClick={() => onEdit(vehicle)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                    </TableRow>
                )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};


// =====================================================================
// Main Page Component
// =====================================================================
export default function ControleCredenciamentoPage() {
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        item: WithDocId<Employee> | WithDocId<Vehicle> | null;
        itemType: 'employee' | 'vehicle' | null;
    }>({ isOpen: false, item: null, itemType: null });
    
    const queryClient = useQueryClient();

    const handleOpenDialog = (item: WithDocId<Employee> | WithDocId<Vehicle>, type: 'employee' | 'vehicle') => {
        setDialogState({ isOpen: true, item, itemType: type });
    };

    const handleCloseDialog = () => {
        setDialogState({ isOpen: false, item: null, itemType: null });
    };
    
    const handleSuccess = () => {
        if(dialogState.itemType === 'employee') {
            queryClient.invalidateQueries({ queryKey: ['active_employees_for_credenciamento'] });
            queryClient.invalidateQueries({ queryKey: ['inactive_employees_for_credenciamento'] });
        } else if (dialogState.itemType === 'vehicle') {
            queryClient.invalidateQueries({ queryKey: ['all_vehicles_for_credenciamento'] });
        }
        handleCloseDialog();
    }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Controle de Credenciamento</h1>
      <Tabs defaultValue="funcionarios" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="funcionarios"><Users className="mr-2 h-4 w-4"/> Funcionários</TabsTrigger>
            <TabsTrigger value="veiculos"><Car className="mr-2 h-4 w-4"/> Veículos</TabsTrigger>
            <TabsTrigger value="temporarios"><HardHat className="mr-2 h-4 w-4"/> Temporários</TabsTrigger>
            <TabsTrigger value="portaria">Portaria</TabsTrigger>
            <TabsTrigger value="ex-funcionarios"><Users className="mr-2 h-4 w-4"/> Ex-Funcionários</TabsTrigger>
        </TabsList>
        <TabsContent value="funcionarios">
            <FuncionariosAtivosTab onEdit={(item) => handleOpenDialog(item, 'employee')} />
        </TabsContent>
        <TabsContent value="veiculos">
            <VeiculosTab onEdit={(item) => handleOpenDialog(item, 'vehicle')} />
        </TabsContent>
         <TabsContent value="temporarios">
            <TemporariosTab />
        </TabsContent>
        <TabsContent value="portaria">
            <PortariaTab />
        </TabsContent>
        <TabsContent value="ex-funcionarios">
            <ExFuncionariosTab />
        </TabsContent>
      </Tabs>
      
      <EditCredenciamentoDialog
        isOpen={dialogState.isOpen}
        onClose={handleCloseDialog}
        onSuccess={handleSuccess}
        item={dialogState.item}
        itemType={dialogState.itemType}
      />
    </div>
  );
}
