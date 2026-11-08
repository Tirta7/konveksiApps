"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Receipt, ShoppingBag, Package, HandCoins, Landmark,
  Scale, AlertTriangle, RefreshCw, Store, Shirt, Truck, MapPin, CreditCard, Boxes,
  ArrowUpRight, ArrowDownRight, Calendar, Award, Layers, Ruler, Activity, Info,
} from "lucide-react";

// ───────────────────────── Helpers ─────────────────────────
const rp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
const rpShort = (n: number) => {
  const v = Math.abs(n || 0);
  const sign = n < 0 ? "-" : "";
  if (v >= 1e9) return `${sign}Rp ${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (v >= 1e6) return `${sign}Rp ${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (v >= 1e3) return `${sign}Rp ${(v / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return `${sign}Rp ${Math.round(v)}`;
};
const axisShort = (n: number) => {
  const v = Math.abs(n || 0);
  if (v >= 1e9) return `${(n / 1e9).toFixed(1)}M`;
  if (v >= 1e6) return `${(n / 1e6).toFixed(v >= 1e7 ? 0 : 1)}jt`;
  if (v >= 1e3) return `${(n / 1e3).toFixed(0)}rb`;
  return String(Math.round(n));
};
const fmtNum = (n: number) => Math.round(n || 0).toLocaleString("id-ID");
const pct = (n: number, d = 1) => `${(n || 0).toLocaleString("id-ID", { maximumFractionDigits: d })}%`;
const fmtTgl = (s?: string | null) => {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtTglJam = (s?: string | null) => {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const RANGES = [
  { key: "1", label: "Hari Ini" },
  { key: "7", label: "7 Hari" },
  { key: "30", label: "30 Hari" },
  { key: "90", label: "90 Hari" },
  { key: "mtd", label: "Bulan Ini" },
  { key: "ytd", label: "Tahun Ini" },
  { key: "all", label: "Semua" },
];

const PALETTE = ["#2563EB", "#F97316", "#10B981", "#8B5CF6", "#EC4899", "#14B8A6", "#F59E0B", "#64748B"];
const KANAL_COLOR: Record<string, string> = {
  "TikTok Shop": "#0F172A", Shopee: "#F97316", Grosir: "#6366F1", "Retail Offline": "#10B981", Marketplace: "#64748B",
};
const kanalColor = (name: string, i: number) => KANAL_COLOR[name] || PALETTE[i % PALETTE.length];
const STATUS_COLOR: Record<string, string> = {
  Selesai: "#10B981", Dikirim: "#3B82F6", "Perlu Dikirim": "#F59E0B", Diproses: "#8B5CF6", Batal: "#EF4444", Retur: "#EC4899",
};
const INV_COLOR: Record<string, string> = {
  potong: "#3B82F6", washing_dikerjakan: "#06B6D4", gudang: "#8B5CF6", siap_jual: "#10B981", terjual: "#F97316", reject: "#EF4444",
};

// ───────────────────────── UI Primitives ─────────────────────────
function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`bo-card ${className}`} style={style}>{children}</div>;
}

function CardHead({ icon, title, subtitle, right, tone = "#2563EB" }: { icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode; tone?: string }) {
  return (
    <div className="bo-card-head">
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${tone}14`, color: tone, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div className="bo-card-title">{title}</div>
          {subtitle && <div className="bo-card-sub">{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

function Growth({ value, invert = false, compact = false }: { value: number; invert?: boolean; compact?: boolean }) {
  const up = value >= 0;
  const good = invert ? !up : up;
  if (!isFinite(value)) return null;
  return (
    <span className="bo-growth" style={{ background: good ? "#ECFDF5" : "#FEF2F2", color: good ? "#047857" : "#B91C1C" }}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {pct(Math.abs(value))}
      {!compact && <span style={{ fontWeight: 600, opacity: 0.75, marginLeft: 2 }}>vs periode lalu</span>}
    </span>
  );
}

function Empty({ text, height = 180 }: { text: string; height?: number }) {
  return (
    <div style={{ height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 12, gap: 8, textAlign: "center", padding: 12 }}>
      <Info size={20} />
      {text}
    </div>
  );
}

function ChartTooltip({ active, payload, label, money = true }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 12px", boxShadow: "0 10px 25px rgba(15,23,42,0.12)", fontSize: 12, minWidth: 160 }}>
      {label != null && <div style={{ fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", padding: "2px 0" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.payload?.fill || p.fill }} />
            {p.name}
          </span>
          <b style={{ color: "#0F172A" }}>{money ? rp(p.value) : fmtNum(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

function ProgressRow({ label, value, total, color, right }: { label: React.ReactNode; value: number; total: number; color: string; right?: React.ReactNode }) {
  const w = total > 0 ? Math.max(2, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
        <span style={{ color: "#334155", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ color: "#0F172A", fontWeight: 800, whiteSpace: "nowrap" }}>{right ?? rp(value)}</span>
      </div>
      <div style={{ height: 6, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${value > 0 ? w : 0}%`, height: "100%", background: color, borderRadius: 99, transition: "width .6s ease" }} />
      </div>
    </div>
  );
}

// ───────────────────────── Main Component ─────────────────────────
export default function BusinessOverview() {
  const [range, setRange] = useState("30");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [trendMode, setTrendMode] = useState<"keuangan" | "pesanan">("keuangan");
  const [produkMode, setProdukMode] = useState<"pcs" | "omzet">("pcs");
  const reqId = useRef(0);

  const load = useCallback(async (r: string, silent = false) => {
    const id = ++reqId.current;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/dashboard-bisnis?range=${r}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Server merespons ${res.status}`);
      if (id !== reqId.current) return;
      setD(json);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e: any) {
      if (id === reqId.current) setError(e?.message || "Gagal memuat data");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  // Real-time: segarkan otomatis saat ada perubahan data (SSE) + interval cadangan
  useEffect(() => {
    let t: any;
    const handler = () => { clearTimeout(t); t = setTimeout(() => load(range, true), 600); };
    window.addEventListener("konveksi-sync", handler);
    const iv = setInterval(() => { if (!document.hidden) load(range, true); }, 60000);
    return () => { window.removeEventListener("konveksi-sync", handler); clearInterval(iv); clearTimeout(t); };
  }, [range, load]);

  const r = d?.ringkasan;
  const totalInv = useMemo(() => (d?.inventori?.status || []).reduce((s: number, x: any) => s + x.value, 0), [d]);

  if (!d && loading) {
    return (
      <div className="bo-wrap">
        <BoStyles />
        <div className="bo-grid-4">{[0, 1, 2, 3].map((i) => <div key={i} className="bo-card bo-skeleton" style={{ height: 128 }} />)}</div>
        <div className="bo-grid-main"><div className="bo-card bo-skeleton" style={{ height: 360 }} /><div className="bo-card bo-skeleton" style={{ height: 360 }} /></div>
      </div>
    );
  }

  if (!d && error) {
    return (
      <div className="bo-wrap">
        <BoStyles />
        <Card style={{ padding: 32, textAlign: "center" }}>
          <AlertTriangle size={30} color="#DC2626" style={{ margin: "0 auto 10px" }} />
          <div style={{ fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Ringkasan bisnis gagal dimuat</div>
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>{error}</div>
          <button className="bo-btn-primary" onClick={() => load(range)}>Coba Lagi</button>
        </Card>
      </div>
    );
  }

  const trend: any[] = d?.trend || [];
  const perKanal: any[] = d?.pendapatan?.perKanal || [];
  const pengBreak: any[] = (d?.pengeluaran?.breakdown || []).filter((x: any) => x.value > 0);
  const topSku: any[] = d?.produk?.topSku || [];
  const perSize: any[] = d?.produk?.perSize || [];
  const modelTrend = d?.produk?.modelTrend || { models: [], data: [] };
  const topModel: any[] = d?.produk?.topModel || [];
  const statusPesanan: any[] = d?.pendapatan?.statusPesanan || [];
  const aging: any[] = d?.piutang?.aging || [];
  const hutangList: any[] = d?.hutang?.list || [];
  const inv: any[] = d?.inventori?.status || [];

  return (
    <div className="bo-wrap">
      <BoStyles />

      {/* ── Toolbar Periode ── */}
      <div className="bo-toolbar">
        <div className="bo-range">
          <Calendar size={14} color="#64748B" style={{ flexShrink: 0 }} />
          {RANGES.map((x) => (
            <button key={x.key} onClick={() => setRange(x.key)} className={`bo-range-btn ${range === x.key ? "active" : ""}`}>{x.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#64748B", flexWrap: "wrap" }}>
          <span>
            Periode: <b style={{ color: "#0F172A" }}>{fmtTgl(d?.range?.start)} – {fmtTgl(d?.range?.end)}</b>
          </span>
          <button onClick={() => load(range)} className="bo-btn-ghost" title="Muat ulang">
            <RefreshCw size={12} className={loading ? "bo-spin" : ""} /> {updatedAt ? updatedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--"}
          </button>
        </div>
      </div>

      {/* ── KPI Utama ── */}
      <div className="bo-grid-4">
        <KpiHero
          tone="#2563EB" icon={<Wallet size={18} />} title="Total Pendapatan" value={rp(r.pendapatan)}
          growth={<Growth value={r.pendapatanGrowth} />}
          foot={<>Online <b>{rpShort(d.pendapatan.online)}</b> · Offline <b>{rpShort(d.pendapatan.offline)}</b></>}
          spark={trend.map((t) => t.pendapatan)}
        />
        <KpiHero
          tone="#F97316" icon={<Receipt size={18} />} title="Total Pengeluaran" value={rp(r.pengeluaran)}
          growth={<Growth value={r.pengeluaranGrowth} invert />}
          foot={<>Bahan <b>{rpShort(d.pengeluaran.pembelianBahan)}</b> · Upah <b>{rpShort(d.pengeluaran.upahDibayar)}</b> · Potongan <b>{rpShort(d.pengeluaran.potonganMarketplace)}</b></>}
          spark={trend.map((t) => t.pengeluaran)}
        />
        <KpiHero
          tone={r.arusKasBersih >= 0 ? "#10B981" : "#EF4444"} icon={r.arusKasBersih >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          title="Arus Kas Bersih (Estimasi)" value={rp(r.arusKasBersih)}
          growth={<span className="bo-growth" style={{ background: r.margin >= 0 ? "#ECFDF5" : "#FEF2F2", color: r.margin >= 0 ? "#047857" : "#B91C1C" }}>Margin {pct(r.margin)}</span>}
          foot={<>Pendapatan − Pengeluaran pada periode ini</>}
          spark={trend.map((t) => t.laba)}
        />
        <KpiHero
          tone="#8B5CF6" icon={<ShoppingBag size={18} />} title="Pesanan & Pcs Terjual" value={`${fmtNum(r.pesanan)} order`}
          growth={<Growth value={r.pesananGrowth} />}
          foot={<><b>{fmtNum(r.pcs)} pcs</b> · AOV <b>{rpShort(r.aov)}</b> · Rata² <b>{rpShort(r.hargaRataPcs)}</b>/pcs</>}
          spark={trend.map((t) => t.pesanan)}
        />
      </div>

      {/* ── KPI Sekunder: Posisi Keuangan ── */}
      <div className="bo-grid-4">
        <KpiMini tone="#0EA5E9" icon={<HandCoins size={16} />} title="Piutang Berjalan" value={rp(r.piutang)} href="/laporan"
          note={`${fmtNum(d.piutang.pesananBelumCair)} pesanan marketplace belum cair`} />
        <KpiMini tone="#DC2626" icon={<Landmark size={16} />} title="Hutang Berjalan" value={rp(r.hutang)} href="/hutang"
          note={`Supplier ${rpShort(d.hutang.supplier)} · Upah ${rpShort(d.hutang.upahVendor)}`} />
        <KpiMini tone={r.posisiBersih >= 0 ? "#059669" : "#B91C1C"} icon={<Scale size={16} />} title="Posisi Bersih (Piutang − Hutang)" value={rp(r.posisiBersih)}
          note={r.posisiBersih >= 0 ? "Tagihan masuk lebih besar dari kewajiban" : "Kewajiban lebih besar dari tagihan masuk"} />
        <KpiMini tone="#F59E0B" icon={r.hariTerbaik ? <Award size={16} /> : <AlertTriangle size={16} />}
          title={r.hariTerbaik ? `Puncak Penjualan · ${r.hariTerbaik.label}` : "Pesanan Batal"}
          value={r.hariTerbaik ? rp(r.hariTerbaik.nilai) : `${fmtNum(r.jumlahBatal)} order`}
          note={`Batal ${fmtNum(r.jumlahBatal)} order (${pct(r.rasioBatal)}) · ${rpShort(r.nilaiBatal)}`} />
      </div>

      {/* ── Tren + Kanal ── */}
      <div className="bo-grid-main">
        <Card>
          <CardHead
            icon={<Activity size={16} />} title="Tren Keuangan & Penjualan"
            subtitle={`Per ${d.range.granularity === "day" ? "hari" : d.range.granularity === "week" ? "minggu" : "bulan"} · ${d.range.label}`}
            right={
              <div className="bo-seg">
                <button className={trendMode === "keuangan" ? "active" : ""} onClick={() => setTrendMode("keuangan")}>Keuangan</button>
                <button className={trendMode === "pesanan" ? "active" : ""} onClick={() => setTrendMode("pesanan")}>Pesanan</button>
              </div>
            }
          />
          <div style={{ height: 300, padding: "6px 10px 12px 0" }}>
            {trend.some((t) => t.pendapatan || t.pengeluaran || t.pesanan) ? (
              <ResponsiveContainer width="100%" height="100%">
                {trendMode === "keuangan" ? (
                  <AreaChart data={trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gPeng" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F97316" stopOpacity={0.22} /><stop offset="100%" stopColor="#F97316" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis tickFormatter={axisShort} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Area type="monotone" dataKey="pendapatan" name="Pendapatan" stroke="#2563EB" strokeWidth={2.2} fill="url(#gPend)" />
                    <Area type="monotone" dataKey="pengeluaran" name="Pengeluaran" stroke="#F97316" strokeWidth={2} fill="url(#gPeng)" />
                    <Area type="monotone" dataKey="laba" name="Arus Kas Bersih" stroke="#10B981" strokeWidth={1.8} strokeDasharray="5 4" fill="transparent" />
                  </AreaChart>
                ) : (
                  <BarChart data={trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip money={false} />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Bar dataKey="pesanan" name="Pesanan" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="pcs" name="Pcs Terjual" fill="#C4B5FD" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : <Empty text="Belum ada transaksi pada periode ini" height={280} />}
          </div>
        </Card>

        <Card>
          <CardHead icon={<Store size={16} />} title="Pendapatan per Kanal" subtitle="Marketplace & penjualan offline" tone="#0F172A" />
          {perKanal.length ? (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ height: 180, position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={perKanal} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                      {perKanal.map((k, i) => <Cell key={k.name} fill={kanalColor(k.name, i)} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>TOTAL</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>{rpShort(r.pendapatan)}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {perKanal.map((k, i) => (
                  <div key={k.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: kanalColor(k.name, i), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>{k.name}</div>
                      <div style={{ fontSize: 10.5, color: "#94A3B8" }}>{fmtNum(k.pesanan)} order · {fmtNum(k.pcs)} pcs</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, color: "#0F172A" }}>{rpShort(k.value)}</div>
                      <div style={{ fontSize: 10.5, color: "#64748B" }}>{pct(r.pendapatan > 0 ? (k.value / r.pendapatan) * 100 : 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <Empty text="Belum ada pendapatan pada periode ini" height={300} />}
        </Card>
      </div>

      {/* ── Rincian Pendapatan & Pengeluaran ── */}
      <div className="bo-grid-2">
        <Card>
          <CardHead icon={<Wallet size={16} />} title="Rincian Pendapatan" subtitle="Komposisi omzet & status pesanan" />
          <div className="bo-pad">
            <div className="bo-stat-row">
              <StatBox label="Omzet Online" value={rp(d.pendapatan.online)} sub={`${fmtNum(d.pendapatan.pcsOnline)} pcs`} color="#2563EB" />
              <StatBox label="Omzet Offline" value={rp(d.pendapatan.offline)} sub={`${fmtNum(d.pendapatan.pcsOffline)} pcs`} color="#10B981" />
              <StatBox label="Sudah Dicairkan" value={rp(d.pendapatan.pencairan)} sub="dari settlement" color="#0EA5E9" />
            </div>
            <div className="bo-subtitle">Status Pesanan Online</div>
            {statusPesanan.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {statusPesanan.map((s) => (
                  <ProgressRow key={s.name} label={s.name} value={s.value} total={statusPesanan.reduce((a, b) => a + b.value, 0)}
                    color={STATUS_COLOR[s.name] || "#64748B"} right={`${fmtNum(s.value)} order`} />
                ))}
              </div>
            ) : <Empty text="Belum ada pesanan online" height={90} />}
          </div>
        </Card>

        <Card>
          <CardHead icon={<Receipt size={16} />} title="Rincian Pengeluaran" subtitle="Bahan, upah vendor & potongan marketplace" tone="#F97316" />
          <div className="bo-pad">
            {pengBreak.length ? (
              <div className="bo-donut-row">
                <div style={{ width: 150, height: 150, position: "relative", flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pengBreak} dataKey="value" nameKey="name" innerRadius={46} outerRadius={70} paddingAngle={2} stroke="none">
                        {pengBreak.map((x) => <Cell key={x.name} fill={x.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <span style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 700 }}>TOTAL</span>
                    <span style={{ fontSize: 12.5, fontWeight: 900, color: "#0F172A" }}>{rpShort(r.pengeluaran)}</span>
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                  {(d.pengeluaran.breakdown as any[]).map((x) => (
                    <ProgressRow key={x.name} label={x.name} value={x.value} total={r.pengeluaran} color={x.color} />
                  ))}
                </div>
              </div>
            ) : <Empty text="Belum ada pengeluaran tercatat pada periode ini" height={160} />}
          </div>
        </Card>
      </div>

      {/* ── Piutang & Hutang ── */}
      <div className="bo-grid-2">
        <Card>
          <CardHead icon={<HandCoins size={16} />} title="Rincian Piutang" subtitle="Dana yang belum diterima" tone="#0EA5E9"
            right={<span className="bo-pill" style={{ background: "#E0F2FE", color: "#0369A1" }}>{rp(d.piutang.total)}</span>} />
          <div className="bo-pad">
            <div className="bo-stat-row">
              <StatBox label="Marketplace (Escrow)" value={rp(d.piutang.marketplace)} sub={`${fmtNum(d.piutang.pesananBelumCair)} pesanan`} color="#0EA5E9" />
              <StatBox label="Pelanggan Grosir" value={rp(d.piutang.pelanggan)} sub={`${fmtNum(d.piutang.pelangganList.length)} pelanggan`} color="#6366F1" />
            </div>

            <div className="bo-subtitle">Umur Piutang Marketplace</div>
            <div style={{ height: 130 }}>
              {d.piutang.marketplace > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aging} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={axisShort} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Nilai" radius={[5, 5, 0, 0]} maxBarSize={38}>
                      {aging.map((_, i) => <Cell key={i} fill={["#38BDF8", "#0EA5E9", "#F59E0B", "#EF4444"][i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty text="Tidak ada piutang marketplace" height={120} />}
            </div>

            {d.piutang.perPlatform.length > 0 && (
              <>
                <div className="bo-subtitle">Per Platform</div>
                <div className="bo-table-wrap">
                  <table className="bo-table">
                    <thead><tr><th>Platform</th><th className="r">Order</th><th className="r">Dlm Pengiriman</th><th className="r">Selesai (Tunggu Cair)</th><th className="r">Total</th></tr></thead>
                    <tbody>
                      {d.piutang.perPlatform.map((p: any) => (
                        <tr key={p.name}><td><b>{p.name}</b></td><td className="r">{fmtNum(p.pesanan)}</td><td className="r">{rpShort(p.dikirim)}</td><td className="r">{rpShort(p.selesai)}</td><td className="r"><b>{rp(p.value)}</b></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {d.piutang.pelangganList.length > 0 && (
              <>
                <div className="bo-subtitle">Piutang Pelanggan Terbesar</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {d.piutang.pelangganList.map((p: any) => (
                    <ProgressRow key={p.nama} label={`${p.nama}${p.kota ? ` · ${p.kota}` : ""}`} value={p.nilai} total={d.piutang.pelanggan} color="#6366F1" />
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHead icon={<Landmark size={16} />} title="Rincian Hutang" subtitle="Kewajiban ke supplier & vendor produksi" tone="#DC2626"
            right={<Link href="/hutang" className="bo-link">Kelola →</Link>} />
          <div className="bo-pad">
            <div className="bo-stat-row">
              <StatBox label="Hutang Supplier" value={rp(d.hutang.supplier)} sub="pembelian bahan tempo" color="#DC2626" />
              <StatBox label="Hutang Upah Vendor" value={rp(d.hutang.upahVendor)} sub="pcs ACC belum dibayar" color="#F59E0B" />
            </div>
            <div style={{ margin: "4px 0 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#64748B", marginBottom: 6 }}>
                <span>Terbayar <b style={{ color: "#059669" }}>{rp(d.hutang.totalDibayar)}</b></span>
                <span>dari total tagihan <b style={{ color: "#0F172A" }}>{rp(d.hutang.totalTagihan)}</b></span>
              </div>
              <div style={{ height: 8, background: "#FEE2E2", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${d.hutang.totalTagihan > 0 ? (d.hutang.totalDibayar / d.hutang.totalTagihan) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg,#10B981,#059669)", borderRadius: 99 }} />
              </div>
            </div>
            {hutangList.length ? (
              <div className="bo-table-wrap" style={{ maxHeight: 300 }}>
                <table className="bo-table">
                  <thead><tr><th>Kreditur</th><th>Jenis</th><th className="r">Tagihan</th><th className="r">Dibayar</th><th className="r">Sisa</th><th>Status</th></tr></thead>
                  <tbody>
                    {hutangList.map((h, i) => (
                      <tr key={i}>
                        <td><div style={{ fontWeight: 700, color: "#0F172A" }}>{h.nama}</div><div style={{ fontSize: 10.5, color: "#94A3B8" }}>{h.referensi}{h.tanggal ? ` · ${fmtTgl(h.tanggal)}` : ""}{h.umurHari > 0 && h.sisa > 0 ? ` · ${h.umurHari} hr` : ""}</div></td>
                        <td style={{ fontSize: 11 }}>{h.jenis}</td>
                        <td className="r">{rpShort(h.total)}</td>
                        <td className="r" style={{ color: "#059669" }}>{rpShort(h.dibayar)}</td>
                        <td className="r"><b style={{ color: h.sisa > 0 ? "#DC2626" : "#059669" }}>{rpShort(h.sisa)}</b></td>
                        <td><span className="bo-pill" style={h.sisa <= 0 ? { background: "#DCFCE7", color: "#166534" } : h.dibayar > 0 ? { background: "#FEF3C7", color: "#92400E" } : { background: "#FEE2E2", color: "#B91C1C" }}>{h.sisa <= 0 ? "Lunas" : h.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty text="Tidak ada hutang tercatat" height={120} />}
          </div>
        </Card>
      </div>

      {/* ── Produk ── */}
      <div className="bo-section-title"><Shirt size={16} /> Analitik Produk</div>
      <div className="bo-grid-main">
        <Card>
          <CardHead icon={<Award size={16} />} title="Produk Terlaris (SKU)" subtitle={`${fmtNum(d.produk.jumlahSku)} SKU terjual · ${d.range.label}`} tone="#8B5CF6"
            right={
              <div className="bo-seg">
                <button className={produkMode === "pcs" ? "active" : ""} onClick={() => setProdukMode("pcs")}>Pcs</button>
                <button className={produkMode === "omzet" ? "active" : ""} onClick={() => setProdukMode("omzet")}>Omzet</button>
              </div>
            }
          />
          <div style={{ height: Math.max(220, topSku.length * 34 + 30), padding: "4px 16px 12px 4px" }}>
            {topSku.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...topSku].sort((a, b) => b[produkMode] - a[produkMode])} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" horizontal={false} />
                  <XAxis type="number" tickFormatter={produkMode === "omzet" ? axisShort : undefined} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="sku" width={150} tick={{ fontSize: 10, fill: "#334155", fontWeight: 600 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => (v.length > 24 ? v.slice(0, 23) + "…" : v)} />
                  <Tooltip content={<ChartTooltip money={produkMode === "omzet"} />} cursor={{ fill: "#F5F3FF" }} />
                  <Bar dataKey={produkMode} name={produkMode === "pcs" ? "Pcs Terjual" : "Omzet"} radius={[0, 6, 6, 0]} maxBarSize={20}>
                    {topSku.map((_, i) => <Cell key={i} fill={i === 0 ? "#7C3AED" : i < 3 ? "#8B5CF6" : "#C4B5FD"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty text="Belum ada produk terjual pada periode ini" height={220} />}
          </div>
        </Card>

        <Card>
          <CardHead icon={<Ruler size={16} />} title="Distribusi Ukuran" subtitle="Pcs terjual per size" tone="#14B8A6" />
          <div style={{ height: 230, padding: "4px 12px 6px 0" }}>
            {perSize.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perSize} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="size" tick={{ fontSize: 11, fill: "#334155", fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip money={false} />} cursor={{ fill: "#F0FDFA" }} />
                  <Bar dataKey="pcs" name="Pcs" radius={[6, 6, 0, 0]} maxBarSize={34}>
                    {perSize.map((s, i) => <Cell key={s.size} fill={PALETTE[(i + 5) % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty text="Belum ada data ukuran" height={220} />}
          </div>
          {perSize.length > 0 && (
            <div style={{ padding: "0 16px 16px", fontSize: 11.5, color: "#64748B" }}>
              Ukuran paling laku: <b style={{ color: "#0F172A" }}>{[...perSize].sort((a, b) => b.pcs - a.pcs)[0].size}</b> ({fmtNum([...perSize].sort((a, b) => b.pcs - a.pcs)[0].pcs)} pcs) — prioritaskan di SPK potong berikutnya.
            </div>
          )}
        </Card>
      </div>

      <div className="bo-grid-main">
        <Card>
          <CardHead icon={<TrendingUp size={16} />} title="Tren Penjualan per Model" subtitle="4 model dengan omzet tertinggi (pcs)" tone="#EC4899" />
          <div style={{ height: 270, padding: "6px 12px 12px 0" }}>
            {modelTrend.models.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={modelTrend.data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip money={false} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  {modelTrend.models.map((m: string, i: number) => (
                    <Line key={m} type="monotone" dataKey={m} name={m} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty text="Belum ada data tren model" height={250} />}
          </div>
        </Card>

        <Card>
          <CardHead icon={<Layers size={16} />} title="Kontribusi Model" subtitle="Omzet per model produk" tone="#6366F1" />
          <div className="bo-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topModel.length ? topModel.map((m, i) => (
              <ProgressRow key={m.model} label={<><span style={{ color: "#94A3B8", marginRight: 6 }}>#{i + 1}</span>{m.model}</>} value={m.omzet}
                total={topModel[0].omzet} color={PALETTE[i % PALETTE.length]} right={<>{rpShort(m.omzet)} <span style={{ color: "#94A3B8", fontWeight: 600 }}>· {fmtNum(m.pcs)} pcs</span></>} />
            )) : <Empty text="Belum ada data model" height={200} />}
          </div>
        </Card>
      </div>

      {/* Tabel detail SKU */}
      {topSku.length > 0 && (
        <Card>
          <CardHead icon={<Package size={16} />} title="Detail Performa SKU" subtitle="Peringkat lengkap produk terjual pada periode ini" tone="#8B5CF6" />
          <div className="bo-table-wrap" style={{ maxHeight: 380, margin: "0 16px 16px" }}>
            <table className="bo-table">
              <thead><tr><th>#</th><th>SKU / Produk</th><th>Kanal</th><th className="r">Pcs</th><th className="r">Omzet</th><th className="r">Harga Rata²</th><th style={{ width: 140 }}>Kontribusi Pcs</th></tr></thead>
              <tbody>
                {topSku.map((s, i) => (
                  <tr key={s.sku}>
                    <td style={{ color: "#94A3B8", fontWeight: 700 }}>{i + 1}</td>
                    <td><div style={{ fontWeight: 800, color: "#1E293B" }}>{s.sku}</div><div className="bo-ellipsis" style={{ fontSize: 10.5, color: "#94A3B8", maxWidth: 380 }}>{s.nama}</div></td>
                    <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{s.kanal.map((k: string, j: number) => <span key={k} className="bo-pill" style={{ background: `${kanalColor(k, j)}15`, color: kanalColor(k, j) }}>{k.replace(/^Penjualan\s+/i, "")}</span>)}</div></td>
                    <td className="r"><b>{fmtNum(s.pcs)}</b></td>
                    <td className="r"><b style={{ color: "#059669" }}>{rp(s.omzet)}</b></td>
                    <td className="r">{rpShort(s.pcs > 0 ? s.omzet / s.pcs : 0)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, height: 6, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${Math.min(100, s.share)}%`, height: "100%", background: "#8B5CF6" }} /></div>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#475569", width: 38, textAlign: "right" }}>{pct(s.share)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Inventori, Pelanggan, Transaksi ── */}
      <div className="bo-section-title"><Boxes size={16} /> Inventori, Pelanggan & Transaksi</div>
      <div className="bo-grid-3">
        <Card>
          <CardHead icon={<Boxes size={16} />} title="Posisi Barang (Barcode)" subtitle={`${fmtNum(totalInv)} pcs terlacak`} tone="#10B981" />
          <div className="bo-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {inv.length ? inv.map((x) => (
              <ProgressRow key={x.key} label={x.name} value={x.value} total={totalInv} color={INV_COLOR[x.key] || "#64748B"} right={`${fmtNum(x.value)} pcs`} />
            )) : <Empty text="Belum ada barcode" height={120} />}
            <div className="bo-divider" />
            <div className="bo-kv"><span>Stok Kain</span><b>{fmtNum(d.inventori.meterKain)} m · {rpShort(d.inventori.nilaiKain)}</b></div>
            <div className="bo-kv"><span>Item Pendukung</span><b>{rpShort(d.inventori.nilaiAksesoris)}</b></div>
            <div className="bo-kv"><span>Total Aset Bahan</span><b style={{ color: "#059669" }}>{rp(d.inventori.nilaiKain + d.inventori.nilaiAksesoris)}</b></div>
          </div>
        </Card>

        <Card>
          <CardHead icon={<MapPin size={16} />} title="Wilayah Pembeli" subtitle="Provinsi dengan pesanan terbanyak" tone="#F43F5E" />
          <div className="bo-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {d.pelanggan.perProvinsi.length ? d.pelanggan.perProvinsi.map((p: any, i: number) => (
              <ProgressRow key={p.name} label={p.name} value={p.value} total={d.pelanggan.perProvinsi[0].value} color={i === 0 ? "#F43F5E" : "#FDA4AF"}
                right={<>{fmtNum(p.value)} <span style={{ color: "#94A3B8", fontWeight: 600 }}>· {rpShort(p.omzet)}</span></>} />
            )) : <Empty text="Belum ada data wilayah" height={160} />}
          </div>
        </Card>

        <Card>
          <CardHead icon={<Truck size={16} />} title="Kurir & Pembayaran" subtitle="Preferensi pembeli online" tone="#0EA5E9" />
          <div className="bo-pad">
            {d.pelanggan.perKurir.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {d.pelanggan.perKurir.map((k: any, i: number) => (
                  <ProgressRow key={k.name} label={k.name} value={k.value} total={d.pelanggan.perKurir[0].value} color={PALETTE[i % PALETTE.length]} right={`${fmtNum(k.value)} order`} />
                ))}
              </div>
            ) : <Empty text="Belum ada data kurir" height={80} />}
            <div className="bo-subtitle" style={{ display: "flex", alignItems: "center", gap: 6 }}><CreditCard size={12} /> Metode Pembayaran</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {d.pelanggan.perPembayaran.length ? d.pelanggan.perPembayaran.map((p: any, i: number) => (
                <span key={p.name} className="bo-chip">
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: PALETTE[(i + 2) % PALETTE.length] }} />
                  {p.name} <b>{fmtNum(p.value)}</b>
                </span>
              )) : <span style={{ fontSize: 12, color: "#94A3B8" }}>-</span>}
            </div>
          </div>
        </Card>
      </div>

      <div className="bo-grid-2">
        <Card>
          <CardHead icon={<ShoppingBag size={16} />} title="Transaksi Penjualan Terbaru" subtitle="10 transaksi terakhir pada periode ini" tone="#2563EB"
            right={<Link href="/penjualan-online" className="bo-link">Lihat semua →</Link>} />
          {d.transaksiTerbaru.length ? (
            <div className="bo-table-wrap" style={{ margin: "0 16px 16px" }}>
              <table className="bo-table">
                <thead><tr><th>Waktu</th><th>ID / Pelanggan</th><th>Kanal</th><th className="r">Pcs</th><th className="r">Nilai</th></tr></thead>
                <tbody>
                  {d.transaksiTerbaru.map((t: any, i: number) => (
                    <tr key={`${t.id}-${i}`}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 11 }}>{fmtTglJam(t.tanggal)}</td>
                      <td><div style={{ fontWeight: 700, color: "#1E293B", fontSize: 11.5 }}>{t.id}</div><div style={{ fontSize: 10.5, color: "#94A3B8" }}>{t.pelanggan}</div></td>
                      <td><span className="bo-pill" style={{ background: `${kanalColor(t.kanal, i)}15`, color: kanalColor(t.kanal, i) }}>{t.kanal}</span></td>
                      <td className="r">{fmtNum(t.pcs)}</td>
                      <td className="r"><b>{rpShort(t.nilai)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty text="Belum ada transaksi" height={160} />}
        </Card>

        <Card>
          <CardHead icon={<Receipt size={16} />} title="Riwayat Pengeluaran" subtitle="Pembelian bahan & pembayaran upah vendor" tone="#F97316"
            right={<Link href="/pembelian" className="bo-link">Pembelian →</Link>} />
          {d.pengeluaran.detail.length ? (
            <div className="bo-table-wrap" style={{ margin: "0 16px 16px" }}>
              <table className="bo-table">
                <thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th className="r">Nilai</th></tr></thead>
                <tbody>
                  {d.pengeluaran.detail.map((x: any, i: number) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 11 }}>{fmtTgl(x.tanggal)}</td>
                      <td><span className="bo-pill" style={x.kategori === "Pembelian Bahan" ? { background: "#EEF2FF", color: "#4338CA" } : { background: "#FEF3C7", color: "#92400E" }}>{x.kategori}</span></td>
                      <td><div className="bo-ellipsis" style={{ fontSize: 11.5, maxWidth: 260 }}>{x.keterangan}</div><div style={{ fontSize: 10.5, color: "#94A3B8" }}>{x.metode}</div></td>
                      <td className="r"><b style={{ color: "#C2410C" }}>{rpShort(x.nilai)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty text="Belum ada pengeluaran tercatat pada periode ini" height={160} />}
        </Card>
      </div>

      <div style={{ fontSize: 10.5, color: "#94A3B8", textAlign: "center", padding: "4px 0 8px", lineHeight: 1.6 }}>
        Pendapatan dihitung dari pesanan marketplace (non-batal) & penjualan offline berdasarkan tanggal pesanan. Potongan marketplace diambil dari data settlement.
        Arus kas bersih = pendapatan − (pembelian bahan + upah vendor dibayar + potongan marketplace). Piutang & hutang menampilkan saldo berjalan saat ini.
      </div>
    </div>
  );
}

// ───────────────────────── Sub Components ─────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const data = values.map((v, i) => ({ i, v }));
  if (!values.some((v) => v)) return <div style={{ height: 34 }} />;
  const id = `sp-${color.replace("#", "")}`;
  return (
    <div style={{ height: 34, marginTop: 6 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiHero({ tone, icon, title, value, growth, foot, spark }: { tone: string; icon: React.ReactNode; title: string; value: string; growth?: React.ReactNode; foot?: React.ReactNode; spark: number[] }) {
  return (
    <div className="bo-card bo-kpi" style={{ borderTop: `3px solid ${tone}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${tone}14`, color: tone, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      </div>
      <div className="bo-kpi-value">{value}</div>
      <div style={{ marginTop: 6 }}>{growth}</div>
      <Sparkline values={spark} color={tone} />
      <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, lineHeight: 1.5 }}>{foot}</div>
    </div>
  );
}

function KpiMini({ tone, icon, title, value, note, href }: { tone: string; icon: React.ReactNode; title: string; value: string; note: string; href?: string }) {
  const body = (
    <div className="bo-card bo-kpi-mini">
      <div style={{ width: 38, height: 38, borderRadius: 11, background: `${tone}14`, color: tone, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: tone, margin: "2px 0" }}>{value}</div>
        <div style={{ fontSize: 10.5, color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note}</div>
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{body}</Link> : body;
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bo-statbox" style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748B" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", margin: "2px 0" }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#94A3B8" }}>{sub}</div>}
    </div>
  );
}

function BoStyles() {
  return (
    <style>{`
      .bo-wrap { display: flex; flex-direction: column; gap: 18px; }
      .bo-card { background: white; border: 1px solid #E2E8F0; border-radius: 16px; box-shadow: 0 1px 3px rgba(15,23,42,0.03); min-width: 0; }
      .bo-card-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 16px 10px; flex-wrap: wrap; }
      .bo-card-title { font-size: 14px; font-weight: 800; color: #0F172A; }
      .bo-card-sub { font-size: 11px; color: #94A3B8; margin-top: 1px; }
      .bo-pad { padding: 4px 16px 16px; }
      .bo-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
      .bo-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
      .bo-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
      .bo-grid-main { display: grid; grid-template-columns: minmax(0,2fr) minmax(0,1fr); gap: 14px; }
      .bo-kpi { padding: 14px 16px 14px; transition: box-shadow .2s, transform .2s; }
      .bo-kpi:hover, .bo-kpi-mini:hover { box-shadow: 0 8px 24px rgba(15,23,42,0.07); transform: translateY(-1px); }
      .bo-kpi-value { font-size: 22px; font-weight: 900; color: #0F172A; letter-spacing: -0.4px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bo-kpi-mini { padding: 12px 14px; display: flex; align-items: center; gap: 12px; transition: box-shadow .2s, transform .2s; height: 100%; }
      .bo-growth { display: inline-flex; align-items: center; gap: 2px; font-size: 10.5px; font-weight: 800; padding: 3px 8px; border-radius: 99px; }
      .bo-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: white; border: 1px solid #E2E8F0; border-radius: 14px; padding: 8px 12px; }
      .bo-range { display: flex; align-items: center; gap: 4px; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
      .bo-range::-webkit-scrollbar { display: none; }
      .bo-range-btn { border: 1px solid transparent; background: transparent; color: #475569; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 9px; cursor: pointer; white-space: nowrap; transition: all .15s; }
      .bo-range-btn:hover { background: #F1F5F9; }
      .bo-range-btn.active { background: #0F172A; color: white; }
      .bo-btn-ghost { display: inline-flex; align-items: center; gap: 5px; background: white; border: 1px solid #E2E8F0; border-radius: 8px; padding: 5px 10px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer; }
      .bo-btn-primary { background: #2563EB; color: white; border: none; border-radius: 10px; padding: 10px 20px; font-weight: 700; cursor: pointer; }
      .bo-seg { display: inline-flex; background: #F1F5F9; border-radius: 9px; padding: 3px; }
      .bo-seg button { border: none; background: transparent; font-size: 11px; font-weight: 700; color: #64748B; padding: 5px 10px; border-radius: 7px; cursor: pointer; }
      .bo-seg button.active { background: white; color: #0F172A; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
      .bo-subtitle { font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; margin: 16px 0 10px; }
      .bo-stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
      .bo-statbox { background: #F8FAFC; border-radius: 10px; padding: 10px 12px; min-width: 0; }
      .bo-donut-row { display: flex; align-items: center; gap: 18px; }
      .bo-pill { display: inline-flex; align-items: center; font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 99px; white-space: nowrap; }
      .bo-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #334155; background: #F8FAFC; border: 1px solid #E2E8F0; padding: 4px 10px; border-radius: 99px; }
      .bo-link { font-size: 11.5px; font-weight: 800; color: #2563EB; text-decoration: none; white-space: nowrap; }
      .bo-table-wrap { overflow: auto; border: 1px solid #F1F5F9; border-radius: 10px; }
      .bo-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .bo-table th { position: sticky; top: 0; background: #F8FAFC; color: #64748B; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; text-align: left; padding: 9px 10px; border-bottom: 1px solid #E2E8F0; white-space: nowrap; z-index: 1; }
      .bo-table td { padding: 9px 10px; border-bottom: 1px solid #F1F5F9; color: #334155; vertical-align: middle; }
      .bo-table tr:last-child td { border-bottom: none; }
      .bo-table tbody tr:hover { background: #FAFBFD; }
      .bo-table .r { text-align: right; white-space: nowrap; }
      .bo-ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bo-divider { height: 1px; background: #F1F5F9; margin: 4px 0; }
      .bo-kv { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: #64748B; }
      .bo-kv b { color: #0F172A; }
      .bo-section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 900; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; }
      .bo-skeleton { background: linear-gradient(90deg,#F1F5F9 25%,#E9EEF5 37%,#F1F5F9 63%); background-size: 400% 100%; animation: boShimmer 1.4s ease infinite; }
      @keyframes boShimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
      .bo-spin { animation: boSpin 0.8s linear infinite; }
      @keyframes boSpin { to { transform: rotate(360deg); } }

      @media (max-width: 1280px) {
        .bo-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
        .bo-grid-3 { grid-template-columns: repeat(2, minmax(0,1fr)); }
      }
      @media (max-width: 1100px) {
        .bo-grid-main { grid-template-columns: minmax(0,1fr); }
      }
      @media (max-width: 900px) {
        .bo-grid-2, .bo-grid-3 { grid-template-columns: minmax(0,1fr); }
      }
      @media (max-width: 560px) {
        .bo-grid-4 { grid-template-columns: minmax(0,1fr); gap: 10px; }
        .bo-kpi-value { font-size: 20px; }
        .bo-donut-row { flex-direction: column; align-items: stretch; }
        .bo-donut-row > div:first-child { margin: 0 auto; }
        .bo-toolbar { padding: 8px; }
      }
    `}</style>
  );
}

