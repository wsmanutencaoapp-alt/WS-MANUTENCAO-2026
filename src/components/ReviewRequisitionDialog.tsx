'use client';

import EditRequisitionDialog from './EditRequisitionDialog';
import type { PurchaseRequisition } from '@/lib/types';
import type { WithDocId } from '@/firebase/firestore/use-collection';

interface ReviewRequisitionDialogProps {
  requisition: WithDocId<PurchaseRequisition> | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// This component now acts as a simple wrapper around EditRequisitionDialog.
export default function ReviewRequisitionDialog({ 
    requisition, 
    isOpen, 
    onClose, 
    onSuccess 
}: ReviewRequisitionDialogProps) {
  
  return (
    <EditRequisitionDialog
        requisition={requisition}
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={onSuccess}
    />
  );
};
