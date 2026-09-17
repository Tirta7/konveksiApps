"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export default function KategoriPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    nama: "",
    deskripsi: ""
  });

  const fetchData = async () => {
    try {
      const res = await fetch("/api/kategori");
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error("Gagal mengambil data kategori");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama) {
      toast.error("Nama kategori wajib diisi");
      return;
    }

    try {
      const isEdit = editingId !== null;
      const url = "/api/kategori";
      const method = isEdit ? "PUT" : "POST";
      const body = JSON.stringify({ ...formData, id: editingId });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Terjadi kesalahan");
      }

      toast.success(isEdit ? "Kategori berhasil diupdate" : "Kategori berhasil ditambahkan");
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus kategori ini?")) return;
    try {
      const res = await fetch(`/api/kategori?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menghapus");
      }
      toast.success("Kategori berhasil dihapus");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setFormData({ nama: "", deskripsi: "" });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({ nama: item.nama, deskripsi: item.deskripsi || "" });
    setShowModal(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
      <div style={{ padding: "24px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Kategori Produk</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>Kelola data kategori produk untuk sistem</p>
        </div>
        <button 
          onClick={openAdd}
          style={{ background: "#2563EB", color: "white", padding: "10px 20px", borderRadius: 8, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          <Plus size={18} /> Tambah Kategori
        </button>
      </div>
      
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748B", fontWeight: 600, width: "15%" }}>UID</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748B", fontWeight: 600, width: "25%" }}>NAMA KATEGORI</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748B", fontWeight: 600 }}>DESKRIPSI</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 600, width: "100px" }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#64748B" }}>Memuat data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#64748B" }}>Belum ada data kategori</td></tr>
              ) : (
                data.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: idx === data.length - 1 ? "none" : "1px solid #E2E8F0" }}>
                    <td style={{ padding: "16px", fontSize: 14, color: "#64748B", fontFamily: "monospace" }}>{item.uid}</td>
                    <td style={{ padding: "16px", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{item.nama}</td>
                    <td style={{ padding: "16px", fontSize: 14, color: "#64748B" }}>{item.deskripsi || "-"}</td>
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(item)} style={{ padding: 6, background: "#F1F5F9", color: "#3B82F6", borderRadius: 6, border: "none", cursor: "pointer" }}><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(item.id)} style={{ padding: 6, background: "#FEF2F2", color: "#EF4444", borderRadius: 6, border: "none", cursor: "pointer" }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", width: 500, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                {editingId ? "Edit Kategori" : "Tambah Kategori"}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Nama Kategori</label>
                <input 
                  type="text" 
                  value={formData.nama}
                  onChange={e => setFormData({...formData, nama: e.target.value})}
                  placeholder="Contoh: Celana Jeans"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 14, outline: "none" }}
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Deskripsi</label>
                <textarea 
                  value={formData.deskripsi}
                  onChange={e => setFormData({...formData, deskripsi: e.target.value})}
                  placeholder="Deskripsi singkat..."
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 14, outline: "none", resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", background: "#F1F5F9", color: "#475569", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>Batal</button>
                <button type="submit" style={{ flex: 1, padding: "12px", background: "#2563EB", color: "white", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
