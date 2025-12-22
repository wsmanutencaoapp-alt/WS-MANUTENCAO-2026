'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wrench, Box, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CadastroEnderecosPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cadastro de Endereços</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Endereçamento</CardTitle>
          <CardDescription>
            Selecione a área para gerenciar o endereçamento de estoque.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-medium">
                        Ferramentaria
                    </CardTitle>
                    <Wrench className="h-6 w-6 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Gerencie as localizações de prateleiras, gavetas e armários para ferramentas e kits.
                    </p>
                    <Button asChild>
                        <Link href="/dashboard/cadastros/enderecos/ferramentaria">
                            Endereços Ferramentaria <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>

             <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-medium">
                        Suprimentos
                    </CardTitle>
                    <Box className="h-6 w-6 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Gerencie as localizações de estoque para os itens de suprimento e consumíveis.
                    </p>
                    <Button asChild>
                        <Link href="/dashboard/cadastros/enderecos/suprimentos">
                            Endereços Suprimentos <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </CardContent>
      </Card>
    </div>
  );
}
