'use client';
import type { Tool } from '@/lib/types';

// Placeholder component
export default function ToolMovementTable({ allTools }: { allTools: Tool[] }) {
  return (
    <div className="p-4 border rounded-lg bg-muted/20">
      <h3 className="font-semibold">Movimentação Manual</h3>
      <p className="text-sm text-muted-foreground">
        Esta funcionalidade ainda será implementada. Aqui você poderá registrar a
        saída e devolução de ferramentas manualmente.
      </p>
    </div>
  );
}
