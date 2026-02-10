'use client';

import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useFirestore, useStorage, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import {
  collection,
  query,
  where,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Camera, RefreshCw, Loader2, ChevronsUpDown, Check } from 'lucide-react';
import Image from 'next/image';

import type { Vehicle, VehicleMovement } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

function VehicleCheckoutComponent() {
  const firestore = useFirestore();
  const storage = useStorage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const vehicleIdFromUrl = searchParams.get('vehicleId');

  // State
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('');
  const [km, setKm] = useState('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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

  const availableVehiclesQuery = useMemoFirebase(
    () => (firestore && !vehicleIdFromUrl ? query(collection(firestore, 'vehicles'), where('status', '==', 'Ativo')) : null),
    [firestore, vehicleIdFromUrl]
  );
  const { data: availableVehicles, isLoading: isLoadingVehicles } = useCollection<WithDocId<Vehicle>>(availableVehiclesQuery, {
      enabled: !vehicleIdFromUrl,
  });
  
  const selectedVehicle = useMemo(() => {
    if (vehicleIdFromUrl) return vehicleFromUrl;
    return availableVehicles?.find(v => v.docId === selectedVehicleId);
  }, [vehicleIdFromUrl, vehicleFromUrl, availableVehicles, selectedVehicleId]);


  useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({ variant: 'destructive', title: 'Erro de Câmera', description: 'Seu navegador não suporta o acesso à câmera.' });
        setHasCameraPermission(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Acesso à Câmera Negado',
          description: 'Por favor, habilite a permissão de câmera nas configurações do seu navegador para usar esta funcionalidade.',
        });
      }
    };

    getCameraPermission();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        const dataUrl = canvas.toDataURL('image/jpeg');
        setSelfie(dataUrl);
    }
  };

  const retakePhoto = () => {
    setSelfie(null);
  };
  
  const resetForm = () => {
      setSelfie(null);
      if (!vehicleIdFromUrl) {
          setSelectedVehicleId(null);
      }
      setDriverName('');
      setKm('');
  }

  const handleSubmit = async () => {
    if (!selfie || !selectedVehicle || !driverName || !km) {
        toast({ variant: 'destructive', title: 'Campos Obrigatórios', description: 'Por favor, tire uma selfie e preencha todos os campos.' });
        return;
    }
    if (!firestore || !storage) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviço indisponível. Tente novamente.' });
        return;
    }

    setIsSubmitting(true);

    try {
        const filePath = `selfie_retirada/${selectedVehicle.docId}_${Date.now()}.jpg`;
        const storageReference = storageRef(storage, filePath);
        const snapshot = await uploadString(storageReference, selfie, 'data_url');
        const downloadURL = await getDownloadURL(snapshot.ref);

        const batch = writeBatch(firestore);

        const movementRef = doc(collection(firestore, 'vehicle_movements'));
        const movementData: Omit<VehicleMovement, 'id' | 'isExternal' | 'driverPhotoUrl'> & {driverPhotoUrl: string} = {
            vehicleId: selectedVehicle.docId,
            vehiclePrefixo: selectedVehicle.prefixo,
            vehiclePlaca: selectedVehicle.placa,
            driverName: driverName,
            driverPhotoUrl: downloadURL,
            type: 'saida',
            date: new Date().toISOString(),
            km: Number(km),
        };
        batch.set(movementRef, movementData);

        const vehicleRef = doc(firestore, 'vehicles', selectedVehicle.docId);
        batch.update(vehicleRef, { status: 'Em Viagem' });
        
        await batch.commit();
        
        toast({ title: 'Sucesso!', description: `Saída do veículo ${selectedVehicle.prefixo} registrada.` });
        
        queryClient.invalidateQueries({ queryKey: ['allVehiclesForGate'] });
        queryClient.invalidateQueries({ queryKey: ['vehicleMovements'] });
        
        resetForm();

    } catch (error) {
        console.error('Error submitting vehicle checkout:', error);
        toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível registrar a saída do veículo.' });
    } finally {
        setIsSubmitting(false);
    }
  };


  return (
    <div className="mx-auto w-full max-w-md space-y-6 py-4 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Retirada de Veículo</h1>
        <p className="text-muted-foreground">Tire uma selfie para registrar a retirada.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Camera /> Selfie do Motorista</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="w-full aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center relative">
            {hasCameraPermission === false && (
                <Alert variant="destructive" className="m-4">
                    <AlertTitle>Câmera Indisponível</AlertTitle>
                    <AlertDescription>
                        Não foi possível acessar sua câmera. Verifique as permissões.
                    </AlertDescription>
                </Alert>
            )}
             <video
              ref={videoRef}
              className={cn("w-full h-full object-cover", selfie ? 'hidden' : 'block')}
              autoPlay
              muted
              playsInline
            />
            {selfie && (
                <Image src={selfie} alt="Selfie do motorista" layout="fill" objectFit="cover" />
            )}
             <canvas ref={canvasRef} className="hidden" />
          </div>

          {selfie ? (
             <Button variant="outline" onClick={retakePhoto} className="w-full">
                <RefreshCw className="mr-2" /> Tirar Outra Foto
             </Button>
          ) : (
             <Button onClick={takePhoto} disabled={!hasCameraPermission} className="w-full">
                <Camera className="mr-2" /> Tirar Foto
             </Button>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Dados da Retirada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-1.5">
              <Label htmlFor="vehicle">Veículo</Label>
              {vehicleIdFromUrl ? (
                isLoadingVehicleFromUrl ? (
                    <Skeleton className="h-10 w-full" />
                ) : vehicleFromUrl ? (
                    <div className="p-3 border rounded-md bg-muted">
                        <p className="font-bold">{vehicleFromUrl.prefixo} - {vehicleFromUrl.placa}</p>
                        <p className="text-sm text-muted-foreground">{vehicleFromUrl.marca} {vehicleFromUrl.modelo}</p>
                    </div>
                ) : (
                    <Alert variant="destructive"><AlertDescription>Veículo não encontrado.</AlertDescription></Alert>
                )
              ) : (
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
                          {availableVehicles?.map((vehicle) => (
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
                              {vehicle.prefixo} - {vehicle.placa} ({vehicle.modelo})
                              </CommandItem>
                          ))}
                          </CommandGroup>
                      </CommandList>
                      </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="driverName">Nome do Motorista</Label>
                <Input id="driverName" placeholder="Ex: João da Silva" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="km">KM Atual</Label>
                <Input id="km" type="number" placeholder="Ex: 123456" value={km} onChange={(e) => setKm(e.target.value)} />
            </div>
        </CardContent>
      </Card>
      
       <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full text-lg py-6">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Concluir Retirada
        </Button>
    </div>
  );
}


export default function RetiradaVeiculoPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin"/></div>}>
            <VehicleCheckoutComponent />
        </Suspense>
    );
}
