'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating reorder notifications for aircraft maintenance supplies.
 *
 * The flow analyzes supply levels and generates notifications to prompt stock replenishment and prevent maintenance delays.
 *
 * @interface GenerateReorderNotificationsInput - Input type for the generateReorderNotifications function.
 * @interface GenerateReorderNotificationsOutput - Output type for the generateReorderNotifications function.
 * @function generateReorderNotifications - A function that triggers the reorder notification generation flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateReorderNotificationsInputSchema = z.object({
  supplyLevels: z
    .record(z.number())
    .describe('A record of supply names and their current stock levels.'),
  reorderThresholds: z
    .record(z.number())
    .describe(
      'A record of supply names and their reorder thresholds (the level at which a reorder should be triggered).'
    ),
});

export type GenerateReorderNotificationsInput = z.infer<
  typeof GenerateReorderNotificationsInputSchema
>;

const GenerateReorderNotificationsOutputSchema = z.object({
  notifications: z
    .array(z.string())
    .describe('A list of notifications for supplies that need to be reordered.'),
});

export type GenerateReorderNotificationsOutput = z.infer<
  typeof GenerateReorderNotificationsOutputSchema
>;

export async function generateReorderNotifications(
  input: GenerateReorderNotificationsInput
): Promise<GenerateReorderNotificationsOutput> {
  return generateReorderNotificationsFlow(input);
}

const generateReorderNotificationsPrompt = ai.definePrompt({
  name: 'generateReorderNotificationsPrompt',
  input: {schema: GenerateReorderNotificationsInputSchema},
  output: {schema: GenerateReorderNotificationsOutputSchema},
  prompt: `You are an AI assistant responsible for generating reorder notifications for aircraft maintenance supplies.
  Analyze the current supply levels and reorder thresholds to identify supplies that need to be reordered.
  Generate a notification for each supply that needs to be reordered, including the supply name and the amount to reorder.

  Current Supply Levels:
  {{#each supplyLevels}}  - {{key}}: {{this}}
  {{/each}}

  Reorder Thresholds:
  {{#each reorderThresholds}}  - {{key}}: {{this}}
  {{/each}}

  Notifications:
  `,
});

const generateReorderNotificationsFlow = ai.defineFlow(
  {
    name: 'generateReorderNotificationsFlow',
    inputSchema: GenerateReorderNotificationsInputSchema,
    outputSchema: GenerateReorderNotificationsOutputSchema,
  },
  async input => {
    const {output} = await generateReorderNotificationsPrompt(input);
    return output!;
  }
);
