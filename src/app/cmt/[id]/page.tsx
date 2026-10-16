import VendorPortal from "@/components/VendorPortal";

export default function CMTPortalPage({ params }: { params: Promise<{ id: string }> }) {
  return <VendorPortal params={params} defaultTipe="cmt" />;
}
