'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HardHat } from 'lucide-react';

export default function AnexoComprovantePage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-6 py-12 px-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Anexo de Comprovante</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
            <HardHat className="h-16 w-16 text-muted-foreground"/>
          <p className="text-muted-foreground">Esta página está em construção.</p>
        </CardContent>
      </Card>
    </div>
  );
}
