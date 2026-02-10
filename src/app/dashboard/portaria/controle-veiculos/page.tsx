
'use client';

import { useState, useMemo } from 'react';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
  useDoc,
} from '@/firebase';
import {
  collection,
  query,
  where,
  addDoc,
  doc,
  writeBatch,
  orderBy,
  deleteDoc,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, ArrowLeft, Trash2, User, Info } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import type { Vehicle, VehicleMovement, Employee } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const ControleVeiculosPage = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'saida' | 'entrada' | null;
  }>({ isOpen: false, type: null });

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('');
  const [km, setKm] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isExternalVehicle, setIsExternalVehicle] = useState(false);
  const [externalPlate, setExternalPlate] = useState('');

  const [isVehiclePopoverOpen, setVehiclePopoverOpen] = useState(false);
  const [movementDetails, setMovementDetails] = useState<WithDocId<VehicleMovement> | null>(null);
  
  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'employees', user.uid) : null),
    [firestore, user]
  );
  const { data: employeeData } = useDoc<Employee>(userDocRef);
  const isAdmin = useMemo(() => employeeData?.accessLevel === 'Admin', [employeeData]);

  // Queries
  const vehiclesQueryKey = 'allVehiclesForGate';
  const vehiclesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'vehicles')) : null),
    [firestore]
  );
  const { data: allVehicles, isLoading: isLoadingVehicles } =
    useCollection<WithDocId<Vehicle>>(vehiclesQuery, {
      queryKey: [vehiclesQueryKey],
    });

  const movementsQueryKey = 'vehicleMovements';
  const movementsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'vehicle_movements'), orderBy('date', 'desc'))
        : null,
    [firestore]
  );
  const { data: movements, isLoading: isLoadingMovements } =
    useCollection<WithDocId<VehicleMovement>>(movementsQuery, {
      queryKey: [movementsQueryKey],
    });
    
  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId || !allVehicles) return null;
    return allVehicles.find(v => v.docId === selectedVehicleId) || null;
  }, [selectedVehicleId, allVehicles]);


  const vehiclesForDialog = useMemo(() => {
    if (!allVehicles) return [];
    if (dialogState.type === 'saida') {
      return allVehicles.filter((v) => v.status === 'Ativo');
    }
    if (dialogState.type === 'entrada') {
      return allVehicles.filter((v) => v.status === 'Em Viagem');
    }
    return [];
  }, [allVehicles, dialogState.type]);

  const resetForm = () => {
    setSelectedVehicleId(null);
    setDriverName('');
    setKm('');
    setNotes('');
    setIsExternalVehicle(false);
    setExternalPlate('');
  };

  const handleOpenDialog = (type: 'saida' | 'entrada') => {
    resetForm();
    setDialogState({ isOpen: true, type });
  };

  const handleCloseDialog = () => {
    setDialogState({ isOpen: false, type: null });
  };

  const handleSave = async () => {
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
      return;
    }
    
    try {
        if (dialogState.type === 'entrada' && isExternalVehicle) {
            if (!externalPlate || !driverName) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Placa e motorista são obrigatórios para veículo externo.' });
                return;
            }

            const movementData: Partial<VehicleMovement> = {
                vehiclePlaca: externalPlate.toUpperCase(),
                driverName: driverName,
                type: 'entrada',
                date: new Date().toISOString(),
                notes: notes,
                isExternal: true,
            };
            
            await addDoc(collection(firestore, 'vehicle_movements'), movementData);

        } else { // Internal vehicle logic for both 'entrada' and 'saida'
            if (!selectedVehicle || !driverName) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Veículo e motorista são obrigatórios.' });
                return;
            }
            if (!isExternalVehicle && !km) {
                toast({ variant: 'destructive', title: 'Erro', description: 'KM é obrigatório para veículos da frota.' });
                return;
            }

            const batch = writeBatch(firestore);
            const movementRef = doc(collection(firestore, 'vehicle_movements'));
            const movementData: Omit<VehicleMovement, 'id' | 'isExternal'> = {
                vehicleId: selectedVehicle.docId,
                vehiclePrefixo: selectedVehicle.prefixo,
                vehiclePlaca: selectedVehicle.placa,
                driverName: driverName,
                type: dialogState.type!,
                date: new Date().toISOString(),
                km: Number(km),
                notes: notes,
            };
            batch.set(movementRef, movementData);
            
            const vehicleRef = doc(firestore, 'vehicles', selectedVehicle.docId);
            const newStatus = dialogState.type === 'saida' ? 'Em Viagem' : 'Ativo';
            batch.update(vehicleRef, { status: newStatus });
            await batch.commit();
        }

        toast({ title: 'Sucesso!', description: `Registro de ${dialogState.type} salvo.` });
        queryClient.invalidateQueries({ queryKey: [vehiclesQueryKey] });
        queryClient.invalidateQueries({ queryKey: [movementsQueryKey] });
        handleCloseDialog();

    } catch (err) {
        console.error('Erro ao salvar movimentação:', err);
        toast({
            variant: 'destructive',
            title: 'Erro na Operação',
            description: 'Não foi possível salvar a movimentação do veículo.',
        });
    }
  };
  
  const handleDeleteMovement = async (movementId: string) => {
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível.' });
        return;
    }
    try {
      await deleteDoc(doc(firestore, 'vehicle_movements', movementId));
      toast({
        title: 'Sucesso!',
        description: 'Registro de movimentação excluído.',
      });
      queryClient.invalidateQueries({ queryKey: [movementsQueryKey] });
    } catch (e) {
      console.error('Erro ao excluir movimentação:', e);
      toast({
        variant: 'destructive',
        title: 'Erro na Exclusão',
        description: 'Não foi possível excluir o registro. Verifique suas permissões.',
      });
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Controle de Veículos</h1>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => handleOpenDialog('saida')}>
            <ArrowRight className="mr-2" />
            Registrar Saída
          </Button>
          <Button variant="outline" onClick={() => handleOpenDialog('entrada')}>
            <ArrowLeft className="mr-2" />
            Registrar Entrada
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Movimentações</CardTitle>
          <CardDescription>
            Últimas entradas e saídas de veículos registradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>KM</TableHead>
                <TableHead className="text-center">Detalhes</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingMovements && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoadingMovements && movements?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="h-24 text-center">
                    Nenhuma movimentação registrada.
                  </TableCell>
                </TableRow>
              )}
              {movements?.map((mov) => (
                <TableRow key={mov.docId}>
                  <TableCell>
                    <Badge
                      variant={mov.type === 'saida' ? 'destructive' : 'success'}
                    >
                      {mov.type.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(mov.date), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{mov.isExternal ? 'EXTERNO' : mov.vehiclePrefixo}</div>
                    <div className="text-sm text-muted-foreground">
                      {mov.vehiclePlaca}
                    </div>
                  </TableCell>
                  <TableCell>{mov.driverName}</TableCell>
                  <TableCell>{mov.km?.toLocaleString('pt-BR') ?? 'N/A'}</TableCell>
                   <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => setMovementDetails(mov)}>
                        <Info className="h-4 w-4" />
                        <span className="sr-only">Ver Detalhes</span>
                    </Button>
                  </TableCell>
                   {isAdmin && (
                    <TableCell className="text-right">
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir este registro de movimentação? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteMovement(mov.docId)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogState.isOpen} onOpenChange={handleCloseDialog} modal={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Registrar {dialogState.type === 'saida' ? 'Saída' : 'Entrada'} de Veículo
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {dialogState.type === 'entrada' && (
              <div className="flex items-center space-x-2">
                  <Switch
                      id="external-vehicle"
                      checked={isExternalVehicle}
                      onCheckedChange={setIsExternalVehicle}
                  />
                  <Label htmlFor="external-vehicle">Veículo Externo</Label>
              </div>
            )}
            
            {dialogState.type === 'entrada' && isExternalVehicle ? (
              <div className="space-y-1.5">
                <Label htmlFor="externalPlate">Placa do Veículo <span className="text-destructive">*</span></Label>
                <Input
                  id="externalPlate"
                  value={externalPlate}
                  onChange={(e) => setExternalPlate(e.target.value.toUpperCase())}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Veículo <span className="text-destructive">*</span></Label>
                <Popover
                  open={isVehiclePopoverOpen}
                  onOpenChange={setVehiclePopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedVehicleId
                        ? allVehicles?.find(v => v.docId === selectedVehicleId)?.prefixo
                          ? `${allVehicles?.find(v => v.docId === selectedVehicleId)?.prefixo} - ${allVehicles?.find(v => v.docId === selectedVehicleId)?.placa}`
                          : 'Selecione um veículo...'
                        : 'Selecione um veículo...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar prefixo, placa ou modelo..." />
                      <CommandList>
                        <CommandEmpty>Nenhum veículo encontrado.</CommandEmpty>
                        <CommandGroup>
                          {vehiclesForDialog.map((vehicle) => (
                            <CommandItem
                              key={vehicle.docId}
                              value={vehicle.docId}
                              onSelect={(currentValue) => {
                                setSelectedVehicleId(currentValue === selectedVehicleId ? null : currentValue);
                                setVehiclePopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedVehicleId === vehicle.docId
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              {vehicle.prefixo} - {vehicle.placa} ({vehicle.modelo})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="driverName">Nome do Motorista <span className="text-destructive">*</span></Label>
              <Input
                id="driverName"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </div>
            {!(dialogState.type === 'entrada' && isExternalVehicle) && (
              <div className="space-y-1.5">
                <Label htmlFor="km">Quilometragem (KM) <span className="text-destructive">*</span></Label>
                <Input
                  id="km"
                  type="number"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: avarias, nível de combustível, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {movementDetails && (
        <Dialog open={!!movementDetails} onOpenChange={() => setMovementDetails(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Detalhes da Movimentação</DialogTitle>
                    <DialogDescription>
                        Registro de {movementDetails.type} para {movementDetails.vehiclePrefixo || movementDetails.vehiclePlaca} em {format(new Date(movementDetails.date), 'dd/MM/yyyy HH:mm')}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="font-medium text-muted-foreground">Veículo</p>
                            <p>{movementDetails.vehiclePrefixo} ({movementDetails.vehiclePlaca})</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground">Motorista</p>
                            <p>{movementDetails.driverName}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="font-medium text-muted-foreground">Tipo</p>
                            <p>{movementDetails.type === 'saida' ? 'Saída' : 'Entrada'}</p>
                        </div>
                        <div>
                            <p className="font-medium text-muted-foreground">KM</p>
                            <p>{movementDetails.km?.toLocaleString('pt-BR') ?? 'N/A'}</p>
                        </div>
                    </div>
                    <div>
                        <p className="font-medium text-muted-foreground">Observações</p>
                        <p className="mt-1 rounded-md border bg-muted p-3">
                            {movementDetails.notes || 'Nenhuma observação registrada.'}
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setMovementDetails(null)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ControleVeiculosPage;
