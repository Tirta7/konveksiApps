import VendorGate from "@/components/VendorGate";

export default async function CMTPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  // Portal wajib login vendor (Kode Vendor + password); owner/admin bisa pratinjau
  return <VendorGate vendorId={resolved.id} defaultTipe="cmt" />;
}
