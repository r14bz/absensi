"use client";
/* eslint-disable @next/next/no-img-element */

import { memo, useMemo } from "react";
import { MAP_WINDOW, MARKER_RADIUS, TILE_SIZE, accuracyRadiusPx, planTiles } from "@/lib/gps-stamp/staticMap";

const SIZE = 96; // ukuran tampil (px CSS); jendela peta MAP_WINDOW diperkecil agar sama dengan foto hasil
const C = MAP_WINDOW / 2;

/** Peta kecil pada overlay stempel langsung. Tile sama dengan yang dipakai saat foto diambil. */
export const MapThumb = memo(function MapThumb({
  latitude,
  longitude,
  accuracy,
}: {
  latitude: number;
  longitude: number;
  accuracy: number;
}) {
  const tiles = useMemo(() => planTiles(latitude, longitude), [latitude, longitude]);
  const r = accuracyRadiusPx(latitude, accuracy);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl border-2 border-white/90 bg-zinc-700 shadow-lg"
      style={{ width: SIZE, height: SIZE }}
      aria-hidden="true"
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: MAP_WINDOW,
          height: MAP_WINDOW,
          transform: `scale(${SIZE / MAP_WINDOW})`,
          transformOrigin: "0 0",
        }}
      >
        {tiles.map((t) => (
          <img
            key={t.url}
            src={t.url}
            alt=""
            crossOrigin="anonymous"
            draggable={false}
            style={{ position: "absolute", left: t.dx, top: t.dy, width: TILE_SIZE, height: TILE_SIZE, maxWidth: "none" }}
          />
        ))}
        {r >= 6 && (
          <div
            style={{
              position: "absolute",
              left: C - r,
              top: C - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              background: "rgba(56,189,248,0.25)",
              border: "2px solid rgba(56,189,248,0.85)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            left: C - MARKER_RADIUS,
            top: C - MARKER_RADIUS,
            width: MARKER_RADIUS * 2,
            height: MARKER_RADIUS * 2,
            borderRadius: "50%",
            background: "#ef4444",
            border: "3px solid #fff",
            boxSizing: "border-box",
          }}
        />
      </div>
      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[7px] leading-[11px] text-zinc-700">© OpenStreetMap</span>
    </div>
  );
});
