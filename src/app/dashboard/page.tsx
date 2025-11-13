import { SuppliesTable } from '@/components/supplies-table';
import { ReorderSuggestions } from '@/components/reorder-suggestions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function Dashboard() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card className="col-span-1 lg:col-span-4">
        <CardHeader>
          <CardTitle>Supplies</CardTitle>
          <CardDescription>
            Manage your aircraft maintenance supplies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuppliesTable />
        </CardContent>
      </Card>
      <div className="col-span-1 lg:col-span-3">
        <ReorderSuggestions />
      </div>
    </div>
  );
}
