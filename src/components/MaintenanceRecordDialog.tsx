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
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, doc, writeBatch } from 'firebase/firestore';
import type { MaintenancePlan, MaintenanceRecord, Vehicle } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wrench } from 'lucide-react';
import { Textarea } from './ui/textarea';

interface MaintenanceRecordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: WithDocId<Vehicle>;
  plan: WithDocId<MaintenancePlan>;
  onSuccess: () => void;
}

export default function MaintenanceRecordDialog({ isOpen, onClose, vehicle, plan, onSuccess }: MaintenanceRecordDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [mileage, setMileage] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMileage(vehicle.km?.toString() || '');
      setCost('');
      setNotes('');
    }
  }, [isOpen, vehicle.km]);

  const handleSave = async () => {
    if (!firestore) return;
    if (!mileage) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A quilometragem do serviço é obrigatória.' });
      return;
    }
    const numMileage = Number(mileage);

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);

      // 1. Create the historical record
      const newRecord: Omit<MaintenanceRecord, 'id'> = {
        vehicleId: vehicle.docId,
        planId: plan.docId,
        serviceType: plan.serviceType,
        date: new Date().toISOString(),
        mileage: numMileage,
        notes: notes,
        cost: Number(cost) || 0,
      };
      const recordsCollection = collection(firestore, 'vehicles', vehicle.docId, 'maintenance_records');
      const newRecordRef = doc(recordsCollection);
      batch.set(newRecordRef, newRecord);

      // 2. Update the plan with the new "lastServiceKm"
      const planRef = doc(firestore, 'vehicles', vehicle.docId, 'maintenance_plans', plan.docId);
      batch.update(planRef, { lastServiceKm: numMileage });

      await batch.commit();
      
      toast({ title: 'Sucesso', description: 'Serviço de manutenção registrado.' });
      onSuccess();
    } catch (err) {
      console.error("Erro ao registrar serviço:", err);
      toast({ variant: 'destructive', title: 'Erro na Operação', description: 'Não foi possível registrar o serviço.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Serviço Realizado</DialogTitle>
          <DialogDescription>
            Serviço de "{plan.serviceType}" para o veículo {vehicle.prefixo}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="space-y-1.5">
                <Label htmlFor="mileage">KM da Manutenção</Label>
                <Input id="mileage" type="number" value={mileage} onChange={e => setMileage(e.target.value)} />
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="cost">Custo do Serviço (R$, Opcional)</Label>
                <Input id="cost" type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="Ex: 350.00" />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="notes">Notas do Serviço (Opcional)</Label>
                <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Utilizado óleo 5W-30, filtro trocado." />
            </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
              Salvar Registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
