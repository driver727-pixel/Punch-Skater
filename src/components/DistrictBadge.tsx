import type { WorldLocation } from "../lib/types";

interface DistrictBadgeProps {
  location: WorldLocation;
  showLabel?: boolean;
  size?: "sm" | "md";
  decorative?: boolean;
  className?: string;
}

function getLocationSlug(location: WorldLocation) {
  return location.toLowerCase().replace(/\s+/g, "-");
}

function DistrictBadgeIcon({ location }: { location: WorldLocation }) {
  switch (location) {
    case "Airaway":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 16h10a3 3 0 0 0 .3-6A5.4 5.4 0 0 0 7 9.4 3.3 3.3 0 0 0 7 16Z" />
          <path d="M12 7V4" />
          <path d="m10 6 2-2 2 2" />
        </svg>
      );
    case "Batteryville":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="7" width="12" height="10" rx="2" />
          <path d="M17 10h2v4h-2" />
          <path d="m11 9-2 4h2l-1 4 5-6h-2l1-2Z" />
        </svg>
      );
    case "The Grid":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="5" height="5" rx="1" />
          <rect x="10" y="4" width="5" height="5" rx="1" />
          <rect x="16" y="4" width="4" height="5" rx="1" />
          <rect x="4" y="10" width="5" height="5" rx="1" />
          <rect x="10" y="10" width="5" height="5" rx="1" />
          <rect x="16" y="10" width="4" height="5" rx="1" />
          <rect x="4" y="16" width="5" height="4" rx="1" />
          <rect x="10" y="16" width="5" height="4" rx="1" />
          <rect x="16" y="16" width="4" height="4" rx="1" />
        </svg>
      );
    case "Nightshade":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15.5 5.5a6.8 6.8 0 1 0 3.2 12.8A8 8 0 1 1 15.5 5.5Z" />
          <path d="m17.6 7.2.7 1.5 1.5.6-1.5.7-.7 1.5-.6-1.5-1.5-.7 1.5-.6Z" />
        </svg>
      );
    case "The Forest":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m8 5-3 5h2l-3 4h8l-3-4h2Z" />
          <path d="M8 14v5" />
          <path d="m16 7-2.5 4h1.5L13 14h6l-2-3h1.5Z" />
          <path d="M16 14v5" />
        </svg>
      );
    case "Glass City":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 19V9l5-2v12" />
          <path d="M9 19V5l6-2v16" />
          <path d="M15 19v-9l5-2v11" />
          <path d="M11 8h2M11 11h2M17 12h1.5M17 15h1.5M6 12h1.5M6 15h1.5" />
        </svg>
      );
    case "Electropolis":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 6 7v5c0 4 2.6 6.9 6 8 3.4-1.1 6-4 6-8V7Z" />
          <path d="M9 10h6M9 13h6M12 7v9" />
        </svg>
      );
    case "The Roads":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 19c0-4 2-6 2-10 0-1.6-.3-3.1-1-4" />
          <path d="M17 19c0-4-2-6-2-10 0-1.6.3-3.1 1-4" />
          <path d="M12 5v2M12 10v2M12 15v2" />
        </svg>
      );
    default:
      return null;
  }
}

export function DistrictBadge({
  location,
  showLabel = true,
  size = "md",
  decorative = false,
  className,
}: DistrictBadgeProps) {
  const classes = [
    "district-badge",
    `district-badge--${size}`,
    `district-badge--${getLocationSlug(location)}`,
    !showLabel ? "district-badge--icon-only" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} aria-hidden={decorative || undefined}>
      <span className="district-badge__icon-wrap">
        <DistrictBadgeIcon location={location} />
      </span>
      {showLabel && <span className="district-badge__label">{location}</span>}
    </span>
  );
}
