// CMT Portal has its own standalone layout - no sidebar
export default function CMTLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#0F172A", color: "white", width: "100%", overscrollBehavior: "none" }}>
      {children}
    </div>
  );
}
