import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  const nets = os.networkInterfaces();
  let localIp = "127.0.0.1";

  for (const name of Object.keys(nets)) {
    const interfaces = nets[name];
    if (!interfaces) continue;
    for (const net of interfaces) {
      if (net.family === "IPv4" && !net.internal) {
        // Prioritaskan IP lokal (192.168.x.x atau 10.x.x.x)
        if (net.address.startsWith("192.168.") || net.address.startsWith("10.") || net.address.startsWith("172.")) {
          localIp = net.address;
        } else if (localIp === "127.0.0.1") {
          localIp = net.address;
        }
      }
    }
  }

  return NextResponse.json({ ip: localIp });
}
