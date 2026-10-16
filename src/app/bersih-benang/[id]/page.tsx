import VendorPortal from "@/components/VendorPortal";

export default function BersihBenangPortalPage({ params }: { params: Promise<{ id: string }> }) {
  return <VendorPortal params={params} defaultTipe="benang" />;
}
