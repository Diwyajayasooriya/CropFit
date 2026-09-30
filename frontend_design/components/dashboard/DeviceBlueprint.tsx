"use client";

/**
 * GreenNode device rendered as a compact technical blueprint / engineering schematic.
 * Compact height to prioritize telemetry and device cards below.
 * White line-art on near-black background with soft outer glow and grid texture.
 */
export default function DeviceBlueprint() {
  return (
    <div className="relative w-full h-24 sm:h-28 rounded-xl bg-[#060908] overflow-hidden border border-gn-text-dim/10 flex items-center justify-center shadow-inner">
      {/* Faint grid texture */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="blueprint-grid-compact"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 16 0 L 0 0 0 16"
              fill="none"
              stroke="#E8E6E3"
              strokeWidth="0.25"
              strokeOpacity="0.04"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#blueprint-grid-compact)" />
      </svg>

      {/* Blueprint SVG - Compact view */}
      <svg
        viewBox="60 30 200 135"
        fill="none"
        className="relative z-10 h-full max-h-24 sm:max-h-28 drop-shadow-[0_0_6px_rgba(232,230,227,0.15)]"
        style={{ filter: "drop-shadow(0 0 4px rgba(232,230,227,0.2))" }}
      >
        {/* Main body outline */}
        <rect
          x="85"
          y="72"
          width="150"
          height="65"
          rx="10"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="1.2"
          strokeOpacity="0.85"
        />

        {/* Inner panel line */}
        <rect
          x="93"
          y="78"
          width="134"
          height="53"
          rx="5"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="0.5"
          strokeOpacity="0.25"
          strokeDasharray="3 2"
        />

        {/* Top panel surface line */}
        <line
          x1="90"
          y1="70"
          x2="230"
          y2="70"
          stroke="#E8E6E3"
          strokeWidth="0.8"
          strokeOpacity="0.4"
        />

        {/* Antenna Left */}
        <line
          x1="125"
          y1="72"
          x2="114"
          y2="38"
          stroke="#E8E6E3"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.8"
        />
        <circle
          cx="114"
          cy="36"
          r="3"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="1"
          strokeOpacity="0.9"
        />
        <circle cx="114" cy="36" r="1.2" fill="#E8E6E3" fillOpacity="0.6" />

        {/* Antenna Right */}
        <line
          x1="195"
          y1="72"
          x2="206"
          y2="38"
          stroke="#E8E6E3"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.8"
        />
        <circle
          cx="206"
          cy="36"
          r="3"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="1"
          strokeOpacity="0.9"
        />
        <circle cx="206" cy="36" r="1.2" fill="#E8E6E3" fillOpacity="0.6" />

        {/* Power LED */}
        <circle
          cx="106"
          cy="95"
          r="3.5"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />
        <circle cx="106" cy="95" r="1.5" fill="#2D8F5E" fillOpacity="0.8" />

        {/* Status LED */}
        <circle
          cx="120"
          cy="95"
          r="2.5"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />

        {/* Label inside device */}
        <text
          x="160"
          y="98"
          textAnchor="middle"
          fill="#E8E6E3"
          fillOpacity="0.7"
          fontSize="7"
          fontFamily="Space Grotesk, monospace"
          fontWeight="600"
          letterSpacing="1.5"
        >
          GREENNODE MINI
        </text>

        {/* Sensor ports */}
        <rect
          x="98"
          y="118"
          width="11"
          height="7"
          rx="1"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="0.7"
          strokeOpacity="0.5"
        />
        <rect
          x="113"
          y="118"
          width="11"
          height="7"
          rx="1"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="0.7"
          strokeOpacity="0.35"
        />
        <rect
          x="128"
          y="118"
          width="11"
          height="7"
          rx="1"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="0.7"
          strokeOpacity="0.35"
        />

        {/* Actuator ports */}
        <rect
          x="180"
          y="118"
          width="11"
          height="7"
          rx="1"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="0.7"
          strokeOpacity="0.5"
        />
        <rect
          x="195"
          y="118"
          width="11"
          height="7"
          rx="1"
          fill="none"
          stroke="#E8E6E3"
          strokeWidth="0.7"
          strokeOpacity="0.35"
        />

        {/* Bottom edge tech spec tag */}
        <text
          x="160"
          y="152"
          textAnchor="middle"
          fill="#E8E6E3"
          fillOpacity="0.25"
          fontSize="6"
          fontFamily="monospace"
          letterSpacing="2"
        >
          EDGE AI ARCHITECTURE • REV 1.2
        </text>
      </svg>
    </div>
  );
}
