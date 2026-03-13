'use client';

import { useState } from 'react';
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

// This is the initial state for our component's state management
const initialState = {
  report: '',
  error: '',
  success: false,
};

// We define the submit button as a separate component to show a loading state
function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Gerar Relatório
    </Button>
  );
}

// The main component, rewritten to use standard useState and async/await
export function ReportGenerator() {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // The form submission handler
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true); // Start loading state
    const formData = new FormData(event.currentTarget);
    
    // Manually set dates if they are selected
    if (startDate) {
        formData.set('startDate', format(startDate, 'yyyy-MM-dd'));
    }
    if (endDate) {
        formData.set('endDate', format(endDate, 'yyyy-MM-dd'));
    }
    
    // Call the server action and update the state with the result
    const result = await getSupplyUsageReport(null, formData);
    setState(result);
    
    setPending(false); // End loading state
  };

  return (
    <div className="grid gap-6">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Gerar Relatório de Uso de Suprimentos</CardTitle>
            <CardDescription>Selecione um período e uma categoria para gerar um novo relatório.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : <span>Escolha uma data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label>Data de Fim</Label>
                 <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : <span>Escolha uma data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplyCategory">Categoria de Suprimento (Opcional)</Label>
              <Select name="supplyCategory">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Avionics">Aviônicos</SelectItem>
                  <SelectItem value="Mechanical">Mecânica</SelectItem>
                  <SelectItem value="Consumables">Consumíveis</SelectItem>
                  <SelectItem value="Structural">Estrutural</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton pending={pending} />
          </CardFooter>
        </form>
      </Card>
      {state.success && state.report && (
        <Card>
          <CardHeader>
            <CardTitle>Relatório Gerado</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea readOnly value={state.report} className="h-64 resize-none bg-muted/50" />
          </CardContent>
        </Card>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}
