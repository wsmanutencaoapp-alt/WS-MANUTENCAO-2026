
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
      Gerar Relatório
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
            <CardTitle>Gerar Relatório de Uso de Suprimentos</CardTitle>
            <CardDescription>Selecione um período e uma categoria para gerar um novo relatório.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" id="startDate" name="startDate" >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span>Escolha uma data</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Calendar
                      mode="single"
                      initialFocus
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
                <Label htmlFor="endDate">Data de Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" id="endDate" name="endDate">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span>Escolha uma data</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                     <Calendar
                      mode="single"
                      initialFocus
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
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
      {state.report && (
        <Card>
          <CardHeader>
            <CardTitle>Relatório Gerado</CardTitle>
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
