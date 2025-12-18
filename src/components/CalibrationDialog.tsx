
'use client';
import { useState, useRef } from 'react';
import { useFirestore, useStorage, useUser } from '@/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, Upload } from 'lucide-react';
import { format } from 'date-fns';
import type { Tool, CalibrationRecord } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { useQueryClient } from '@tanstack/react-query';

interface CalibrationDialogProps {
  tool: WithDocId<Tool>;
  isOpen: boolean;
  onClose: () => void;
}

export default function CalibrationDialog({ tool, isOpen, onClose }: CalibrationDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>();
  const [calibrationDate, setCalibrationDate] = useState<Date | undefined>(new Date());
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [calibratedBy, setCalibratedBy] = useState(user?.displayName || '');

  const handleSave = async () => {
    if (!firestore || !storage || !user) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviços indisponíveis.' });
      return;
    }
    if (!newDueDate || !calibrationDate || !certificateFile || !calibratedBy) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Todos os campos são obrigatórios.' });
      return;
    }

    setIsSaving(true);
    try {
      // 1. Upload certificate to Storage
      const certRef = storageRef(storage, `calibration_certificates/${tool.docId}/${Date.now()}_${certificateFile.name}`);
      await uploadBytes(certRef, certificateFile);
      const certificateUrl = await getDownloadURL(certRef);

      // 2. Create historical record in subcollection
      const historyCollectionRef = collection(firestore, 'tools', tool.docId, 'calibration_history');
      const newHistoryRecord: Omit<CalibrationRecord, 'id'> = {
        toolId: tool.docId,
        calibrationDate: calibrationDate.toISOString(),
        dueDate: newDueDate.toISOString(),
        certificateUrl: certificateUrl,
        calibratedBy: calibratedBy,
        timestamp: new Date().toISOString(),
      };
      await addDoc(historyCollectionRef, newHistoryRecord);
      
      // 3. Update the main tool document
      const toolRef = doc(firestore, 'tools', tool.docId);
      await updateDoc(toolRef, {
        data_referencia: calibrationDate.toISOString(),
        data_vencimento: newDueDate.toISOString(),
        documento_anexo_url: certificateUrl,
        status: 'Disponível', // Assume it becomes available after calibration
      });

      toast({ title: 'Sucesso!', description: `Calibração da ferramenta ${tool.codigo} registrada.` });
      
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['controllableTools'] });
      queryClient.invalidateQueries({ queryKey: ['calibrationHistory', tool.docId] });

      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar calibração:', error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Nova Calibração/Aferição</DialogTitle>
          <DialogDescription>
            Atualize o status da ferramenta <span className="font-bold">{tool.codigo}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data da Calibração</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {calibrationDate ? format(calibrationDate, 'dd/MM/yyyy') : <span>Escolha uma data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}><Calendar mode="single" selected={calibrationDate} onSelect={setCalibrationDate} initialFocus /></PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Nova Data de Vencimento</Label>
               <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDueDate ? format(newDueDate, 'dd/MM/yyyy') : <span>Escolha uma data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}><Calendar mode="single" selected={newDueDate} onSelect={setNewDueDate} initialFocus /></PopoverContent>
              </Popover>
            </div>
          </div>
           <div>
              <Label htmlFor="calibratedBy">Calibrado Por</Label>
              <Input id="calibratedBy" value={calibratedBy} onChange={(e) => setCalibratedBy(e.target.value)} placeholder="Nome do técnico ou empresa"/>
           </div>
          <div>
            <Label>Certificado</Label>
            <Button asChild variant="outline" className="w-full">
                <label className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    {certificateFile ? <span className="truncate max-w-xs">{certificateFile.name}</span> : 'Anexar novo certificado'}
                    <Input type="file" className="sr-only" ref={fileInputRef} onChange={(e) => setCertificateFile(e.target.files?.[0] || null)} />
                </label>
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
