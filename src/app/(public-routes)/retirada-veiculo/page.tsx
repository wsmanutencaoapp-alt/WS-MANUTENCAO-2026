'use client';

import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import {
  collection,
  query,
  where,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, ChevronsUpDown, Check, AlertTriangle, Car, LogIn, LogOut } from 'lucide-react';
import type { Vehicle, VehicleMovement } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

function VehicleMovementComponent() {
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const vehicleIdFromUrl = searchParams.get('vehicleId');

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('');
  const [km, setKm] = useState('');
  const [notes, setNotes] = useState('');
  const [isVehiclePopoverOpen, setVehiclePopoverOpen] = useState(false);

  // Set selected vehicle ID from URL after client-side hydration
  useEffect(() => {
    if (vehicleIdFromUrl) {
      setSelectedVehicleId(vehicleIdFromUrl);
    }
  }, [vehicleIdFromUrl]);

  // Data fetching
  const vehicleFromUrlRef = useMemoFirebase(() => {
    if (firestore && vehicleIdFromUrl) {
      return doc(firestore, 'vehicles', vehicleIdFromUrl);
    }
    return null;
  }, [firestore, vehicleIdFromUrl]);

  const { data: vehicleFromUrl, isLoading: isLoadingVehicleFromUrl } = useDoc<WithDocId<Vehicle>>(vehicleFromUrlRef, {
      queryKey: ['vehicle_by_id', vehicleIdFromUrl],
      enabled: !!vehicleIdFromUrl,
  });

  const { data: allVehicles, isLoading: isLoadingVehicles } = useCollection<WithDocId<Vehicle>>(useMemoFirebase(() => (firestore ? collection(firestore, 'vehicles') : null), [firestore]), {
      queryKey: ['allVehiclesForGate'],
      enabled: !vehicleIdFromUrl,
  });


  const selectedVehicle = useMemo(() => {
    if (vehicleIdFromUrl) return vehicleFromUrl;
    return allVehicles?.find(v => v.docId === selectedVehicleId);
  }, [vehicleIdFromUrl, vehicleFromUrl, allVehicles, selectedVehicleId]);
  
  const resetForm = () => {
      if (!vehicleIdFromUrl) {
          setSelectedVehicleId(null);
      }
      setDriverName('');
      setKm('');
      setNotes('');
  }

  const handleCheckout = async () => {
    if (!selectedVehicle || !driverName || !km) {
        toast({ variant: 'destructive', title: 'Campos Obrigatórios', description: 'Por favor, preencha todos os campos.' });
        return;
    }
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível. Tente novamente.' });
        return;
    }

    setIsSubmitting(true);

    try {
        const batch = writeBatch(firestore);

        const movementRef = doc(collection(firestore, 'vehicle_movements'));
        const movementData: Omit<VehicleMovement, 'id' | 'isExternal' | 'driverPhotoUrl'> = {
            vehicleId: selectedVehicle.docId,
            vehiclePrefixo: selectedVehicle.prefixo,
            vehiclePlaca: selectedVehicle.placa,
            driverName: driverName,
            type: 'saida',
            date: new Date().toISOString(),
            km: Number(km),
            notes: notes,
        };
        batch.set(movementRef, movementData);

        const vehicleRef = doc(firestore, 'vehicles', selectedVehicle.docId);
        batch.update(vehicleRef, { status: 'Em Viagem' });
        
        await batch.commit();
        
        toast({ title: 'Sucesso!', description: `Saída do veículo ${selectedVehicle.prefixo} registrada.` });
        
        queryClient.invalidateQueries({ queryKey: ['allVehiclesForGate'] });
        queryClient.invalidateQueries({ queryKey: ['vehicleMovements'] });
        queryClient.invalidateQueries({ queryKey: ['vehicle_by_id', vehicleIdFromUrl] });
        
        resetForm();

    } catch (error) {
        console.error('Error submitting vehicle checkout:', error);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível registrar a saída do veículo.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedVehicle || !driverName || !km) {
      toast({ variant: 'destructive', title: 'Campos Obrigatórios', description: 'Por favor, preencha todos os campos.' });
      return;
    }
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível. Tente novamente.' });
      return;
    }
    setIsSubmitting(true);

    try {
      const batch = writeBatch(firestore);
      const movementRef = doc(collection(firestore, 'vehicle_movements'));
      const movementData: Omit<VehicleMovement, 'id' | 'isExternal' | 'driverPhotoUrl'> = {
          vehicleId: selectedVehicle.docId,
          vehiclePrefixo: selectedVehicle.prefixo,
          vehiclePlaca: selectedVehicle.placa,
          driverName,
          type: 'entrada',
          date: new Date().toISOString(),
          km: Number(km),
          notes: notes,
      };
      batch.set(movementRef, movementData);

      const vehicleRef = doc(firestore, 'vehicles', selectedVehicle.docId);
      batch.update(vehicleRef, { status: 'Ativo' });
      
      await batch.commit();
      
      toast({ title: 'Sucesso!', description: `Devolução do veículo ${selectedVehicle.prefixo} registrada.` });
      
      queryClient.invalidateQueries({ queryKey: ['allVehiclesForGate'] });
      queryClient.invalidateQueries({ queryKey: ['vehicleMovements'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle_by_id', vehicleIdFromUrl] });

      resetForm();

    } catch (error) {
      console.error('Error submitting vehicle check-in:', error);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível registrar a devolução do veículo.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoadingVehicleFromUrl || (!vehicleIdFromUrl && isLoadingVehicles)) {
      return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin"/>
        </div>
      )
  }

  if (!selectedVehicleId) {
       return (
        <div className="mx-auto w-full max-w-md space-y-6 py-12 px-4">
            <div className="text-center">
                <h1 className="text-3xl font-bold">Portaria de Veículos</h1>
                <p className="text-muted-foreground">Selecione um veículo para registrar a entrada ou saída.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Selecionar Veículo</CardTitle>
                </CardHeader>
                <CardContent>
                     <Popover open={isVehiclePopoverOpen} onOpenChange={setVehiclePopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal"
                            disabled={isLoadingVehicles}
                            >
                            {isLoadingVehicles ? <Loader2 className="h-4 w-4 animate-spin"/> : selectedVehicle ? `${selectedVehicle.prefixo} - ${selectedVehicle.placa}` : "Selecione um veículo..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                            <CommandInput placeholder="Buscar prefixo, placa..." />
                            <CommandList>
                                <CommandEmpty>Nenhum veículo disponível.</CommandEmpty>
                                <CommandGroup>
                                {allVehicles?.map((vehicle) => (
                                    <CommandItem
                                    key={vehicle.docId}
                                    value={`${vehicle.prefixo} ${vehicle.placa}`}
                                    onSelect={() => {
                                        setSelectedVehicleId(vehicle.docId);
                                        setVehiclePopoverOpen(false);
                                    }}
                                    >
                                    <Check
                                        className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedVehicleId === vehicle.docId ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {vehicle.prefixo} - {vehicle.placa} ({vehicle.status})
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </CardContent>
            </Card>
        </div>
      );
  }

  if (!selectedVehicle) {
       return (
            <div className="flex h-screen w-full items-center justify-center text-center p-4">
                <Card className="max-w-md">
                    <CardContent className="p-8">
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Veículo Não Encontrado</AlertTitle>
                            <AlertDescription>O veículo solicitado não foi encontrado em nosso sistema. Verifique o QR Code e tente novamente.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
       )
  }

  if (selectedVehicle.status === 'Ativo') {
      return (
        <div className="mx-auto w-full max-w-md space-y-6 py-4 px-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Retirada de Veículo</h1>
            <p className="text-muted-foreground">Preencha os dados para registrar a retirada.</p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Dados da Retirada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-1.5">
                  <Label htmlFor="vehicle">Veículo</Label>
                    <div className="p-3 border rounded-md bg-muted">
                        <p className="font-bold">{selectedVehicle.prefixo} - ${selectedVehicle.placa}</p>
                        <p className="text-sm text-muted-foreground">{selectedVehicle.marca} {selectedVehicle.modelo}</p>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="driverName">Nome do Motorista</Label>
                    <Input id="driverName" placeholder="Ex: João da Silva" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                </div>
                 <div className="space-y-1.5">
                    <Label htmlFor="km">KM Atual</Label>
                    <Input id="km" type="number" placeholder="Ex: 123456" value={km} onChange={(e) => setKm(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="notes">Avarias ou Observações (Opcional)</Label>
                    <Textarea id="notes" placeholder="Ex: Risco no para-choque, pneu baixo..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
            </CardContent>
          </Card>
          
           <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button disabled={isSubmitting} className="w-full text-lg py-6">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <LogOut className="mr-2 h-5 w-5"/>
                        Concluir Retirada
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Operação</AlertDialogTitle>
                        <AlertDialogDescription>
                            ATENÇÃO: TEM CERTEZA QUE DESEJA CONCLUIR? NÃO QUER INFORMAR ALGUMA AVARIA OU OBSERVAÇÃO?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCheckout} disabled={isSubmitting}>
                            {isSubmitting ? 'Concluindo...' : 'Sim, Concluir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      );
  } else if (selectedVehicle.status === 'Em Viagem') {
      return (
        <div className="mx-auto w-full max-w-md space-y-6 py-4 px-4">
            <div className="text-center">
                <h1 className="text-3xl font-bold">Devolução de Veículo</h1>
                <p className="text-muted-foreground">Registre a entrada do veículo na base.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Dados do Veículo</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="p-3 border rounded-md bg-yellow-100 dark:bg-yellow-900/20">
                        <p className="font-bold">{selectedVehicle.prefixo} - ${selectedVehicle.placa}</p>
                        <p className="text-sm text-muted-foreground">{selectedVehicle.marca} {selectedVehicle.modelo}</p>
                        <Badge variant="warning" className="mt-2">Em Viagem</Badge>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle>Dados da Devolução</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="driverName">Nome do Motorista</Label>
                        <Input id="driverName" placeholder="Ex: João da Silva" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="km">KM na Chegada</Label>
                        <Input id="km" type="number" placeholder="Ex: 123999" value={km} onChange={(e) => setKm(e.target.value)} />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="notes">Avarias ou Observações (Opcional)</Label>
                        <Textarea id="notes" placeholder="Relate qualquer problema ocorrido durante a viagem." value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                </CardContent>
            </Card>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button disabled={isSubmitting} className="w-full text-lg py-6">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <LogIn className="mr-2 h-5 w-5"/>
                        Concluir Devolução
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Operação</AlertDialogTitle>
                        <AlertDialogDescription>
                            ATENÇÃO: TEM CERTEZA QUE DESEJA CONCLUIR? NÃO QUER INFORMAR ALGUMA AVARIA OU OBSERVAÇÃO?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCheckIn} disabled={isSubmitting}>
                            {isSubmitting ? 'Concluindo...' : 'Sim, Concluir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      );
  } else {
    return (
        <div className="mx-auto w-full max-w-md space-y-6 py-12 px-4">
            <Card>
                <CardHeader className="text-center">
                    <CardTitle>{selectedVehicle.prefixo}</CardTitle>
                    <CardDescription>{selectedVehicle.placa}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
                    <AlertTriangle className="h-16 w-16 text-destructive"/>
                    <p className="text-lg font-semibold">Veículo Indisponível</p>
                    <p className="text-muted-foreground">Status atual: <Badge variant="destructive">{selectedVehicle.status}</Badge></p>
                    <p className="text-center text-sm text-muted-foreground">Este veículo não pode ser retirado ou devolvido no momento.</p>
                </CardContent>
            </Card>
        </div>
    );
  }
}


export default function RetiradaVeiculoPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin"/></div>}>
            <VehicleMovementComponent />
        </Suspense>
    );
}
