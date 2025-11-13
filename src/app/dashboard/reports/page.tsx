import { ReportGenerator } from "@/components/report-generator";

export default function ReportsPage() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <h1 className="text-3xl font-bold">Supply Usage Reporting</h1>
      <p className="text-muted-foreground">
        Use our AI-powered tool to generate comprehensive reports on supply usage.
        Identify trends, optimize inventory levels, and reduce waste.
      </p>
      <ReportGenerator />
    </div>
  );
}
