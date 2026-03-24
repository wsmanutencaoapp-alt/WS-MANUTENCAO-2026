'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';

export default function OrdemServicoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ClipboardList className="h-6 w-6" />
        Ordens de Serviço
      </h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Módulo em Construção</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-muted p-6 rounded-full mb-4">
            <ClipboardList className="h-12 w-12 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground max-w-sm">
            Este módulo está sendo preparado para o gerenciamento completo de manutenções e inspeções técnicas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
