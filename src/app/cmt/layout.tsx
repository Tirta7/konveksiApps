// CMT Portal has its own standalone layout - no sidebar
export default function CMTLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0F172A" }}>
      {children}
    </div>
  );
}
