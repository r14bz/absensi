"use client";

import { useEffect } from "react";
import { useCamera } from "@/hooks/useCamera";
import { useGeolocation } from "@/hooks/useGeolocation";

/**
 * Gabungan kamera + GPS untuk absensi selfie.
 * Kamera & GPS dimulai PARALEL saat komponen dipasang (kamera otomatis di
 * dalam useCamera, GPS di effect di bawah) — tidak saling menunggu.
 */
export function useAttendanceCapture() {
  const camera = useCamera();
  const geo = useGeolocation();
  const { getCurrentPosition } = geo;

  useEffect(() => {
    void getCurrentPosition();
  }, [getCurrentPosition]);

  return {
    videoRef: camera.videoRef,
    canvasRef: camera.canvasRef,
    stream: camera.stream,
    cameraError: camera.error,
    isCameraSupported: camera.isSupported,
    isCameraStarting: camera.isStarting,
    facingMode: camera.facingMode,
    setFacingMode: camera.setFacingMode,
    startCamera: camera.start,
    stopCamera: camera.stop,
    capturePhoto: camera.capture,
    position: geo.position,
    geoError: geo.error,
    isGeoSupported: geo.isSupported,
    isGeoLoading: geo.isLoading,
    getCurrentPosition,
  };
}
