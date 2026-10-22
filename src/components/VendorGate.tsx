"use client";

import { useCallback, useEffect, useState } from "react";
import VendorPortal from "@/components/VendorPortal";
import { Lock, KeyRound, Eye, EyeOff, Loader2, LogOut, ShieldCheck, Factory } from "lucide-react";

/**
 * Gerbang portal vendor:
 *  - Vendor login dengan Kode Vendor (mis. CMT-001) + password yang dibuat admin di Atur Vendor.
 *  - Vendor hanya bisa membuka portal miliknya; owner/admin yang sudah login bisa melihat (pratinjau).
 */
export default function VendorGate({ vendorId, defaultTipe }: { vendorId: string; defaultTipe: string }) {
  const [state, setState] = useState<"loading" | "login" | "vendor" | "user" | "other">("loading");
  const [me, setMe] = useState<any>(null);
  const [kode, setKode] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState("KonveksiApps");

  const check = useCallback(async () => {
    try {
      const d = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json());
      const s = d?.session;
      setMe(s);
      if (!s) setState("login");
      else if (s.t === "user") setState("user");
      else if (String(s.id) === String(vendorId)) setState("vendor");
      else setState("other");
    } catch {
      setState("login");
    }
  }, [vendorId]);

  useEffect(() => {
    check();
    fetch("/api/pengaturan").then((r) => r.json()).then((d) => d?.nama_usaha && setBrand(String(d.nama_usaha).split("|")[0].trim())).catch(() => {});
  }, [check]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "vendor", kode, password, vendor_id: vendorId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal masuk");
      setPassword("");
      await check();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    setState("login");
  };

  if (state === "loading") {
    return <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A", color: "#94A3B8" }}><Loader2 size={24} className="vg-spin" /><style>{`.vg-spin{animation:vgs 1s linear infinite}@keyframes vgs{to{transform:rotate(360deg)}}`}</style></div>;
  }

  if (state === "vendor" || state === "user") {
    return (
      <>
        <VendorPortal vendorId={vendorId} defaultTipe={defaultTipe} viewer={state} />
        <div className="vg-bar">
          {state === "user" ? (
            <span>👁 Pratinjau portal sebagai <b>{me?.nama}</b> (Owner/Admin)</span>
          ) : (
            <button id="vendor-logout" onClick={logout}><LogOut size={13} /> Keluar</button>
          )}
        </div>
        <style>{`.vg-bar{position:fixed;right:12px;bottom:12px;z-index:9999;font-family:Inter,system-ui,sans-serif}
          .vg-bar span{display:inline-block;background:rgba(15,23,42,.9);color:#CBD5E1;font-size:11px;padding:6px 10px;border-radius:999px;border:1px solid #334155}
          .vg-bar button{display:inline-flex;align-items:center;gap:6px;background:rgba(15,23,42,.9);color:#FCA5A5;border:1px solid #7F1D1D;font-weight:800;font-size:12px;padding:8px 12px;border-radius:999px;cursor:pointer}`}</style>
      </>
    );
  }

  return (
    <main className="vg-root">
      <section className="vg-card">
        <div className="vg-icon"><Factory size={22} /></div>
        <h1 className="vg-title">Portal Vendor</h1>
        <p className="vg-sub">{brand} · masuk dengan <b>Kode Vendor</b> dan password dari admin.</p>

        {state === "other" && (
          <div className="vg-warn">
            Anda sedang login sebagai <b>{me?.nama}</b>. Portal ini milik vendor lain.
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => window.location.replace("/dashboard")} className="vg-link">Buka portal saya</button>
              <button type="button" onClick={logout} className="vg-link">Keluar</button>
            </div>
          </div>
        )}

        <form onSubmit={login} className="vg-form">
          <label>
            <span>Kode Vendor</span>
            <div className="vg-input"><KeyRound size={16} /><input id="vendor-kode" value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())} placeholder="contoh: CMT-001" autoCapitalize="characters" autoComplete="username" required /></div>
          </label>
          <label>
            <span>Password</span>
            <div className="vg-input">
              <Lock size={16} />
              <input id="vendor-password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" onClick={() => setShow((s) => !s)} className="vg-eye" aria-label="Tampilkan password">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </label>
          {error && <div className="vg-error" role="alert">{error}</div>}
          <button id="vendor-login-submit" type="submit" className="vg-btn" disabled={busy}>
            {busy ? <Loader2 size={16} className="vg-spin" /> : <ShieldCheck size={16} />} Masuk Portal
          </button>
        </form>
        <div className="vg-foot">Lupa password? Hubungi admin produksi untuk reset.</div>
      </section>
      <style>{`
        .vg-root{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,system-ui,sans-serif;
          background:radial-gradient(900px 500px at 0% 0%,hsl(199 70% 20%),transparent 60%),radial-gradient(800px 500px at 100% 100%,hsl(160 60% 16%),transparent 60%),hsl(222 47% 8%)}
        .vg-card{width:100%;max-width:400px;padding:28px 26px;border-radius:20px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.18);backdrop-filter:blur(16px);color:#E2E8F0;box-shadow:0 30px 70px rgba(0,0,0,.45);animation:vgr .45s ease}
        @keyframes vgr{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .vg-icon{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:white;background:linear-gradient(135deg,hsl(199 89% 48%),hsl(160 84% 39%));margin-bottom:14px;box-shadow:0 10px 22px hsla(180,80%,40%,.35)}
        .vg-title{font-size:21px;font-weight:800;margin:0 0 4px;color:#F8FAFC}
        .vg-sub{font-size:13px;color:#94A3B8;margin:0 0 18px;line-height:1.5}
        .vg-form{display:flex;flex-direction:column;gap:13px}
        .vg-form label span{display:block;font-size:12px;font-weight:700;color:#CBD5E1;margin-bottom:6px}
        .vg-input{display:flex;align-items:center;gap:10px;height:46px;padding:0 12px;border-radius:12px;background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.22);color:#94A3B8}
        .vg-input:focus-within{border-color:hsl(199 89% 55%);box-shadow:0 0 0 4px hsla(199,89%,55%,.18)}
        .vg-input input{flex:1;background:transparent;border:none;outline:none;color:#F1F5F9;font-size:14px;height:100%}
        .vg-eye{background:none;border:none;color:#94A3B8;cursor:pointer;display:flex}
        .vg-error{font-size:12.5px;color:#FECACA;background:rgba(220,38,38,.15);border:1px solid rgba(248,113,113,.35);padding:9px 12px;border-radius:10px}
        .vg-warn{font-size:12.5px;color:#FDE68A;background:rgba(217,119,6,.14);border:1px solid rgba(251,191,36,.3);padding:10px 12px;border-radius:10px;margin-bottom:14px}
        .vg-link{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#F8FAFC;font-size:12px;font-weight:700;padding:5px 10px;border-radius:8px;cursor:pointer}
        .vg-btn{height:48px;border:none;border-radius:12px;color:white;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;
          background:linear-gradient(135deg,hsl(199 89% 48%),hsl(160 84% 39%));box-shadow:0 10px 22px hsla(180,80%,40%,.3);margin-top:4px}
        .vg-btn:disabled{opacity:.7;cursor:wait}
        .vg-foot{margin-top:16px;font-size:11.5px;color:#64748B;text-align:center}
        .vg-spin{animation:vgs 1s linear infinite}@keyframes vgs{to{transform:rotate(360deg)}}
      `}</style>
    </main>
  );
}
