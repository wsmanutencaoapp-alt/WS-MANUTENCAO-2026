'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Vehicle, MaintenancePlan, MaintenanceRecord } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Button } from './ui/button';
import { PlusCircle, Wrench, History } from 'lucide-react';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import MaintenancePlanDialog from './MaintenancePlanDialog';
import MaintenanceRecordDialog from './MaintenanceRecordDialog';
import MaintenanceHistoryDialog from './MaintenanceHistoryDialog'; // Will be created later if needed

interface VehicleMaintenanceInfoProps {
  vehicle: WithDocId<Vehicle>;
}

export default function VehicleMaintenanceInfo({ vehicle }: VehicleMaintenanceInfoProps) {
  const firestore = useFirestore();
  const queryClient = useQueryClient();

  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedPlanForRecord, setSelectedPlanForRecord] = useState<WithDocId<MaintenancePlan> | null>(null);

  const plansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'vehicles', vehicle.docId, 'maintenance_plans'), orderBy('serviceType'));
  }, [firestore, vehicle.docId]);

  const { data: plans, isLoading: isLoadingPlans, error: plansError } = useCollection<WithDocId<MaintenancePlan>>(plansQuery, {
    queryKey: ['maintenancePlans', vehicle.docId]
  });

  const handleOpenRecordDialog = (plan: WithDocId<MaintenancePlan>) => {
    setSelectedPlanForRecord(plan);
    setIsRecordDialogOpen(true);
  };
  
  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['maintenancePlans', vehicle.docId] });
    setIsPlanDialogOpen(false);
    setIsRecordDialogOpen(false);
    setIsHistoryDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-muted p-3 rounded-md">
        <span className="font-semibold">KM Atual:</span>
        <span className="font-bold text-lg">{vehicle.km?.toLocaleString('pt-BR') || 0} km</span>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-sm">Planos de Manutenção</h4>
        {isLoadingPlans && <p className="text-xs text-muted-foreground">Carregando planos...</p>}
        {plansError && <p className="text-xs text-destructive">Erro ao carregar planos.</p>}
        {!isLoadingPlans && (!plans || plans.length === 0) && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum plano cadastrado.</p>
        )}
        
        {plans?.map(plan => {
          const nextServiceKm = (plan.lastServiceKm || 0) + plan.frequencyKm;
          const kmRemaining = nextServiceKm - (vehicle.km || 0);
          const progress = Math.max(0, 100 - (kmRemaining / plan.frequencyKm) * 100);
          
          let status: 'success' | 'warning' | 'destructive' = 'success';
          if (kmRemaining <= 0) status = 'destructive';
          else if (kmRemaining <= plan.frequencyKm * 0.15) status = 'warning'; // 15% threshold

          return (
            <div key={plan.docId} className="space-y-2 border-t pt-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">{plan.serviceType}</span>
                 <Button variant="ghost" size="sm" className="h-auto p-1" onClick={() => handleOpenRecordDialog(plan)}>
                    <Wrench className="mr-1 h-3.5 w-3.5" /> Registrar
                </Button>
              </div>
              <Progress value={progress} className={cn(status === 'destructive' && '[&>div]:bg-destructive', status === 'warning' && '[&>div]:bg-yellow-500')} />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Último: {(plan.lastServiceKm || 0).toLocaleString('pt-BR')} km</span>
                {kmRemaining > 0 ? (
                  <span className={cn(status === 'destructive' && 'text-destructive font-bold', status === 'warning' && 'text-yellow-600 font-bold')}>
                    Próximo em {kmRemaining.toLocaleString('pt-BR')} km
                  </span>
                ) : (
                  <span className="text-destructive font-bold">
                    Atrasado por {Math.abs(kmRemaining).toLocaleString('pt-BR')} km
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <Button variant="outline" className="w-full" onClick={() => setIsPlanDialogOpen(true)}>
          <PlusCircle className="mr-2" /> Gerenciar Planos
        </Button>
      </div>

      <MaintenancePlanDialog
        isOpen={isPlanDialogOpen}
        onClose={() => setIsPlanDialogOpen(false)}
        vehicleId={vehicle.docId}
        existingPlans={plans || []}
        onSuccess={handleSuccess}
      />
      
      {selectedPlanForRecord && (
          <MaintenanceRecordDialog
            isOpen={isRecordDialogOpen}
            onClose={() => { setIsRecordDialogOpen(false); setSelectedPlanForRecord(null); }}
            vehicle={vehicle}
            plan={selectedPlanForRecord}
            onSuccess={handleSuccess}
          />
      )}
    </div>
  );
}
