'use client';

import { useState, useMemo } from 'react';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
} from '@/firebase';
import {
  collection,
  query,
  where,
  addDoc,
  doc,
  writeBatch,
  orderBy,
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
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import type { Vehicle, VehicleMovement } from '@/lib/types';
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

const PortariaPage = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'saida' | 'entrada' | null;
  }>({ isOpen: false, type: null });

  const [formData, setFormData] = useState({
    vehicleId: '',
    driverName: '',
    km: '',
    notes: '',
  });

  const [isVehiclePopoverOpen, setVehiclePopoverOpen] = useState(false);

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
    setFormData({ vehicleId: '', driverName: '', km: '', notes: '' });
  };

  const handleOpenDialog = (type: 'saida' | 'entrada') => {
    resetForm();
    setDialogState({ isOpen: true, type });
  };

  const handleCloseDialog = () => {
    setDialogState({ isOpen: false, type: null });
  };

  const handleSave = async () => {
    if (!firestore || !user || !formData.vehicleId || !formData.driverName || !formData.km) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Veículo, motorista e KM são obrigatórios.',
      });
      return;
    }

    const selectedVehicle = allVehicles?.find(
      (v) => v.docId === formData.vehicleId
    );
    if (!selectedVehicle) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Veículo selecionado não encontrado.',
      });
      return;
    }

    try {
      const batch = writeBatch(firestore);

      // Create Movement Record
      const movementRef = doc(collection(firestore, 'vehicle_movements'));
      const movementData: Omit<VehicleMovement, 'id'> = {
        vehicleId: selectedVehicle.docId,
        vehiclePrefixo: selectedVehicle.prefixo,
        vehiclePlaca: selectedVehicle.placa,
        driverName: formData.driverName,
        type: dialogState.type!,
        date: new Date().toISOString(),
        km: Number(formData.km),
        notes: formData.notes,
      };
      batch.set(movementRef, movementData);

      // Update Vehicle Status
      const vehicleRef = doc(firestore, 'vehicles', selectedVehicle.docId);
      const newStatus = dialogState.type === 'saida' ? 'Em Viagem' : 'Ativo';
      batch.update(vehicleRef, { status: newStatus });

      await batch.commit();

      toast({
        title: 'Sucesso!',
        description: `Registro de ${dialogState.type} para o veículo ${selectedVehicle.prefixo} salvo.`,
      });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Controle de Portaria</h1>
        <div className="flex gap-2">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingMovements && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoadingMovements && movements?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
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
                    <div className="font-medium">{mov.vehiclePrefixo}</div>
                    <div className="text-sm text-muted-foreground">
                      {mov.vehiclePlaca}
                    </div>
                  </TableCell>
                  <TableCell>{mov.driverName}</TableCell>
                  <TableCell>{mov.km.toLocaleString('pt-BR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogState.isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Registrar {dialogState.type === 'saida' ? 'Saída' : 'Entrada'} de Veículo
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label>Veículo</Label>
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
                    {formData.vehicleId
                      ? vehiclesForDialog.find(
                          (v) => v.docId === formData.vehicleId
                        )?.prefixo
                      : 'Selecione um veículo...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar prefixo ou placa..." />
                    <CommandList>
                      <CommandEmpty>Nenhum veículo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {vehiclesForDialog.map((vehicle) => (
                          <CommandItem
                            key={vehicle.docId}
                            value={`${vehicle.prefixo} ${vehicle.placa}`}
                            onSelect={() => {
                              setFormData((prev) => ({
                                ...prev,
                                vehicleId: vehicle.docId,
                              }));
                              setVehiclePopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                formData.vehicleId === vehicle.docId
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            {vehicle.prefixo} - {vehicle.placa}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driverName">Nome do Motorista</Label>
              <Input
                id="driverName"
                value={formData.driverName}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, driverName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="km">Quilometragem (KM)</Label>
              <Input
                id="km"
                type="number"
                value={formData.km}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, km: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, notes: e.target.value }))
                }
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
    </div>
  );
};

export default PortariaPage;

    