'use client';

import { useState, useEffect } from 'react';
import { getReorderSuggestions } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Bell, RefreshCw } from 'lucide-react';

export function ReorderSuggestions() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getReorderSuggestions();
    if (result.success && result.notifications) {
      setSuggestions(result.notifications);
    } else {
      setError(result.error || 'Ocorreu um erro desconhecido.');
      setSuggestions([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle>Sugestões de Reabastecimento</CardTitle>
          <CardDescription>
            Sugestões de IA para reposição de estoque.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchSuggestions} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          <span className="sr-only">Atualizar sugestões</span>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4 pt-4">
            <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : suggestions.length > 0 ? (
          <ul className="space-y-3 text-sm">
            {suggestions.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <Bell className="h-4 w-4 mt-0.5 flex-shrink-0 text-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma sugestão de reabastecimento no momento.</p>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full">Criar Ordens de Compra</Button>
      </CardFooter>
    </Card>
  );
}
