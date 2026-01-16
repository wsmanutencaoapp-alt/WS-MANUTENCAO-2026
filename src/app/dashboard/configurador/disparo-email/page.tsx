'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { WithDocId } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, X, PlusCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { EmailConfiguration } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

const CONFIG_IDS = {
  purchaseRequisition: 'purchase_requisition',
  purchaseOrder: 'purchase_order',
  toolDueDate: 'tool_due_date_alert',
};

const CONFIG_DETAILS = {
  [CONFIG_IDS.purchaseRequisition]: {
    title: 'Nova Requisição de Compra',
    description: 'Envia um e-mail quando uma nova solicitação de compra é criada e enviada para aprovação.',
  },
  [CONFIG_IDS.purchaseOrder]: {
    title: 'Nova Ordem de Compra',
    description: 'Envia um e-mail quando uma nova ordem de compra é criada e enviada para aprovação.',
  },
  [CONFIG_IDS.toolDueDate]: {
    title: 'Vencimento de Ferramentas',
    description: 'Envia um alerta sobre ferramentas com calibração ou validade próxima do vencimento.',
  },
};

function EmailConfigCard({ configId }: { configId: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const configRef = useMemoFirebase(() => firestore ? doc(firestore, 'email_configurations', configId) : null, [firestore, configId]);
  const { data: configData, isLoading } = useDoc<EmailConfiguration>(configRef);

  const [enabled, setEnabled] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (configData) {
      setEnabled(configData.enabled ?? false);
      setRecipients(configData.recipients ?? []);
    } else {
      // If no data, set to default off state
      setEnabled(false);
      setRecipients([]);
    }
  }, [configData]);

  const addRecipient = () => {
    if (newRecipient && !recipients.includes(newRecipient)) {
      setRecipients(prev => [...prev, newRecipient]);
      setNewRecipient('');
    }
  };

  const removeRecipient = (emailToRemove: string) => {
    setRecipients(prev => prev.filter(email => email !== emailToRemove));
  };
  
  const handleSave = async () => {
      if (!configRef) return;
      setIsSaving(true);
      try {
          const dataToSave = {
              id: configId,
              description: CONFIG_DETAILS[configId].title,
              enabled,
              recipients,
          };
          // Using a full overwrite instead of merge to ensure the recipients array is always correct.
          await setDoc(configRef, dataToSave);
          toast({ title: 'Sucesso!', description: 'Configurações de e-mail salvas.' });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar as configurações.' });
      } finally {
          setIsSaving(false);
      }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-24" />
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{CONFIG_DETAILS[configId].title}</CardTitle>
        <CardDescription>{CONFIG_DETAILS[configId].description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
          <div className="space-y-0.5">
            <Label>Habilitar este disparo</Label>
            <p className="text-xs text-muted-foreground">
              {enabled ? 'Os e-mails para este evento serão enviados.' : 'Os e-mails para este evento estão desativados.'}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        
        <div className="space-y-2">
            <Label>Destinatários</Label>
            <div className="space-y-2">
                {recipients.map(email => (
                    <div key={email} className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 p-2 text-sm">
                        <span>{email}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRecipient(email)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                {recipients.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-2">Nenhum destinatário configurado.</p>
                )}
            </div>
        </div>

        <div className="flex items-center gap-2">
            <Input 
                placeholder="novo.email@example.com"
                value={newRecipient}
                onChange={e => setNewRecipient(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRecipient()}
            />
            <Button type="button" variant="outline" onClick={addRecipient}>
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar
            </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Alterações
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function DisparoEmailPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuração de Disparo de E-mails</h1>
      <p className="text-muted-foreground">
        Habilite ou desabilite notificações automáticas por e-mail e gerencie as listas de destinatários para cada evento.
      </p>
      <Separator />
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <EmailConfigCard configId={CONFIG_IDS.purchaseRequisition} />
        <EmailConfigCard configId={CONFIG_IDS.purchaseOrder} />
        <EmailConfigCard configId={CONFIG_IDS.toolDueDate} />
      </div>
    </div>
  );
}
