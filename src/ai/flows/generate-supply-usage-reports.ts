'use server';

/**
 * @fileOverview Generates supply usage reports to identify trends, optimize inventory levels, and reduce waste.
 *
 * - generateSupplyUsageReport - A function that generates a supply usage report.
 * - GenerateSupplyUsageReportInput - The input type for the generateSupplyUsageReport function.
 * - GenerateSupplyUsageReportOutput - The return type for the generateSupplyUsageReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSupplyUsageReportInputSchema = z.object({
  startDate: z
    .string()
    .describe('The start date for the report, in ISO 8601 format (YYYY-MM-DD).'),
  endDate: z
    .string()
    .describe('The end date for the report, in ISO 8601 format (YYYY-MM-DD).'),
  supplyCategory: z
    .string()
    .optional()
    .describe('Optional category of supplies to filter the report by.'),
});
export type GenerateSupplyUsageReportInput = z.infer<
  typeof GenerateSupplyUsageReportInputSchema
>;

const GenerateSupplyUsageReportOutputSchema = z.object({
  report: z.string().describe('A comprehensive report on supply usage data.'),
});
export type GenerateSupplyUsageReportOutput = z.infer<
  typeof GenerateSupplyUsageReportOutputSchema
>;

export async function generateSupplyUsageReport(
  input: GenerateSupplyUsageReportInput
): Promise<GenerateSupplyUsageReportOutput> {
  return generateSupplyUsageReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSupplyUsageReportPrompt',
  input: {schema: GenerateSupplyUsageReportInputSchema},
  output: {schema: GenerateSupplyUsageReportOutputSchema},
  prompt: `You are a supply chain analyst tasked with generating a report on supply usage.

  Analyze the supply usage data between {{startDate}} and {{endDate}}.

  {{#if supplyCategory}}
  Focus specifically on the {{supplyCategory}} category.
  {{/if}}

  Identify any trends, outliers, or areas of concern regarding supply consumption.
  Provide actionable insights to optimize inventory levels and reduce waste.

  The report should be comprehensive and easy to understand for stakeholders.
  `,
});

const generateSupplyUsageReportFlow = ai.defineFlow(
  {
    name: 'generateSupplyUsageReportFlow',
    inputSchema: GenerateSupplyUsageReportInputSchema,
    outputSchema: GenerateSupplyUsageReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
