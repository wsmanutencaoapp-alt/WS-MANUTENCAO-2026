'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Employee, Vehicle } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Edit, Users, Car, HardHat } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import EditCredenciamentoDialog from '@/components/EditCredenciamentoDialog';

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
              <TableHead>Venc. Credencial</TableHead>
              <TableHead>Status Credencial</TableHead>
              <TableHead>Colete</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
            {error && <TableRow><TableCell colSpan={9} className="text-center h-24 text-destructive">{error.message}</TableCell></TableRow>}
            {!isLoading && filteredEmployees.map(employee => {
              const status = getCredentialStatus(employee.credencialVencimento);
              return (
                <TableRow key={employee.docId}>
                  <TableCell className="font-mono">{employee.id}</TableCell>
                  <TableCell className="font-medium">{employee.firstName} {employee.lastName}</TableCell>
                  <TableCell>{employee.base || '-'}</TableCell>
                  <TableCell>{employee.acesso || '-'}</TableCell>
                  <TableCell>{employee.cargo || '-'}</TableCell>
                  <TableCell>{employee.credencialVencimento ? format(new Date(employee.credencialVencimento), 'dd/MM/yyyy') : '-'}</TableCell>
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
                <CardDescription>Lista de funcionários com status "Inativo".</CardDescription>
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
                            <TableHead>Cargo</TableHead>
                             <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
                        {error && <TableRow><TableCell colSpan={4} className="text-center h-24 text-destructive">{error.message}</TableCell></TableRow>}
                        {!isLoading && filteredEmployees.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">Nenhum ex-funcionário encontrado.</TableCell></TableRow>}
                        {!isLoading && filteredEmployees.map(employee => (
                            <TableRow key={employee.docId}>
                                <TableCell className="font-mono">{employee.id}</TableCell>
                                <TableCell className="font-medium">{employee.firstName} {employee.lastName}</TableCell>
                                <TableCell>{employee.cargo || '-'}</TableCell>
                                <TableCell><Badge variant="destructive">{employee.status}</Badge></TableCell>
                            </TableRow>
                        ))}
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
    return (
        <Card>
            <CardHeader>
                <CardTitle>Controle de Temporários</CardTitle>
                <CardDescription>Gerencie as credenciais para funcionários temporários e terceirizados.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center gap-4 py-8 h-64 border-2 border-dashed rounded-lg">
                    <HardHat className="h-16 w-16 text-muted-foreground"/>
                    <p className="text-muted-foreground">Esta funcionalidade está em construção.</p>
                </div>
            </CardContent>
        </Card>
    );
};


// =====================================================================
// Portaria Tab Component
// =====================================================================
const PortariaTab = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Controle da Portaria</CardTitle>
                <CardDescription>Gerencie as credenciais para a equipe da portaria.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center gap-4 py-8 h-64 border-2 border-dashed rounded-lg">
                    <HardHat className="h-16 w-16 text-muted-foreground"/>
                    <p className="text-muted-foreground">Esta funcionalidade está em construção.</p>
                </div>
            </CardContent>
        </Card>
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
              <TableHead>Venc. Credencial</TableHead>
              <TableHead>Status Credencial</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
            {error && <TableRow><TableCell colSpan={7} className="text-center h-24 text-destructive">{error.message}</TableCell></TableRow>}
            {!isLoading && filteredVehicles.map(vehicle => {
                const status = getCredentialStatus(vehicle.credencialVencimento);
                return (
                    <TableRow key={vehicle.docId}>
                        <TableCell className="font-mono">{vehicle.prefixo}</TableCell>
                        <TableCell>{vehicle.placa}</TableCell>
                        <TableCell>{vehicle.marca} {vehicle.modelo}</TableCell>
                        <TableCell>{vehicle.base || '-'}</TableCell>
                        <TableCell>{vehicle.credencialVencimento ? format(new Date(vehicle.credencialVencimento), 'dd/MM/yyyy') : '-'}</TableCell>
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
        } else {
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
