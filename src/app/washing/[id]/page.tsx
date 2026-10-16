import VendorPortal from "@/components/VendorPortal";

export default function WashingPortalPage({ params }: { params: Promise<{ id: string }> }) {
  return <VendorPortal params={params} defaultTipe="washing" />;
}
