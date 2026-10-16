import VendorPortal from "@/components/VendorPortal";

export default function FinishingPortalPage({ params }: { params: Promise<{ id: string }> }) {
  return <VendorPortal params={params} defaultTipe="finishing" />;
}
