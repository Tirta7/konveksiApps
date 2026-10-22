"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  XCircle,
  Phone,
  Briefcase,
  Calendar,
  Lock,
  Scissors,
  Check,
  X,
  ExternalLink,
  Info,
  RefreshCw,
} from "lucide-react";

interface UserItem {
  id: number;
  username: string;
  nama: string;
  role: "owner" | "admin";
  telepon?: string;
  jabatan?: string;
  catatan?: string;
  aktif?: boolean;
  createdAt?: string;
}

interface TukangItem {
  id: number;
  nama: string;
  kode: string;
  kontak: string;
  total_spk?: number;
  total_meter?: number;
  total_pcs?: number;
}

export default function KaryawanPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [tukangs, setTukangs] = useState<TukangItem[]>([]);
  const [meId, setMeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"users" | "tukang" | "matrix">("users");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "admin">("all");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState({
    nama: "",
    username: "",
    jabatan: "",
    telepon: "",
    role: "admin" as "owner" | "admin",
    password: "",
    catatan: "",
  });
  const [saving, setSaving] = useState(false);

  // Reset Password Modal
  const [pwModalUser, setPwModalUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const loadData = async () => {
    try {
      const [resUsers, resMe, resTukang] = await Promise.all([
        fetch("/api/users", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/tukang-potong", { cache: "no-store" }).then((r) => r.json()),
      ]);

      if (Array.isArray(resUsers)) setUsers(resUsers);
      setMeId(resMe?.session?.id ?? null);
      if (Array.isArray(resTukang)) setTukangs(resTukang);
    } catch {
      toast.error("Gagal memuat data staf & karyawan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setForm({
      nama: "",
      username: "",
      jabatan: "Admin Operasional",
      telepon: "",
      role: "admin",
      password: "",
      catatan: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setForm({
      nama: u.nama || "",
      username: u.username || "",
      jabatan: u.jabatan || "",
      telepon: u.telepon || "",
      role: u.role,
      password: "",
      catatan: u.catatan || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        // Edit existing
        const res = await fetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingUser.id,
            nama: form.nama,
            jabatan: form.jabatan,
            telepon: form.telepon,
            role: form.role,
            catatan: form.catatan,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Gagal memperbarui profil karyawan");
        toast.success(`Data ${form.nama} berhasil diperbarui`);
      } else {
        // Create new
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Gagal menambahkan karyawan");
        toast.success(`Akun karyawan ${form.nama} (${form.username}) berhasil dibuat`);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAktif = async (u: UserItem) => {
    try {
      const nextStatus = u.aktif === false;
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, aktif: nextStatus }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal mengubah status");
      toast.success(`Akun ${u.nama} ${nextStatus ? "diaktifkan" : "dinonaktifkan (sesi keluar otomatis)"}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwModalUser || !newPassword) return;
    setSavingPw(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pwModalUser.id, password: newPassword }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal mengganti password");
      toast.success(`Password untuk ${pwModalUser.username} berhasil diganti. Sesi login lama otomatis dihentikan.`);
      setPwModalUser(null);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPw(false);
    }
  };

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`Hapus permanen akun ${u.nama} (${u.username})? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/users?id=${u.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal menghapus pengguna");
      toast.success(`Akun ${u.username} berhasil dihapus`);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Filtered list
  const filteredUsers = users.filter((u) => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      u.nama?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.jabatan?.toLowerCase().includes(q) ||
      u.telepon?.includes(q);
    return matchRole && matchSearch;
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.aktif !== false).length;
  const ownerCount = users.filter((u) => u.role === "owner").length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F1F5F9", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 32px", background: "white", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#2563EB,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <Users size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", margin: 0 }}>Data Karyawan & Hak Akses</h1>
              <p style={{ fontSize: 13, color: "#64748B", margin: "2px 0 0" }}>
                Manajemen akun staf, admin operasional, hak akses sistem (RBAC), serta data staf konveksi.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => loadData()}
            title="Refresh data"
            style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, padding: "9px 12px", cursor: "pointer", color: "#475569", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            id="btn-tambah-karyawan"
            onClick={openAddModal}
            style={{
              background: "linear-gradient(135deg,#2563EB,#1D4ED8)",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
            }}
          >
            <UserPlus size={16} /> Tambah Karyawan / Staf
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Ringkasan Statistik */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <div style={{ background: "white", padding: "18px 20px", borderRadius: 14, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>TOTAL STAF</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A" }}>{totalUsers} <span style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8" }}>orang</span></div>
            </div>
          </div>

          <div style={{ background: "white", padding: "18px 20px", borderRadius: 14, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>STAF AKTIF</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#059669" }}>{activeUsers} <span style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8" }}>orang</span></div>
            </div>
          </div>

          <div style={{ background: "white", padding: "18px 20px", borderRadius: 14, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#F5F3FF", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>ROLE OWNER</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#7C3AED" }}>{ownerCount} <span style={{ fontSize: 12, fontWeight: 600, color: "#A78BFA" }}>(Akses Penuh)</span></div>
            </div>
          </div>

          <div style={{ background: "white", padding: "18px 20px", borderRadius: 14, border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FFF7ED", color: "#EA580C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Briefcase size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>ADMIN & GUDANG</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#EA580C" }}>{adminCount} <span style={{ fontSize: 12, fontWeight: 600, color: "#FB923C" }}>(Operasional)</span></div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", borderBottom: "1px solid #CBD5E1", gap: 8 }}>
          <button
            onClick={() => setActiveTab("users")}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 800,
              background: activeTab === "users" ? "white" : "transparent",
              color: activeTab === "users" ? "#2563EB" : "#64748B",
              border: activeTab === "users" ? "1px solid #CBD5E1" : "none",
              borderBottom: activeTab === "users" ? "2px solid white" : "none",
              marginBottom: activeTab === "users" ? -1 : 0,
              borderRadius: "10px 10px 0 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Users size={16} /> Daftar Karyawan & Akun Staf ({users.length})
          </button>

          <button
            onClick={() => setActiveTab("tukang")}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 800,
              background: activeTab === "tukang" ? "white" : "transparent",
              color: activeTab === "tukang" ? "#2563EB" : "#64748B",
              border: activeTab === "tukang" ? "1px solid #CBD5E1" : "none",
              borderBottom: activeTab === "tukang" ? "2px solid white" : "none",
              marginBottom: activeTab === "tukang" ? -1 : 0,
              borderRadius: "10px 10px 0 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Scissors size={16} /> Tukang Potong ({tukangs.length})
          </button>

          <button
            onClick={() => setActiveTab("matrix")}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 800,
              background: activeTab === "matrix" ? "white" : "transparent",
              color: activeTab === "matrix" ? "#2563EB" : "#64748B",
              border: activeTab === "matrix" ? "1px solid #CBD5E1" : "none",
              borderBottom: activeTab === "matrix" ? "2px solid white" : "none",
              marginBottom: activeTab === "matrix" ? -1 : 0,
              borderRadius: "10px 10px 0 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ShieldCheck size={16} /> Matriks Hak Akses (Role Permissions)
          </button>
        </div>

        {/* TAB 1: DAFTAR KARYAWAN & AKUN */}
        {activeTab === "users" && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 20 }}>
            {/* Filter Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 16 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 10, padding: "0 14px", maxWidth: 420 }}>
                <Search size={16} color="#94A3B8" />
                <input
                  style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0F172A" }}
                  placeholder="Cari nama karyawan, username, jabatan, atau telepon..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Filter Peran:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, fontWeight: 600, background: "white", color: "#0F172A" }}
                >
                  <option value="all">Semua Peran ({users.length})</option>
                  <option value="owner">Owner ({ownerCount})</option>
                  <option value="admin">Admin / Gudang ({adminCount})</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #E2E8F0", color: "#64748B", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    <th style={{ padding: "12px 16px" }}>Karyawan</th>
                    <th style={{ padding: "12px 16px" }}>Username</th>
                    <th style={{ padding: "12px 16px" }}>Jabatan / Divisi</th>
                    <th style={{ padding: "12px 16px" }}>Kontak / WA</th>
                    <th style={{ padding: "12px 16px" }}>Hak Akses</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                        Tidak ditemukan data karyawan yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isMe = u.id === meId;
                      const isOwner = u.role === "owner";
                      const initials = (u.nama || u.username)
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();

                      return (
                        <tr
                          key={u.id}
                          style={{
                            borderBottom: "1px solid #F1F5F9",
                            opacity: u.aktif === false ? 0.6 : 1,
                            background: isMe ? "#F8FAFC" : "transparent",
                          }}
                        >
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: "50%",
                                  background: isOwner
                                    ? "linear-gradient(135deg,#7C3AED,#A855F7)"
                                    : "linear-gradient(135deg,#2563EB,#38BDF8)",
                                  color: "white",
                                  fontWeight: 800,
                                  fontSize: 12,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                                }}
                              >
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                                  {u.nama}
                                  {isMe && (
                                    <span style={{ fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#2563EB", padding: "1px 6px", borderRadius: 4 }}>
                                      Anda
                                    </span>
                                  )}
                                </div>
                                {u.createdAt && (
                                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                                    Dibuat: {new Date(u.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <code style={{ fontSize: 12, background: "#F1F5F9", padding: "3px 8px", borderRadius: 6, color: "#0F172A", fontWeight: 700 }}>
                              {u.username}
                            </code>
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                              {u.jabatan || (isOwner ? "Pemilik Usaha" : "Admin Operasional")}
                            </div>
                            {u.catatan && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{u.catatan}</div>}
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            {u.telepon ? (
                              <a
                                href={`https://wa.me/${u.telepon.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 12, color: "#059669", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <Phone size={13} /> {u.telepon}
                              </a>
                            ) : (
                              <span style={{ fontSize: 12, color: "#94A3B8" }}>-</span>
                            )}
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 11,
                                fontWeight: 800,
                                padding: "4px 10px",
                                borderRadius: 8,
                                background: isOwner ? "#F5F3FF" : "#EFF6FF",
                                color: isOwner ? "#7C3AED" : "#2563EB",
                                border: `1px solid ${isOwner ? "#DDD6FE" : "#BFDBFE"}`,
                              }}
                            >
                              {isOwner ? <ShieldCheck size={13} /> : <Briefcase size={13} />}
                              {isOwner ? "Owner (Akses Penuh)" : "Admin / Gudang"}
                            </span>
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <button
                              onClick={() => handleToggleAktif(u)}
                              disabled={isMe}
                              style={{
                                background: u.aktif === false ? "#F1F5F9" : "#DCFCE7",
                                color: u.aktif === false ? "#64748B" : "#166534",
                                border: `1px solid ${u.aktif === false ? "#CBD5E1" : "#BBF7D0"}`,
                                borderRadius: 999,
                                padding: "3px 10px",
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: isMe ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.aktif === false ? "#94A3B8" : "#22C55E" }}></span>
                              {u.aktif === false ? "Nonaktif" : "Aktif"}
                            </button>
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <button
                                onClick={() => openEditModal(u)}
                                title="Edit profil karyawan"
                                style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "#334155" }}
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                onClick={() => {
                                  setPwModalUser(u);
                                  setNewPassword("");
                                }}
                                title="Ganti password"
                                style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "#334155" }}
                              >
                                <KeyRound size={13} />
                              </button>

                              <button
                                onClick={() => handleDelete(u)}
                                disabled={isMe}
                                title={isMe ? "Tidak bisa menghapus akun sendiri" : "Hapus karyawan"}
                                style={{
                                  background: "#FEF2F2",
                                  border: "1px solid #FECACA",
                                  borderRadius: 8,
                                  padding: "6px 8px",
                                  cursor: isMe ? "not-allowed" : "pointer",
                                  color: isMe ? "#CBD5E1" : "#DC2626",
                                  opacity: isMe ? 0.4 : 1,
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: TUKANG POTONG */}
        {activeTab === "tukang" && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Data Tukang Potong Internal</h3>
                <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>
                  Staf pemotongan kain bertanggung jawab atas efisiensi yard/meter kain dan hasil potongan pola celana jeans.
                </p>
              </div>
              <Link
                href="/atur-tukang-potong"
                style={{
                  background: "#2563EB",
                  color: "white",
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Buka Atur Tukang Potong <ExternalLink size={14} />
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {tukangs.map((tp) => (
                <div key={tp.id} style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0", padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: "#FEF3C7", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                        <Scissors size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{tp.nama}</div>
                        <div style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>Kode Prefix: {tp.kode}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderTop: "1px dashed #CBD5E1", paddingTop: 12, marginTop: 10, fontSize: 12 }}>
                    <div>
                      <span style={{ color: "#64748B" }}>Total SPK:</span>
                      <div style={{ fontWeight: 800, color: "#0F172A" }}>{tp.total_spk || 0} SPK</div>
                    </div>
                    <div>
                      <span style={{ color: "#64748B" }}>Total Potong:</span>
                      <div style={{ fontWeight: 800, color: "#2563EB" }}>{(tp.total_pcs || 0).toLocaleString("id-ID")} pcs</div>
                    </div>
                  </div>

                  {tp.kontak && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "#059669", display: "flex", alignItems: "center", gap: 4 }}>
                      <Phone size={12} /> {tp.kontak}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MATRIKS HAK AKSES SISTEM (RBAC) */}
        {activeTab === "matrix" && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 24 }}>
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Matriks Hak Akses Modul Konveksi</h3>
              <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
                Pengaturan hak akses membatasi staf operasional dari data rahasia seperti keuangan usaha, omzet, laba-rugi, dan konfigurasi sistem.
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #CBD5E1", background: "#F8FAFC" }}>
                    <th style={{ padding: "12px 16px", color: "#334155", fontWeight: 800 }}>Modul / Fitur Aplikasi</th>
                    <th style={{ padding: "12px 16px", color: "#7C3AED", fontWeight: 800, textAlign: "center" }}>Owner (Pemilik)</th>
                    <th style={{ padding: "12px 16px", color: "#2563EB", fontWeight: 800, textAlign: "center" }}>Admin & Gudang</th>
                    <th style={{ padding: "12px 16px", color: "#D97706", fontWeight: 800, textAlign: "center" }}>Tukang Potong</th>
                    <th style={{ padding: "12px 16px", color: "#059669", fontWeight: 800, textAlign: "center" }}>Vendor (Portal)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { mod: "Dashboard & Ringkasan Produksi", desc: "Melihat grafik, status PO berjalan, dan ringkasan omzet", owner: true, admin: true, tp: false, vendor: false },
                    { mod: "Pemotongan Kain & Buat SPK", desc: "Input gulungan kain, potong kain, dan cetak SPK", owner: true, admin: true, tp: "Hanya link SPK", vendor: false },
                    { mod: "Alur Produksi & Peta Perjalanan PO", desc: "Tracking perpindahan barang antar-vendor (CMT, Washing, Finishing)", owner: true, admin: true, tp: false, vendor: "Hanya PO miliknya" },
                    { mod: "Gudang & Stok Barang Jadi", desc: "Data barang, stok ukuran, mutasi stok, dan approval penerimaan gudang", owner: true, admin: true, tp: false, vendor: false },
                    { mod: "Barcode Produksi & Cetak Label", desc: "Generate barcode per-pcs dan cetak stiker hangtag barcode", owner: true, admin: true, tp: false, vendor: false },
                    { mod: "Penjualan Online & Scan Barcode Kirim", desc: "Upload pesanan CSV marketplace, sinkronisasi API, dan scan barcode keluar", owner: true, admin: true, tp: false, vendor: false },
                    { mod: "Retur Penjualan & Banding Marketplace", desc: "Penerimaan paket retur barang dan komplain marketplace", owner: true, admin: true, tp: false, vendor: false },
                    { mod: "Laporan Penjualan & Laba Rugi", desc: "Melihat total omzet, laba kotor, dan pendapatan per kanal", owner: true, admin: false, tp: false, vendor: false },
                    { mod: "Hutang Vendor & Piutang Penjualan", desc: "Mencatat tagihan vendor CMT/bahan serta pelunasan keuangan", owner: true, admin: false, tp: false, vendor: false },
                    { mod: "Integrasi Marketplace Langsung", desc: "Konfigurasi token API TikTok Shop, Tokopedia, dan Shopee", owner: true, admin: false, tp: false, vendor: false },
                    { mod: "Data Karyawan & Manajemen Pengguna", desc: "Menambah, mengedit, reset password, dan mematikan akun staf", owner: true, admin: false, tp: false, vendor: false },
                    { mod: "Portal Mandiri Vendor", desc: "Input progres jahit, washing, request aksesoris, dan riwayat reject", owner: "Preview", admin: "Preview", tp: false, vendor: true },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #E2E8F0" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 800, color: "#0F172A" }}>{row.mod}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>{row.desc}</div>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {row.owner === true ? (
                          <span style={{ color: "#16A34A", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12 }}>
                            <Check size={16} strokeWidth={3} /> Akses Penuh
                          </span>
                        ) : (
                          <span style={{ color: "#64748B", fontSize: 11 }}>{row.owner}</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {row.admin === true ? (
                          <span style={{ color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12 }}>
                            <Check size={16} strokeWidth={3} /> Boleh
                          </span>
                        ) : row.admin === false ? (
                          <span style={{ color: "#DC2626", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12 }}>
                            <X size={16} strokeWidth={3} /> Dibatasi
                          </span>
                        ) : (
                          <span style={{ color: "#64748B", fontSize: 11 }}>{row.admin}</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {row.tp === true ? (
                          <span style={{ color: "#D97706", fontWeight: 700 }}>Ya</span>
                        ) : row.tp === false ? (
                          <span style={{ color: "#94A3B8" }}>-</span>
                        ) : (
                          <span style={{ color: "#D97706", fontSize: 11, fontWeight: 600 }}>{row.tp}</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {row.vendor === true ? (
                          <span style={{ color: "#059669", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12 }}>
                            <Check size={16} strokeWidth={3} /> Portal Vendor
                          </span>
                        ) : row.vendor === false ? (
                          <span style={{ color: "#94A3B8" }}>-</span>
                        ) : (
                          <span style={{ color: "#059669", fontSize: 11, fontWeight: 600 }}>{row.vendor}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL TAMBAH / EDIT KARYAWAN */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #E2E8F0", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserPlus size={20} color="#2563EB" />
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  {editingUser ? "Edit Data Karyawan" : "Tambah Karyawan / Staf Baru"}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Nama Lengkap *</label>
                <input
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Username Login *</label>
                  <input
                    required
                    disabled={!!editingUser}
                    placeholder="budisantoso"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, background: editingUser ? "#F1F5F9" : "white" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Peran / Hak Akses *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                    disabled={editingUser?.id === meId}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, background: "white" }}
                  >
                    <option value="admin">Admin / Gudang (Operasional)</option>
                    <option value="owner">Owner (Akses Penuh)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Jabatan / Divisi</label>
                  <input
                    placeholder="Contoh: Supervisor Gudang"
                    value={form.jabatan}
                    onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>No. Telepon / WA</label>
                  <input
                    placeholder="081234567890"
                    value={form.telepon}
                    onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  {editingUser ? "Password Baru (kosongkan jika tidak diubah)" : "Password Login * (min. 8 karakter)"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  placeholder={editingUser ? "Biarkan kosong jika tetap" : "Minimal 8 karakter"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Catatan Tambahan</label>
                <input
                  placeholder="Catatan penempatan shift, meja kerja, dll"
                  value={form.catatan}
                  onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#475569" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ background: "#2563EB", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", color: "white" }}
                >
                  {saving ? "Menyimpan..." : editingUser ? "Simpan Perubahan" : "Buat Akun Karyawan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESET PASSWORD */}
      {pwModalUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 420, padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <KeyRound size={18} color="#2563EB" />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>Reset Password</h3>
              </div>
              <button onClick={() => setPwModalUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 14px", lineHeight: 1.5 }}>
              Setel password baru untuk staf <strong>{pwModalUser.nama}</strong> (<code>{pwModalUser.username}</code>). Sesi login yang sedang aktif di perangkat lain akan otomatis dikeluarkan demi keamanan.
            </p>

            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Password Baru *</label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Minimal 8 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setPwModalUser(null)}
                  style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPw || newPassword.length < 8}
                  style={{
                    background: "#2563EB",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: savingPw || newPassword.length < 8 ? "not-allowed" : "pointer",
                    color: "white",
                    opacity: newPassword.length < 8 ? 0.6 : 1,
                  }}
                >
                  {savingPw ? "Menyimpan..." : "Simpan Password Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
