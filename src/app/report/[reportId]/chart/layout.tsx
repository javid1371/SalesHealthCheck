import "@/styles/print.css";

export default function ReportChartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="print-layout">{children}</div>;
}
