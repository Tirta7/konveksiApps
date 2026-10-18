import VendorPortal from "@/components/VendorPortal";

export default async function BenangPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  return <VendorPortal vendorId={resolved.id} defaultTipe="benang" />;
}
