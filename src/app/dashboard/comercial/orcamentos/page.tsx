
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function OrcamentosComercialPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        Gestão de Orçamentos
      </h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Módulo em Construção</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-muted p-6 rounded-full mb-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground max-w-sm">
            Este módulo permitirá a criação e o acompanhamento de orçamentos de manutenção para aeronaves de clientes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
