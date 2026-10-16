// CMT Portal has its own standalone layout - no sidebar
export default function CMTLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#0F172A" }}>
      {children}
    </div>
  );
}
