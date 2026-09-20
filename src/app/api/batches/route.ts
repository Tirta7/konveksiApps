import { NextRequest, NextResponse } from "next/server";
import { readData, writeData, nextId } from "@/lib/data-store";
import crypto from "crypto";

export async function GET() {
  const data = readData();
  return NextResponse.json(data.batches.slice().reverse());
}

export async function POST(req: NextRequest) {
  const data = readData();
  const { jenisCain, jumlahMeter, jumlahPcs } = await req.json();
  const id = nextId(data, "batches");
  const token = crypto.randomUUID();
  const kodeBatch = `BATCH-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`;
  const now = new Date().toISOString();
  
  const newBatch = { id, kodeBatch, jenisKain: jenisCain, jumlahMeter, jumlahPcs, status: "bahan-mentah", token, createdAt: now };
  data.batches.push(newBatch);
  writeData(data);
  
  return NextResponse.json(newBatch);
}
