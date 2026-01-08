'use client';

import { useState, useRef, useEffect } from 'react';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, Upload } from 'lucide-react';
import { format } from 'date-fns';
import type { Tool, CalibrationRecord } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';

interface EditHistoryRecordDialogProps {
  tool: WithDocId<Tool>;
  record: WithDocId<CalibrationRecord>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditHistoryRecordDialog({ tool, record, isOpen, onClose, onSuccess }: EditHistoryRecordDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
      calibrationDate: new Date(record.calibrationDate),
      dueDate: new Date(record.dueDate),
      calibratedBy: record.calibratedBy,
  });
  const [newCertificateFile, setNewCertificateFile] = useState<File | null>(null);

  const [isCalDateOpen, setIsCalDateOpen] = useState(false);
  const [isDueDateOpen, setIsDueDateOpen] = useState(false);

  useEffect(() => {
    if (record) {
        setFormData({
            calibrationDate: new Date(record.calibrationDate),
            dueDate: new Date(record.dueDate),
            calibratedBy: record.calibratedBy,
        });
        setNewCertificateFile(null);
    }
  }, [record, isOpen]);

  const handleSave = async () => {
    if (!firestore || !storage) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviços indisponíveis.' });
      return;
    }
    if (!formData.calibrationDate || !formData.dueDate || !formData.calibratedBy) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Todos os campos são obrigatórios.' });
      return;
    }

    setIsSaving(true);
    try {
      const recordRef = doc(firestore, 'tools', tool.docId, 'calibration_history', record.docId);
      
      let newCertificateUrl = record.certificateUrl;

      // If a new certificate is uploaded, replace the old one
      if (newCertificateFile) {
          // Delete old certificate
          if (record.certificateUrl) {
              try {
                const oldCertRef = storageRef(storage, record.certificateUrl);
                await deleteObject(oldCertRef);
              } catch (err: any) {
                  if (err.code !== 'storage/object-not-found') throw err;
                  console.warn("Old certificate not found during replacement:", record.certificateUrl);
              }
          }
          // Upload new certificate
          const newCertRef = storageRef(storage, `calibration_certificates/${tool.docId}/${Date.now()}_${newCertificateFile.name}`);
          await uploadBytes(newCertRef, newCertificateFile);
          newCertificateUrl = await getDownloadURL(newCertRef);
      }

      await updateDoc(recordRef, {
          calibrationDate: formData.calibrationDate.toISOString(),
          dueDate: formData.dueDate.toISOString(),
          calibratedBy: formData.calibratedBy,
          certificateUrl: newCertificateUrl,
      });

      toast({ title: 'Sucesso!', description: `Registro do histórico atualizado.` });
      onSuccess();

    } catch (error: any) {
      console.error('Erro ao editar registro:', error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Registro de Histórico</DialogTitle>
          <DialogDescription>
            Alterando o registro de calibração para <span className="font-bold">{tool.codigo}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <Collapsible open={isCalDateOpen} onOpenChange={setIsCalDateOpen}>
              <div className="space-y-2">
                <Label>Data da Calibração</Label>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.calibrationDate ? format(formData.calibrationDate, 'PPP') : <span>Escolha uma data</span>}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <Calendar
                    mode="single"
                    selected={formData.calibrationDate}
                    onSelect={(day) => { if(day) setFormData(p => ({...p, calibrationDate: day})); setIsCalDateOpen(false); }}
                    initialFocus
                  />
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible open={isDueDateOpen} onOpenChange={setIsDueDateOpen}>
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dueDate ? format(formData.dueDate, 'PPP') : <span>Escolha uma data</span>}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <Calendar
                    mode="single"
                    selected={formData.dueDate}
                    onSelect={(day) => { if(day) setFormData(p => ({...p, dueDate: day})); setIsDueDateOpen(false); }}
                    initialFocus
                  />
              </CollapsibleContent>
            </Collapsible>
          </div>
           <div>
              <Label htmlFor="calibratedBy">Calibrado Por</Label>
              <Input id="calibratedBy" value={formData.calibratedBy} onChange={(e) => setFormData(p => ({...p, calibratedBy: e.target.value}))} />
           </div>
          <div>
            <Label>Substituir Certificado (Opcional)</Label>
            <Button asChild variant="outline" className="w-full">
                <label className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    {newCertificateFile ? <span className="truncate max-w-xs">{newCertificateFile.name}</span> : 'Anexar novo certificado'}
                    <Input type="file" className="sr-only" ref={fileInputRef} onChange={(e) => setNewCertificateFile(e.target.files?.[0] || null)} />
                </label>
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
