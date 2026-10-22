/**
 * Label status terpadu untuk transfer vendor lanjutan (Washing, Finishing, dst).
 * Pure & client-safe — dipakai di Alur Produksi, Buat PO/SPK, Gudang Produksi
 * dan Portal Vendor agar keterangan status selalu sama di semua halaman.
 *
 * Input `t` = objek transfer hasil GET /api/produksi-transfer
 * (memiliki `progress` = { jumlah, approved, pending, sisa, done, waitingAcc, reject }).
 */

export type TransferStatusKey =
  | "ditolak"
  | "reject"
  | "kembali"
  | "habis"
  | "siap_gudang"
  | "standby"
  | "selesai"
  | "menunggu_acc"
  | "sebagian_acc"
  | "setor_bertahap"
  | "dikerjakan"
  | "retur_perbaikan"
  | "dikirim";

export interface TransferStatusInfo {
  key: TransferStatusKey;
  label: string;
  short: string;
  color: string;
  bg: string;
  border: string;
  hint: string;
}

const fmt = (n: number) => Number(n || 0).toLocaleString("id-ID");

const STYLE: Record<TransferStatusKey, { color: string; bg: string; border: string }> = {
  ditolak: { color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
  reject: { color: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5" },
  kembali: { color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  habis: { color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0" },
  siap_gudang: { color: "#047857", bg: "#ECFDF5", border: "#A7F3D0" },
  standby: { color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  selesai: { color: "#047857", bg: "#ECFDF5", border: "#A7F3D0" },
  menunggu_acc: { color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  sebagian_acc: { color: "#C2410C", bg: "#FFF7ED", border: "#FED7AA" },
  setor_bertahap: { color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
  dikerjakan: { color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
  retur_perbaikan: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  dikirim: { color: "#475569", bg: "#F8FAFC", border: "#E2E8F0" },
};

function build(key: TransferStatusKey, label: string, short: string, hint: string): TransferStatusInfo {
  return { key, label, short, hint, ...STYLE[key] };
}

export function transferStatusInfo(t: any): TransferStatusInfo {
  const status = String(t?.status || "");
  const p = t?.progress || null;
  const jumlah = Number(p?.jumlah ?? t?.jumlah_kirim ?? 0);
  const approved = Number(p?.approved || 0);
  const pending = Number(p?.pending || 0);
  const reject = Number(p?.reject ?? t?.jumlah_reject ?? 0);
  const rejectHint = reject > 0 ? ` · ${fmt(reject)} pcs reject` : "";

  // Reject total (misal barang ditutup sebagai reject permanen dan terbit nota klaim)
  const isFullReject = (reject > 0 && approved <= 0 && (jumlah <= 0 || reject >= jumlah)) || status === "Reject" || (Boolean(t?.no_nota_reject) && approved <= 0);
  if (isFullReject) {
    const notaStr = t?.no_nota_reject ? ` (${t.no_nota_reject})` : "";
    return build(
      "reject",
      `Reject Permanen${notaStr}`,
      `Reject${notaStr}`,
      `Barang rusak permanen / hilang di vendor${notaStr}. Diterbitkan Nota Klaim Ganti Rugi.`
    );
  }

  if (status === "Ditolak") return build("ditolak", "Ditolak", "Ditolak", "Pengiriman ditolak");
  if (status === "Kembali ke Gudang") return build("kembali", "Kembali ke Gudang", "Kembali", "Barang ditarik kembali ke gudang");
  if (status === "Retur Perbaikan" || t?.is_rework || status.includes("Retur")) {
    const ke = t?.rework_count ? ` (Ke-${t.rework_count})` : "";
    return build(
      "retur_perbaikan",
      `Retur Perbaikan${ke}`,
      "Retur Perbaikan",
      `Barang dikembalikan ke vendor untuk dikerjakan/dicuci ulang${t?.alasan_retur ? ` (${t.alasan_retur})` : ""}`
    );
  }

  // Pool standby (belum ada vendor)
  if (t?.vendor_id == null) {
    if (status === "Ditarik Penuh" || Number(t?.jumlah_kirim || 0) <= 0)
      return build("habis", "Habis Dialokasikan", "Habis", "Seluruh jumlah sudah dialokasikan ke vendor");
    if (String(t?.ke || "").toLowerCase() === "gudang" || status === "Selesai")
      return build("siap_gudang", "Selesai · Siap Masuk Gudang", "Siap Gudang", "Menunggu diterima ke Gudang & Stok");
    return build("standby", "Standby · Menunggu Vendor", "Standby", "Belum ada vendor yang mengambil barang ini");
  }

  if (status === "Selesai" || p?.done)
    return build("selesai", reject > 0 ? `Selesai (${fmt(approved || Math.max(0, jumlah - reject))} pcs)` : "Selesai", "Selesai", `${fmt(approved || Math.max(0, jumlah - reject))} pcs di-ACC admin${rejectHint}`);
  if (status === "Diverifikasi")
    return build("selesai", "Selesai (ACC Admin)", "Selesai", `Diverifikasi admin${rejectHint}`);
  if (p?.waitingAcc || (jumlah > 0 && pending > 0 && approved + pending >= jumlah))
    return build("menunggu_acc", "Menunggu ACC Admin", "Menunggu ACC", `Vendor sudah melaporkan seluruh ${fmt(jumlah)} pcs · ${fmt(pending)} pcs menunggu ACC`);
  if (pending > 0)
    return build("sebagian_acc", `Sebagian Menunggu ACC (${fmt(pending)} pcs)`, "Sebagian ACC", `${fmt(approved)} di-ACC · ${fmt(pending)} menunggu ACC · ${fmt(Math.max(0, jumlah - approved - pending))} belum dilaporkan`);
  if (approved > 0)
    return build("setor_bertahap", `Setor Bertahap (${fmt(approved)}/${fmt(jumlah)} di-ACC)`, "Bertahap", `${fmt(Math.max(0, jumlah - approved))} pcs masih dikerjakan vendor`);
  if (status === "Dikerjakan")
    return build("dikerjakan", "Sedang Dikerjakan", "Dikerjakan", "Vendor sedang mengerjakan, belum ada laporan");
  return build("dikirim", "Dikirim · Belum Mulai", "Dikirim", "Barang sudah dikirim, vendor belum mulai mengerjakan");
}
