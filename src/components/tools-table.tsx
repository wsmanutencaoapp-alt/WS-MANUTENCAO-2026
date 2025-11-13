import Image from 'next/image';
import { tools } from '@/lib/data';
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

export function ToolsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="hidden w-[100px] sm:table-cell">
            <span className="sr-only">Image</span>
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Last Calibration</TableHead>
          <TableHead className="hidden md:table-cell">Calibrated By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tools.map((tool) => (
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
                {tool.status}
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
