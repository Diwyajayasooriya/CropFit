'use client';

import React from 'react';
import Link from 'next/link';
import type { Alert } from '@/types';
import type { GreenNode } from '@/lib/api-functions';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { SparklesIcon, ChevronRightIcon } from '@/components/icons';

interface RecommendationCardProps {
  alerts?: Alert[];
  nodes?: GreenNode[];
  recommendation?: {
    title: string;
    description: string;
    actionLabel: string;
    actionUrl?: string;
  } | null;
}

export function RecommendationCard({
  alerts = [],
  nodes = [],
  recommendation,
}: RecommendationCardProps) {
  // If explicitly passed recommendation:
  let rec = recommendation;

  // Otherwise intelligently derive recommendation based on live alerts & sensor state:
  if (!rec) {
    const highTemp = alerts.find((a) =>
      a.title.toLowerCase().includes('temperature') || a.message.toLowerCase().includes('warm')
    );
    const lowMoisture = alerts.find((a) =>
      a.title.toLowerCase().includes('moisture') || a.message.toLowerCase().includes('dry')
    );
    const offlineNode = nodes.find((n) => !n.is_online);

    if (highTemp) {
      rec = {
        title: 'Your greenhouse is getting warmer.',
        description: 'Increase ventilation for approximately 20 minutes to maintain optimal crop climate.',
        actionLabel: 'Adjust Ventilation',
        actionUrl: '/devices',
      };
    } else if (lowMoisture) {
      rec = {
        title: 'Soil moisture is dropping below threshold.',
        description: 'Trigger water pump irrigation cycle or verify dripper line flow.',
        actionLabel: 'Start Irrigation',
        actionUrl: '/devices',
      };
    } else if (offlineNode) {
      rec = {
        title: 'GreenNode hub offline detected.',
        description: 'Inspect hub power adapter and WiFi connection in greenhouse sector.',
        actionLabel: 'Troubleshoot Hub',
        actionUrl: '/devices',
      };
    } else if (alerts.length > 0) {
      rec = {
        title: 'Unresolved greenhouse alerts detected.',
        description: `Review ${alerts.length} condition alert(s) requiring farmer attention.`,
        actionLabel: 'View Details',
        actionUrl: '/alerts',
      };
    }
  }

  return (
    <Card className="flex flex-col h-full bg-linear-to-b from-white to-emerald-50/30 border-slate-200/90 shadow-xs">
      <CardHeader className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
            <SparklesIcon size={16} />
          </div>
          <CardTitle className="text-base text-slate-900">CropFit Recommendation</CardTitle>
        </div>
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
          AI Advisory
        </span>
      </CardHeader>

      <CardContent className="pt-5 flex-1 flex flex-col justify-between">
        {rec ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {rec.title}
              </h4>
              <div className="mt-3 p-3.5 rounded-2xl bg-white border border-emerald-100/80 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                  Recommended:
                </span>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {rec.description}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link href={rec.actionUrl || '/automation'}>
                <Button variant="primary" className="w-full justify-between group">
                  <span>{rec.actionLabel}</span>
                  <ChevronRightIcon size={16} className="group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
              <SparklesIcon size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              No recommendation available right now.
            </p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              All crop conditions are running optimally according to current targets.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
