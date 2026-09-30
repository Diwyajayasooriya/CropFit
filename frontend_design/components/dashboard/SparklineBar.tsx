"use client";

import { motion } from "framer-motion";

interface SparklineBarProps {
  data: number[];
  height?: number;
  className?: string;
}

export default function SparklineBar({
  data,
  height = 40,
  className = "",
}: SparklineBarProps) {
  if (!data.length) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const barWidth = 100 / data.length;
  const gap = barWidth * 0.25;

  return (
    <motion.svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      {data.map((value, i) => {
        const normalizedHeight = ((value - min) / range) * (height * 0.85) + height * 0.1;
        const isLast = i === data.length - 1;
        const x = i * barWidth + gap / 2;
        const w = barWidth - gap;

        return (
          <motion.rect
            key={i}
            x={x}
            y={height - normalizedHeight}
            width={Math.max(w, 0.5)}
            height={normalizedHeight}
            rx={1}
            fill={isLast ? "#2D8F5E" : "#1B5E3B"}
            fillOpacity={isLast ? 0.9 : 0.45}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{
              duration: 0.4,
              delay: i * 0.03,
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{ transformOrigin: `${x}px ${height}px` }}
          />
        );
      })}
    </motion.svg>
  );
}
