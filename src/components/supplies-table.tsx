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

export function SuppliesTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="hidden w-[100px] sm:table-cell">
            <span className="sr-only">Image</span>
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="hidden md:table-cell">Quantity</TableHead>
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
                {supply.status}
              </Badge>
            </TableCell>
            <TableCell>{supply.category}</TableCell>
            <TableCell className="hidden md:table-cell">
              {supply.quantity} {supply.unit}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
