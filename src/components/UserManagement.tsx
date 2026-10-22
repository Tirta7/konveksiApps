"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, KeyRound, ShieldCheck, Trash2, Users, Loader2, Power } from "lucide-react";

type U = { id: number; username: string; nama: string; role: "owner" | "admin"; aktif?: boolean; createdAt?: string };

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin / Gudang" };

/** Kelola akun login Owner & Admin/Gudang (khusus Owner). Vendor dikelola di Atur Vendor. */
export default function UserManagement() {
  const [users, setUsers] = useState<U[]>([]);
  const [meId, setMeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: "", username: "", role: "admin", password: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [u, me] = await Promise.all([
        fetch("/api/users", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (Array.isArray(u)) setUsers(u);
      setMeId(me?.session?.id ?? null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const call = async (method: string, body?: any, qs = "") => {
    const res = await fetch(`/api/users${qs}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Gagal");
    return j;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await call("POST", form);
      toast.success(`Akun ${form.username} dibuat`);
      setForm({ nama: "", username: "", role: "admin", password: "" });
      load();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const resetPw = async (u: U) => {
    const pw = window.prompt(`Password baru untuk ${u.username} (min. 8 karakter).\nSemua sesi login akun ini akan keluar otomatis.`);
    if (!pw) return;
    try { await call("PATCH", { id: u.id, password: pw }); toast.success("Password diganti"); } catch (err: any) { toast.error(err.message); }
  };
  const toggle = async (u: U) => {
    try { await call("PATCH", { id: u.id, aktif: u.aktif === false }); load(); } catch (err: any) { toast.error(err.message); }
  };
  const changeRole = async (u: U, role: string) => {
    try { await call("PATCH", { id: u.id, role }); toast.success("Peran diperbarui"); load(); } catch (err: any) { toast.error(err.message); load(); }
  };
  const remove = async (u: U) => {
    if (!window.confirm(`Hapus akun ${u.username}?`)) return;
    try { await call("DELETE", undefined, `?id=${u.id}`); load(); } catch (err: any) { toast.error(err.message); }
  };

  return (
    <section style={{ marginTop: 24, background: "white", border: "1px solid #E2E8F0", borderRadius: 16, padding: 20 }} aria-labelledby="um-title">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#2563EB,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><Users size={17} /></div>
        <h2 id="um-title" style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", margin: 0 }}>Pengguna & Hak Akses</h2>
      </div>
      <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 14px" }}>
        <b>Owner</b>: akses penuh termasuk keuangan & pengaturan. <b>Admin / Gudang</b>: operasional produksi, gudang & penjualan (tanpa Laporan Penjualan, Hutang, Piutang, Karyawan, Pengaturan).
        Akun vendor diatur di menu <b>Atur Vendor</b>.
      </p>

      {loading ? <Loader2 size={18} /> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748B", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: 8 }}>Nama</th><th style={{ padding: 8 }}>Username</th><th style={{ padding: 8 }}>Peran</th><th style={{ padding: 8 }}>Status</th><th style={{ padding: 8, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid #F1F5F9", opacity: u.aktif === false ? 0.55 : 1 }}>
                  <td style={{ padding: 8, fontWeight: 700 }}>{u.nama}{u.id === meId && <span style={{ marginLeft: 6, fontSize: 10, color: "#2563EB" }}>(Anda)</span>}</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{u.username}</td>
                  <td style={{ padding: 8 }}>
                    <select id={`role-${u.id}`} value={u.role} onChange={(e) => changeRole(u, e.target.value)} disabled={u.id === meId} style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid #CBD5E1" }}>
                      <option value="owner">{ROLE_LABEL.owner}</option>
                      <option value="admin">{ROLE_LABEL.admin}</option>
                    </select>
                  </td>
                  <td style={{ padding: 8 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: u.aktif === false ? "#F1F5F9" : "#DCFCE7", color: u.aktif === false ? "#64748B" : "#166534" }}>{u.aktif === false ? "Nonaktif" : "Aktif"}</span>
                  </td>
                  <td style={{ padding: 8, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button id={`reset-${u.id}`} onClick={() => resetPw(u)} title="Ganti password" style={btn}><KeyRound size={13} /></button>
                    {u.id !== meId && <button id={`toggle-${u.id}`} onClick={() => toggle(u)} title={u.aktif === false ? "Aktifkan" : "Nonaktifkan"} style={btn}><Power size={13} /></button>}
                    {u.id !== meId && <button id={`hapus-${u.id}`} onClick={() => remove(u)} title="Hapus" style={{ ...btn, color: "#DC2626", borderColor: "#FECACA" }}><Trash2 size={13} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={add} style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, alignItems: "end", background: "#F8FAFC", padding: 12, borderRadius: 12, border: "1px dashed #CBD5E1" }}>
        <label style={lbl}>Nama<input id="um-nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required style={inp} /></label>
        <label style={lbl}>Username<input id="um-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required pattern="[a-z0-9._-]{3,32}" style={inp} /></label>
        <label style={lbl}>Peran
          <select id="um-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inp}>
            <option value="admin">{ROLE_LABEL.admin}</option>
            <option value="owner">{ROLE_LABEL.owner}</option>
          </select>
        </label>
        <label style={lbl}>Password<input id="um-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} placeholder="min. 8 karakter" style={inp} /></label>
        <button id="um-tambah" type="submit" disabled={saving} style={{ height: 36, border: "none", borderRadius: 8, background: "linear-gradient(135deg,#2563EB,#7C3AED)", color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {saving ? <Loader2 size={14} /> : <UserPlus size={14} />} Tambah Pengguna
        </button>
      </form>
      <div style={{ marginTop: 8, fontSize: 11, color: "#94A3B8", display: "flex", alignItems: "center", gap: 6 }}><ShieldCheck size={12} /> Password disimpan terenkripsi (scrypt). Ganti password / nonaktifkan akun langsung mengeluarkan sesi yang sedang login.</div>
    </section>
  );
}

const btn: React.CSSProperties = { marginLeft: 4, padding: 6, borderRadius: 6, border: "1px solid #CBD5E1", background: "white", color: "#334155", cursor: "pointer", display: "inline-flex" };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: "#475569" };
const inp: React.CSSProperties = { height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, background: "white" };
