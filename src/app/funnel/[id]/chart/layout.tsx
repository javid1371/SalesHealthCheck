import "@/styles/print.css";

export default function FunnelChartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="print-layout">{children}</div>;
}
