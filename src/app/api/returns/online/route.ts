export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import { emitEvent } from "@/lib/realtime-hub";

const lineKey = (r: any) =>
  `${String(r.order_id || "").trim()}|${String(r.seller_sku || "").trim()}|${String(r.variation || "").trim()}|${String(r.product_name || "").trim()}`;

/**
 * Pastikan setiap baris retur_online memiliki `id`, `status` default,
 * dan bebas dari duplikat akibat upload berulang di masa lalu.
 */
function normalizeAndDedupe(data: any): boolean {
  if (!Array.isArray(data.retur_online)) {
    data.retur_online = [];
    return false;
  }
  let changed = false;
  const seen = new Set<string>();
  const clean: any[] = [];

  for (const r of data.retur_online) {
    if (!r || typeof r !== "object") {
      changed = true;
      continue;
    }
    const oid = String(r.order_id || "").trim();
    if (!oid || oid.includes("Platform unique")) {
      changed = true;
      continue;
    }
    const k = lineKey(r);
    if (seen.has(k)) {
      changed = true;
      continue;
    }
    seen.add(k);

    if (!r.id) {
      r.id = nextId(data, "retur_online" as any);
      changed = true;
    }
    if (!r.status) {
      r.status = "Menunggu Gudang";
      changed = true;
    }
    clean.push(r);
  }

  if (changed) {
    data.retur_online = clean;
  }
  return changed;
}

export async function GET() {
  try {
    const data: any = readData();
    if (normalizeAndDedupe(data)) {
      writeData(data);
    }
    return NextResponse.json(data.retur_online || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const data: any = readData();
    normalizeAndDedupe(data);
    const { id, status, order_id } = body;

    if ((!id && !order_id) || !status) {
      return NextResponse.json({ error: "id (atau order_id) dan status wajib diisi" }, { status: 400 });
    }

    const idx = data.retur_online.findIndex((r: any) =>
      id ? String(r.id) === String(id) : String(r.order_id).trim() === String(order_id).trim()
    );
    if (idx === -1) {
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    }

    data.retur_online[idx] = {
      ...data.retur_online[idx],
      status,
      updated_at: new Date().toISOString(),
    };
    writeData(data);
    emitEvent("retur_online_updated", { id: data.retur_online[idx].id, status });
    return NextResponse.json({ success: true, item: data.retur_online[idx] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data: any = readData();
    normalizeAndDedupe(data);

    const rows = Array.isArray(body) ? body : [body];
    const existingKeys = new Set<string>(data.retur_online.map(lineKey));
    const now = new Date().toISOString();

    let added = 0;
    let skipped = 0;

    for (const r of rows) {
      const oid = String(r?.order_id || "").trim();
      if (!oid || oid.includes("Platform unique")) {
        skipped++;
        continue;
      }
      const k = lineKey(r);
      if (existingKeys.has(k)) {
        // Perbarui nomor resi retur atau alasan jika sebelumnya kosong/"-"
        const ex = data.retur_online.find((x: any) => lineKey(x) === k);
        if (ex) {
          if ((!ex.tracking_id || ex.tracking_id === "-") && r.tracking_id && r.tracking_id !== "-") {
            ex.tracking_id = r.tracking_id;
          }
          if ((!ex.alasan || ex.alasan === "-") && r.alasan && r.alasan !== "-") {
            ex.alasan = r.alasan;
          }
        }
        skipped++;
        continue;
      }

      existingKeys.add(k);
      // Cek apakah order ini sudah pernah di-scan retur fisiknya di retur_marketplace
      const sudahDiretur = (data.retur_marketplace || []).some(
        (rm: any) => String(rm.order_id || "").trim() === oid
      );

      data.retur_online.push({
        ...r,
        id: nextId(data, "retur_online" as any),
        order_id: oid,
        return_quantity: Number(r.return_quantity || 1) || 1,
        status: r.status || (sudahDiretur ? "Masuk Gudang" : "Menunggu Gudang"),
        tanggal_diimpor: now,
      });
      added++;

      // Sinkronkan juga ke data.penjualan_online jika Order ID tersebut sudah ada di pesanan
      if (Array.isArray(data.penjualan_online)) {
        for (const po of data.penjualan_online) {
          if (String(po.order_id || "").trim() === oid) {
            po.dibatalkan = r.return_type === "Cancel";
            po.status = r.return_type === "Cancel" ? "Dibatalkan" : "Retur";
            if (r.alasan && r.alasan !== "-") po.alasan_batal = r.alasan;
            if (r.tanggal_batal && r.tanggal_batal !== "-") po.tanggal_batal = r.tanggal_batal;
          }
        }
      }
    }

    writeData(data);
    emitEvent("retur_online_updated", { added, skipped });
    return NextResponse.json({ success: true, added, skipped });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Parameter id wajib diisi" }, { status: 400 });
    const data: any = readData();
    normalizeAndDedupe(data);
    const idx = data.retur_online.findIndex((r: any) => String(r.id) === String(id));
    if (idx === -1) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    const [removed] = data.retur_online.splice(idx, 1);
    writeData(data);
    emitEvent("retur_online_updated", { deletedId: id });
    return NextResponse.json({ success: true, removed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
