/**
 * Dipanggil sekali saat server Next.js mulai.
 * Menyalakan sinkron berkala pesanan marketplace (hanya di runtime Node.js).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMarketplaceScheduler } = await import("./lib/marketplace-api/sync");
    startMarketplaceScheduler();
  }
}
