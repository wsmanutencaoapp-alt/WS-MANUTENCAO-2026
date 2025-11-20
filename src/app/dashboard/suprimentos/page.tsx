import { SuppliesTable } from '@/components/supplies-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SuprimentosPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suprimentos</CardTitle>
        <CardDescription>
          Gerencie seus suprimentos de manutenção de aeronaves.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SuppliesTable />
      </CardContent>
    </Card>
  );
}
