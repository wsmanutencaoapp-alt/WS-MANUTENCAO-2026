'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a tool label SVG.
 *
 * The flow takes tool information and generates an SVG image for a printable label,
 * including a Code 128 barcode.
 *
 * @interface GenerateToolLabelInput - Input type for the generateToolLabel function.
 * @interface GenerateToolLabelOutput - Output type for the generateToolLabel function.
 * @function generateToolLabel - A function that triggers the label generation flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateToolLabelInputSchema = z.object({
  codigo: z.string().describe('The unique code of the tool (e.g., FE000001).'),
  name: z.string().describe('The name of the tool.'),
  unitCode: z.string().describe('The unit/batch code of the tool (e.g., A0001).'),
  enderecamento: z.string().optional().describe('The storage location of the tool.'),
});
export type GenerateToolLabelInput = z.infer<
  typeof GenerateToolLabelInputSchema
>;

const GenerateToolLabelOutputSchema = z.object({
  labelSvg: z
    .string()
    .describe('The generated tool label as an SVG string, including a Code 128 barcode.'),
});
export type GenerateToolLabelOutput = z.infer<
  typeof GenerateToolLabelOutputSchema
>;

export async function generateToolLabel(
  input: GenerateToolLabelInput
): Promise<GenerateToolLabelOutput> {
  return generateToolLabelFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateToolLabelPrompt',
  input: {schema: GenerateToolLabelInputSchema},
  output: {schema: GenerateToolLabelOutputSchema},
  prompt: `You are a label design expert. Your task is to generate a compact and clear SVG for a tool label based on the provided data.

The label must be 50mm wide and 25mm high.
It must contain the following information, clearly laid out:
1.  Tool Name: {{{name}}}
2.  Tool Code: {{{codigo}}}
3.  Unit Code: {{{unitCode}}}
4.  Location (if provided): {{{enderecamento}}}
5.  A Code 128 barcode representing the Tool Code ({{{codigo}}}).

Generate a complete, valid SVG string for this label. The SVG should have a white background and black text/barcode. The layout should be professional and easy to read. Do not include any XML prolog.
`,
});


const generateToolLabelFlow = ai.defineFlow(
  {
    name: 'generateToolLabelFlow',
    inputSchema: GenerateToolLabelInputSchema,
    outputSchema: GenerateToolLabelOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
