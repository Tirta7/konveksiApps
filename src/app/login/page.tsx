"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, User, Eye, EyeOff, ShieldCheck, Loader2, KeyRound } from "lucide-react";

function LoginInner() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [brand, setBrand] = useState({ nama: "KonveksiApps", tagline: "Sistem Tracking Produksi Jeans", logo: "/icons/icon-192.png" });
  const [nama, setNama] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d?.session?.t === "user") window.location.replace(next.startsWith("/") ? next : "/dashboard");
      setNeedsSetup(!!d?.needsSetup);
    }).catch(() => setNeedsSetup(false));
    fetch("/api/pengaturan").then((r) => r.json()).then((d) => {
      setBrand((b) => ({
        nama: d?.nama_usaha ? String(d.nama_usaha).split("|")[0].trim() : b.nama,
        tagline: d?.tagline || b.tagline,
        logo: d?.logo_url || b.logo,
      }));
    }).catch(() => {});
  }, [next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (needsSetup && password !== password2) { setError("Konfirmasi password tidak sama"); return; }
    setLoading(true);
    try {
      const res = await fetch(needsSetup ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsSetup ? { nama, username, password } : { mode: "user", username, password }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal masuk");
      window.location.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main className="login-root">
      <div className="login-glow login-glow-a" />
      <div className="login-glow login-glow-b" />
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <img src={brand.logo} alt="Logo" onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/icons/icon-192.png")} />
          <div>
            <div className="login-brand-name">{brand.nama}</div>
            <div className="login-brand-tag">{brand.tagline}</div>
          </div>
        </div>

        <h1 id="login-title" className="login-title">{needsSetup ? "Buat Akun Owner" : "Masuk ke Aplikasi"}</h1>
        <p className="login-sub">
          {needsSetup
            ? "Instalasi baru terdeteksi. Buat akun Owner pertama — akun ini memiliki akses penuh termasuk keuangan & pengelolaan pengguna."
            : "Gunakan akun yang diberikan Owner. Vendor masuk melalui link portal masing-masing."}
        </p>

        {needsSetup === null ? (
          <div className="login-loading"><Loader2 className="spin" size={22} /></div>
        ) : (
          <form onSubmit={submit} className="login-form">
            {needsSetup && (
              <label className="login-field">
                <span>Nama Lengkap</span>
                <div className="login-input"><User size={16} /><input id="setup-nama" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama pemilik usaha" required /></div>
              </label>
            )}
            <label className="login-field">
              <span>Username</span>
              <div className="login-input"><User size={16} /><input id="login-username" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="contoh: owner" required /></div>
            </label>
            <label className="login-field">
              <span>Password</span>
              <div className="login-input">
                <Lock size={16} />
                <input id="login-password" type={show ? "text" : "password"} autoComplete={needsSetup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={needsSetup ? "Minimal 8 karakter" : "••••••••"} required minLength={needsSetup ? 8 : 1} />
                <button type="button" className="login-eye" onClick={() => setShow((s) => !s)} aria-label="Tampilkan password">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </label>
            {needsSetup && (
              <label className="login-field">
                <span>Ulangi Password</span>
                <div className="login-input"><KeyRound size={16} /><input id="setup-password2" type={show ? "text" : "password"} autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={8} /></div>
              </label>
            )}
            {error && <div className="login-error" role="alert">{error}</div>}
            <button id="login-submit" type="submit" className="login-btn" disabled={loading}>
              {loading ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
              {needsSetup ? "Buat Akun & Masuk" : "Masuk"}
            </button>
          </form>
        )}
        <div className="login-foot"><Lock size={12} /> Koneksi aman · sesi berlaku 7 hari</div>
      </section>

      <style>{`
        .login-root{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden;
          background:radial-gradient(1200px 600px at 10% -10%,hsl(222 60% 22%),transparent 60%),radial-gradient(900px 500px at 110% 110%,hsl(262 55% 22%),transparent 60%),hsl(224 40% 8%);
          font-family:Inter,system-ui,-apple-system,sans-serif}
        .login-glow{position:absolute;border-radius:50%;filter:blur(80px);opacity:.45;animation:float 12s ease-in-out infinite}
        .login-glow-a{width:380px;height:380px;background:hsl(217 91% 55%);top:-120px;left:-80px}
        .login-glow-b{width:320px;height:320px;background:hsl(280 80% 58%);bottom:-120px;right:-60px;animation-delay:-6s}
        @keyframes float{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,20px)}}
        .login-card{position:relative;width:100%;max-width:420px;padding:32px 30px;border-radius:22px;background:rgba(15,23,42,.62);
          border:1px solid rgba(148,163,184,.18);backdrop-filter:blur(18px);box-shadow:0 30px 80px rgba(0,0,0,.45);color:#E2E8F0;animation:rise .5s ease}
        @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .login-brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}
        .login-brand img{width:44px;height:44px;border-radius:12px;object-fit:cover;border:1.5px solid rgba(255,255,255,.2);background:#1E293B}
        .login-brand-name{font-weight:800;font-size:16px;color:#F8FAFC}
        .login-brand-tag{font-size:12px;color:#94A3B8}
        .login-title{font-size:22px;font-weight:800;margin:0 0 6px;color:#F8FAFC;letter-spacing:-.01em}
        .login-sub{font-size:13px;line-height:1.55;color:#94A3B8;margin:0 0 20px}
        .login-form{display:flex;flex-direction:column;gap:14px}
        .login-field span{display:block;font-size:12px;font-weight:700;color:#CBD5E1;margin-bottom:6px}
        .login-input{display:flex;align-items:center;gap:10px;padding:0 12px;height:46px;border-radius:12px;background:rgba(2,6,23,.55);
          border:1px solid rgba(148,163,184,.22);color:#94A3B8;transition:border-color .15s,box-shadow .15s}
        .login-input:focus-within{border-color:hsl(217 91% 60%);box-shadow:0 0 0 4px hsla(217,91%,60%,.18);color:#BFDBFE}
        .login-input input{flex:1;background:transparent;border:none;outline:none;color:#F1F5F9;font-size:14px;height:100%}
        .login-eye{background:none;border:none;color:#94A3B8;cursor:pointer;display:flex;padding:4px}
        .login-error{font-size:12.5px;color:#FECACA;background:rgba(220,38,38,.15);border:1px solid rgba(248,113,113,.35);padding:9px 12px;border-radius:10px}
        .login-btn{height:48px;border:none;border-radius:12px;font-weight:800;font-size:14px;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
          background:linear-gradient(135deg,hsl(217 91% 55%),hsl(262 83% 60%));box-shadow:0 10px 24px hsla(240,80%,55%,.35);transition:transform .12s,filter .12s;margin-top:4px}
        .login-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08)}
        .login-btn:disabled{opacity:.7;cursor:wait}
        .login-loading{display:flex;justify-content:center;padding:30px;color:#94A3B8}
        .login-foot{margin-top:20px;font-size:11px;color:#64748B;display:flex;align-items:center;gap:6px;justify-content:center}
        .spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
