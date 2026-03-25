
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

export default function FaturamentoComercialPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <DollarSign className="h-6 w-6 text-primary" />
        Faturamento de Serviço
      </h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Módulo em Construção</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-muted p-6 rounded-full mb-4">
            <DollarSign className="h-12 w-12 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground max-w-sm">
            Controle o faturamento de serviços executados e integre com o financeiro para acompanhamento de pagamentos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
