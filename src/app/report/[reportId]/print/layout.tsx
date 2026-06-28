import "@/styles/print.css";

export default function ReportPrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="print-layout">{children}</div>;
}
