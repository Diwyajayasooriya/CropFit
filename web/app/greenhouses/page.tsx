"use client";
import Link from 'next/link';
import { getGreenhouses } from '@/lib/api-functions';
import { useResource } from '@/hooks/use-resource';
import { Topbar } from '@/components/layout/Topbar';
import { ResourceState } from '@/components/resource-state';
import { GreenhouseForm } from '@/components/greenhouse-form';
export default function GreenhousesPage() {
 const resource = useResource(getGreenhouses);
 return <><Topbar onRefresh={resource.reload} /><div className="page-content"><h2 className="text-2xl font-bold">My greenhouses</h2><ResourceState {...resource} retry={resource.reload} />{resource.data?.length === 0 && <p>No greenhouses yet. Create one below to start monitoring.</p>}<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{resource.data?.map(g => <Link href={`/greenhouses/${g.id}`} key={g.id} className="panel hover:border-emerald-400"><h3 className="text-lg font-semibold">{g.name}</h3><p className="text-slate-500">{g.crop} / {g.location}</p><p className="mt-4 text-sm">{g.node_count} connected hub(s)</p>{g.plantation_date && <p className="text-sm text-slate-500">Planted {g.plantation_date}</p>}</Link>)}</div><GreenhouseForm onSaved={resource.reload} /></div></>;
}
