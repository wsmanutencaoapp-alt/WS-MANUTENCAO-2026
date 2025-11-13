import { ToolsTable } from '@/components/tools-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function ToolsPage() {
  return (
    <div>
       <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Tool Management</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Tool
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tool Inventory</CardTitle>
          <CardDescription>
            Track and manage all your maintenance tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToolsTable />
        </CardContent>
      </Card>
    </div>
  );
}
