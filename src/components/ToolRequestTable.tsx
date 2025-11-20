'use client';
import { forwardRef, useImperativeHandle } from 'react';

export interface ToolRequestTableRef {
  refetchRequests: () => void;
}

interface ToolRequestTableProps {
    onActionSuccess: () => void;
}

// Placeholder component
const ToolRequestTable = forwardRef<ToolRequestTableRef, ToolRequestTableProps>(({ onActionSuccess }, ref) => {
  
  useImperativeHandle(ref, () => ({
    refetchRequests() {
      console.log("Refetching requests...");
    }
  }));

  return (
    <div className="p-4 border rounded-lg bg-muted/20">
      <h3 className="font-semibold">Requisições Pendentes</h3>
      <p className="text-sm text-muted-foreground">
        Esta funcionalidade ainda será implementada. Aqui serão listadas todas as
        solicitações de empréstimo de ferramentas pendentes de aprovação e retirada.
      </p>
    </div>
  );
});

ToolRequestTable.displayName = "ToolRequestTable";

export default ToolRequestTable;
