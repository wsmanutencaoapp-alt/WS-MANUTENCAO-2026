'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import type { MaintenancePlan } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { Separator } from './ui/separator';

interface MaintenancePlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  existingPlans: WithDocId<MaintenancePlan>[];
  onSuccess: () => void;
}

export default function MaintenancePlanDialog({ isOpen, onClose, vehicleId, existingPlans, onSuccess }: MaintenancePlanDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [serviceType, setServiceType] = useState('');
  const [frequencyKm, setFrequencyKm] = useState('');
  const [lastServiceKm, setLastServiceKm] = useState('');

  const resetForm = () => {
    setServiceType('');
    setFrequencyKm('');
    setLastServiceKm('');
  };

  const handleAddPlan = async () => {
    if (!firestore) return;
    if (!serviceType || !frequencyKm) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Tipo de serviço e frequência são obrigatórios.' });
      return;
    }
    
    setIsSaving(true);
    try {
      const newPlan: Omit<MaintenancePlan, 'id'> = {
        vehicleId,
        serviceType,
        frequencyKm: Number(frequencyKm),
        lastServiceKm: Number(lastServiceKm) || 0,
      };
      const plansCollection = collection(firestore, 'vehicles', vehicleId, 'maintenance_plans');
      await addDoc(plansCollection, newPlan);

      toast({ title: 'Sucesso', description: 'Novo plano de manutenção adicionado.' });
      resetForm();
      onSuccess();
    } catch (err) {
      console.error("Erro ao adicionar plano:", err);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível adicionar o plano.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!firestore) return;
    try {
        const planRef = doc(firestore, 'vehicles', vehicleId, 'maintenance_plans', planId);
        await deleteDoc(planRef);
        toast({ title: 'Sucesso', description: 'Plano de manutenção excluído.' });
        onSuccess();
    } catch (err) {
      console.error("Erro ao excluir plano:", err);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível excluir o plano.' });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar Planos de Manutenção</DialogTitle>
          <DialogDescription>
            Adicione ou remova os planos de manutenção para este veículo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
          <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
            <h4 className="font-semibold text-base">Adicionar Novo Plano</h4>
            <div className="space-y-1.5">
              <Label htmlFor="serviceType">Tipo de Serviço</Label>
              <Input id="serviceType" value={serviceType} onChange={e => setServiceType(e.target.value)} placeholder="Ex: Troca de Óleo do Motor" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="frequencyKm">Frequência (a cada X km)</Label>
                <Input id="frequencyKm" type="number" value={frequencyKm} onChange={e => setFrequencyKm(e.target.value)} placeholder="Ex: 10000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastServiceKm">KM do Último Serviço</Label>
                <Input id="lastServiceKm" type="number" value={lastServiceKm} onChange={e => setLastServiceKm(e.target.value)} placeholder="Opcional, ex: 85000" />
              </div>
            </div>
            <Button onClick={handleAddPlan} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Adicionar Plano
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-semibold text-base">Planos Existentes</h4>
            {existingPlans.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano cadastrado.</p>}
            {existingPlans.map(plan => (
              <div key={plan.docId} className="flex justify-between items-center p-2 border rounded-md">
                <div>
                  <p className="font-medium text-sm">{plan.serviceType}</p>
                  <p className="text-xs text-muted-foreground">A cada {plan.frequencyKm.toLocaleString('pt-BR')} km</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDeletePlan(plan.docId)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
