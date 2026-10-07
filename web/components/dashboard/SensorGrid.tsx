'use client';

import React from 'react';
import type { DashboardTile } from '@/types';
import { SensorTileCard, SensorCard, getSensorIcon } from './SensorCard';

interface SensorGridProps {
  tiles: DashboardTile[];
}

export function SensorGrid({ tiles }: SensorGridProps) {
  // If we have live tiles from the backend, map them
  if (tiles && tiles.length > 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {tiles.map((tile) => (
          <SensorTileCard key={tile.sensor_id} tile={tile} />
        ))}
      </div>
    );
  }

  // Graceful fallback cards representing the 4 core CropFit sensors awaiting data
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      <SensorCard
        label="Temperature"
        value={null}
        unit="°C"
        status="neutral"
        icon={getSensorIcon('temperature')}
        trend="stable"
      />
      <SensorCard
        label="Humidity"
        value={null}
        unit="%"
        status="neutral"
        icon={getSensorIcon('humidity')}
        trend="stable"
      />
      <SensorCard
        label="Soil Moisture"
        value={null}
        unit="%"
        status="neutral"
        icon={getSensorIcon('soil_moisture')}
        trend="stable"
      />
      <SensorCard
        label="CO₂ Level"
        value={null}
        unit="ppm"
        status="neutral"
        icon={getSensorIcon('co2')}
        trend="stable"
      />
    </div>
  );
}
