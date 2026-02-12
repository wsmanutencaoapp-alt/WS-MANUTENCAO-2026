
'use client';

import { HardHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ManutencaoVeiculosPage() {
  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
          <CardTitle>Manutenção de Veículos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <HardHat className="h-16 w-16 text-muted-foreground"/>
          <p className="text-muted-foreground">Esta página está em construção.</p>
        </CardContent>
      </Card>
    </div>
  );
}
