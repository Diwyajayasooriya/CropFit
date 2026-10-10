"use client";
import { apiFetch } from '@/lib/api';
import { getGreenhouses, getNodes } from '@/lib/api-functions';
import { useResource } from '@/hooks/use-resource';
import { Topbar } from '@/components/layout/Topbar';
import { ResourceState } from '@/components/resource-state';
import { GreenhouseForm } from '@/components/greenhouse-form';
import { GreenNodeStatus } from '@/components/dashboard/DashboardPanels';
import type { User } from '@/types';
const loadSettings = async () => { const [user,greenhouses,nodes] = await Promise.all([apiFetch.get<User>('/auth/me/'),getGreenhouses(),getNodes()]); return {user,greenhouses,nodes}; };
export default function SettingsPage() {
 const resource = useResource(loadSettings);
 return <><Topbar onRefresh={resource.reload} /><div className="page-content"><h2 className="text-2xl font-bold">Settings</h2><ResourceState {...resource} retry={resource.reload} />{resource.data && <><section className="panel"><h3 className="font-semibold mb-3">Account</h3><p>{resource.data.user.first_name} {resource.data.user.last_name}</p><p>{resource.data.user.email}</p><p className="capitalize">{resource.data.user.role}</p><p className="text-sm text-slate-500 mt-3">Contact your administrator to change your account details.</p></section>{resource.data.greenhouses.map(g => <GreenhouseForm key={g.id} greenhouse={g} onSaved={resource.reload} />)}{!resource.data.greenhouses.length && <GreenhouseForm onSaved={resource.reload} />}<GreenNodeStatus nodes={resource.data.nodes} /><section className="panel"><h3 className="font-semibold">Notifications</h3><p className="text-slate-500 mt-2">Greenhouse notifications are available in Alerts. Email and push notification preferences are not yet supported.</p></section></>}</div></>;
}
