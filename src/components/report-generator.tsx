'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { getSupplyUsageReport } from '@/app/actions';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from './ui/textarea';

const initialState = {
  report: '',
  error: '',
  success: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Generate Report
    </Button>
  );
}

export function ReportGenerator() {
  const [state, formAction] = useActionState(getSupplyUsageReport, initialState);

  return (
    <div className="grid gap-6">
      <Card>
        <form action={formAction}>
          <CardHeader>
            <CardTitle>Generate Supply Usage Report</CardTitle>
            <CardDescription>Select a date range and category to generate a new report.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" id="startDate" name="startDate" >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span>Pick a date</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      onSelect={(day) => {
                        const input = document.getElementById('startDate-input') as HTMLInputElement;
                        if (input && day) input.value = format(day, 'yyyy-MM-dd');
                        const button = document.querySelector('#startDate span');
                        if (button && day) button.textContent = format(day, 'PPP');
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <input type="hidden" id="startDate-input" name="startDate" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" id="endDate" name="endDate">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span>Pick a date</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                     <Calendar
                      mode="single"
                      onSelect={(day) => {
                        const input = document.getElementById('endDate-input') as HTMLInputElement;
                        if (input && day) input.value = format(day, 'yyyy-MM-dd');
                        const button = document.querySelector('#endDate span');
                        if (button && day) button.textContent = format(day, 'PPP');
                      }}
                    />
                  </PopoverContent>
                </Popover>
                 <input type="hidden" id="endDate-input" name="endDate" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplyCategory">Supply Category (Optional)</Label>
              <Select name="supplyCategory">
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Avionics">Avionics</SelectItem>
                  <SelectItem value="Mechanical">Mechanical</SelectItem>
                  <SelectItem value="Consumables">Consumables</SelectItem>
                  <SelectItem value="Structural">Structural</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
      {state.report && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Report</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea readOnly value={state.report} className="h-64 resize-none" />
          </CardContent>
        </Card>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}
