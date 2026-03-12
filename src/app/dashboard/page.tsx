'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Newspaper, CalendarDays, Gift, Shield, Megaphone } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="text-center my-8">
        <h1 className="text-4xl font-bold tracking-tight">Bem-vindo ao Portal Interno</h1>
        <p className="text-muted-foreground mt-2 text-lg">Suas informações centralizadas em um só lugar.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Últimos Avisos</CardTitle>
            <Newspaper className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="font-semibold">Atualização da Política de Férias</p>
                <p className="text-sm text-muted-foreground">O período para solicitação de férias para o final do ano foi estendido. Consulte o novo prazo no portal do RH.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Manutenção Programada do Sistema</p>
                <p className="text-sm text-muted-foreground">Haverá uma janela de manutenção no sistema de requisições neste sábado das 22:00 às 23:00.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Próximos Eventos</CardTitle>
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1">
             <div className="space-y-4">
              <div className="space-y-1">
                <p className="font-semibold">Festa de Fim de Ano</p>
                <p className="text-sm text-muted-foreground">Data: 15 de Dezembro. Local: Salão de Festas Principal. Traje: Esporte Fino.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Treinamento de Segurança</p>
                <p className="text-sm text-muted-foreground">Data: 20 de Novembro. Local: Auditório. Presença obrigatória para a equipe de manutenção.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Aniversariantes do Mês</CardTitle>
            <Gift className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1">
             <ul className="space-y-2 text-sm">
                <li>João da Silva - Dia 05</li>
                <li>Maria Oliveira - Dia 12</li>
                <li>Carlos Pereira - Dia 21</li>
             </ul>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Publicações de Segurança (SGSO)</CardTitle>
            <Shield className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-4">
                <div className="space-y-1">
                    <p className="font-semibold">Relatório de Segurança 2024-Q3</p>
                    <p className="text-sm text-muted-foreground">O relatório trimestral de segurança já está disponível para consulta no portal da Qualidade.</p>
                </div>
                 <div className="space-y-1">
                    <p className="font-semibold">Alerta: Uso de EPIs</p>
                    <p className="text-sm text-muted-foreground">Reforçamos a obrigatoriedade do uso de todos os Equipamentos de Proteção Individual nas áreas designadas.</p>
                </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Comunicados do RH</CardTitle>
            <Megaphone className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-4">
                <div className="space-y-1">
                    <p className="font-semibold">Pesquisa de Clima Organizacional</p>
                    <p className="text-sm text-muted-foreground">Sua participação é fundamental! Responda à pesquisa até o dia 30.</p>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
