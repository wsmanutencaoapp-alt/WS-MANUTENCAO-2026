'use client';

import Image from 'next/image';
import { tools as staticTools } from '@/lib/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Tool } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle } from 'lucide-react';

const statusTranslations: Record<string, string> = {
  Available: 'Disponível',
  'In Use': 'Em Uso',
  'In Calibration': 'Em Calibração',
};

export function ToolsTable() {
  const firestore = useFirestore();
  const toolsCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'tools') : null),
    [firestore]
  );
  
  // We are fetching data to check for security rule errors, but still displaying static data.
  // This is for debugging purposes.
  const { isLoading, error } = useCollection<Tool>(toolsCollectionRef);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
     return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro de Permissão</AlertTitle>
        <AlertDescription>
          Você não tem permissão para visualizar as ferramentas. Contacte o administrador.
        </AlertDescription>
      </Alert>
    );
  }


  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="hidden w-[100px] sm:table-cell">
            <span className="sr-only">Imagem</span>
          </TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Última Calibração</TableHead>
          <TableHead className="hidden md:table-cell">Calibrado Por</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staticTools.map((tool) => (
          <TableRow key={tool.id}>
            <TableCell className="hidden sm:table-cell">
              <Image
                alt={tool.name}
                className="aspect-square rounded-md object-cover"
                height="64"
                src={tool.imageUrl}
                width="64"
                data-ai-hint={tool.imageHint}
              />
            </TableCell>
            <TableCell className="font-medium">{tool.name}</TableCell>
            <TableCell>
              <Badge
                variant={
                  tool.status === 'Available'
                    ? 'secondary'
                    : tool.status === 'In Use'
                    ? 'default'
                    : 'destructive'
                }
              >
                {statusTranslations[tool.status] || tool.status}
              </Badge>
            </TableCell>
            <TableCell className="hidden md:table-cell">{tool.lastCalibration}</TableCell>
            <TableCell className="hidden md:table-cell">{tool.calibratedBy}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
