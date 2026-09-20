"use client";
import React, { useEffect, useState, useRef } from "react";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

export default function AturTukangPotongPage() {
  const [data, setData] = useState<any[]>([]);
  const _bgRefresh = useRef(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [form, setForm] = useState({ id: 0, nama: "", kode: "", kontak: "" });

  const fetchData = async () => {
    if (!_bgRefresh.current) setLoading(true);
    try {
      const res = await fetch("/api/tukang-potong");
      const json = await res.json();
      setData(json);
    } catch (e) {
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/tukang-potong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast.success("Berhasil menyimpan data");
        setShowForm(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal menyimpan");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus?")) return;
    try {
      const res = await fetch(`/api/tukang-potong?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Berhasil dihapus");
        fetchData();
      }
    } catch (e) {
      toast.error("Gagal menghapus");
    }
  };

  const openEdit = (item: any) => {
    setForm(item);
    setShowForm(true);
  };

  // Real-time sync: refresh data when another admin makes changes
  useEffect(() => {
    window.addEventListener("konveksi-sync", fetchData);
    return () => window.removeEventListener("konveksi-sync", fetchData);
  }, [fetchData]);
  return (
    <div style={{ padding: 32, background: "var(--bg-app)", minHeight: "100%" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="page-title">Atur Tukang Potong</h1>
          <p className="page-subtitle">Kelola tim potong kain dan kode unik mereka (misal: GH, SJ).</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => { setForm({ id: 0, nama: "", kode: "", kontak: "" }); setShowForm(true); }}
        >
          <Plus size={18} /> Tambah Tukang Potong
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between" }}>
            <h2 className="card-title">{form.id ? "Edit Tukang Potong" : "Tambah Tukang Potong Baru"}</h2>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ padding: 8 }}><X size={18} /></button>
          </div>
          <form onSubmit={handleSave} style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label className="label">Nama (Atau Tempat)</label>
                <input required className="form-control" value={form.nama || ""} onChange={e => setForm({...form, nama: e.target.value})} placeholder="Contoh: Ngampon" />
              </div>
              <div>
                <label className="label">Kode Prefix PO</label>
                <input required className="form-control" value={form.kode || ""} onChange={e => setForm({...form, kode: e.target.value.toUpperCase()})} placeholder="Contoh: GH" maxLength={4} />
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Kode ini akan menjadi awalan PO, cth: GH-01</div>
              </div>
              <div>
                <label className="label">Kontak / Keterangan</label>
                <input className="form-control" value={form.kontak || ""} onChange={e => setForm({...form, kontak: e.target.value})} placeholder="No HP atau Keterangan" />
              </div>
            </div>
            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary"><Save size={18} /> Simpan Data</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div>Memuat data...</div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Kode</th>
                <th>Nama / Lokasi</th>
                <th>Kontak</th>
                <th style={{ width: 150, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.id}>
                  <td><div className="badge primary" style={{ fontSize: 14 }}>{item.kode}</div></td>
                  <td style={{ fontWeight: 600 }}>{item.nama}</td>
                  <td>{item.kontak || "-"}</td>
                  <td style={{ textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="btn btn-secondary" onClick={() => openEdit(item)} style={{ padding: "8px 12px" }}>
                      <Edit2 size={16} />
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDelete(item.id)} style={{ padding: "8px 12px" }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                    Belum ada data Tukang Potong.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

