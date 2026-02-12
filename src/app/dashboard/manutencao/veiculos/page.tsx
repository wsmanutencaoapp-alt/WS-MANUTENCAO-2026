'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Vehicle } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Car } from 'lucide-react';
import VehicleMaintenanceInfo from '@/components/VehicleMaintenanceInfo';

export default function ManutencaoVeiculosPage() {
  const firestore = useFirestore();

  const vehiclesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'vehicles'), orderBy('prefixo')) : null),
    [firestore]
  );
  const { data: vehicles, isLoading, error } = useCollection<WithDocId<Vehicle>>(vehiclesQuery, {
      queryKey: ['allVehiclesForMaintenance']
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center">
            <Car className="mr-2"/>
            Manutenção da Frota
        </h1>
      </div>
      
      {isLoading && <Loader2 className="mx-auto h-8 w-8 animate-spin" />}
      {error && <p className="text-destructive text-center">Erro ao carregar veículos: {error.message}</p>}
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {!isLoading && vehicles?.map(vehicle => (
          <Card key={vehicle.docId}>
            <CardHeader>
              <CardTitle>{vehicle.prefixo} - {vehicle.placa}</CardTitle>
              <CardDescription>{vehicle.marca} {vehicle.modelo} ({vehicle.ano})</CardDescription>
            </CardHeader>
            <CardContent>
              <VehicleMaintenanceInfo vehicle={vehicle} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
