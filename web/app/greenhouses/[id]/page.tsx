import { GreenhouseDashboard } from '@/components/dashboard/GreenhouseDashboard';
export default async function GreenhousePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <GreenhouseDashboard greenhouseId={Number(id)} />; }
