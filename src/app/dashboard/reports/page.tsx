import { ReportGenerator } from "@/components/report-generator";

export default function ReportsPage() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <h1 className="text-3xl font-bold">Relatórios de Uso de Suprimentos</h1>
      <p className="text-muted-foreground">
        Use nossa ferramenta com IA para gerar relatórios abrangentes sobre o uso de suprimentos.
        Identifique tendências, otimize os níveis de estoque e reduza o desperdício.
      </p>
      <ReportGenerator />
    </div>
  );
}
