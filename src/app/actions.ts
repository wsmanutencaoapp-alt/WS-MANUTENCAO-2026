'use server';

import { generateReorderNotifications } from '@/ai/flows/generate-reorder-notifications';
import { generateSupplyUsageReport } from '@/ai/flows/generate-supply-usage-reports';
import { supplies, reorderThresholds } from '@/lib/data';

export async function getReorderSuggestions() {
  try {
    const supplyLevels = supplies.reduce((acc, supply) => {
      acc[supply.name] = supply.quantity;
      return acc;
    }, {} as Record<string, number>);

    const result = await generateReorderNotifications({
      supplyLevels,
      reorderThresholds,
    });
    return { success: true, notifications: result.notifications };
  } catch (error) {
    console.error('Error generating reorder notifications:', error);
    return { success: false, error: 'Failed to generate suggestions.' };
  }
}

export async function getSupplyUsageReport(prevState: any, formData: FormData) {
  try {
    const rawData = {
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      supplyCategory: (formData.get('supplyCategory') as string) || undefined,
    };
    
    if (!rawData.startDate || !rawData.endDate) {
        return { success: false, error: 'Start date and end date are required.' };
    }

    const result = await generateSupplyUsageReport(rawData);
    return { success: true, report: result.report };
  } catch (error) {
    console.error('Error generating supply usage report:', error);
    return { success: false, error: 'Failed to generate report.' };
  }
}
