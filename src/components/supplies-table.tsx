import Image from 'next/image';
import { supplies } from '@/lib/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const statusTranslations: Record<string, string> = {
  'In Stock': 'Em Estoque',
  'Low Stock': 'Estoque Baixo',
  'Out of Stock': 'Sem Estoque',
};

const categoryTranslations: Record<string, string> = {
  'Structural': 'Estrutural',
  'Consumables': 'Consumíveis',
  'Avionics': 'Aviônicos',
  'Mechanical': 'Mecânica',
}

export function SuppliesTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="hidden w-[100px] sm:table-cell">
            <span className="sr-only">Imagem</span>
          </TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead className="hidden md:table-cell">Quantidade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {supplies.map((supply) => (
          <TableRow key={supply.id}>
            <TableCell className="hidden sm:table-cell">
              <Image
                alt={supply.name}
                className="aspect-square rounded-md object-cover"
                height="64"
                src={supply.imageUrl}
                width="64"
                data-ai-hint={supply.imageHint}
              />
            </TableCell>
            <TableCell className="font-medium">{supply.name}</TableCell>
            <TableCell>
              <Badge
                variant={
                  supply.status === 'In Stock'
                    ? 'secondary'
                    : supply.status === 'Low Stock'
                    ? 'default'
                    : 'destructive'
                }
              >
                {statusTranslations[supply.status] || supply.status}
              </Badge>
            </TableCell>
            <TableCell>{categoryTranslations[supply.category] || supply.category}</TableCell>
            <TableCell className="hidden md:table-cell">
              {supply.quantity} {supply.unit}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
