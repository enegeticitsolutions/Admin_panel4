import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Crop,
  Check,
  Maximize2,
  Building2,
  User,
  Sparkles,
  Move,
  RefreshCw,
  AlertCircle,
  Loader2,
  Sliders,
} from 'lucide-react';
import { API_BASE } from '../../../services/api';

export interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  aspectRatio?: number; // optional initial ratio, default null (freeform)
  title?: string;
  targetWidth?: number; // default 1200
  targetHeight?: number; // default 675
  onCropComplete: (croppedFile: File, previewUrl: string) => void;
  onCancel: () => void;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

type AspectRatioMode = 'free' | '16:9' | '1:1' | '4:3';

type ExportMode = 'card_16_9' | 'exact_crop';

export function ImageCropperModal({
  isOpen,
  imageSrc,
  title = 'Crop & Frame Partner Image',
  targetWidth = 1200,
  targetHeight = 675,
  onCropComplete,
  onCancel,
}: ImageCropperModalProps) {
  // Safe resolved image URL (blob or data URL) to avoid CORS/broken image
  const [safeImageSrc, setSafeImageSrc] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Natural dimensions of the image
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Cropper box state (in display pixels relative to the image)
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [aspectRatioMode, setAspectRatioMode] = useState<AspectRatioMode>('free');
  const [exportMode, setExportMode] = useState<ExportMode>('card_16_9');
  const [bgColor, setBgColor] = useState<string>('#FFFFFF');
  const [rotation, setRotation] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    initialCrop: CropRect;
    handle: DragHandle;
  } | null>(null);

  // ─── 1. Load image safely into local Blob URL (solves CORS & broken image icon) ───
  useEffect(() => {
    if (!isOpen || !imageSrc) {
      setSafeImageSrc(null);
      return;
    }

    let isMounted = true;
    let createdBlobUrl: string | null = null;

    const loadSafeImage = async () => {
      setIsLoadingImage(true);
      setLoadError(null);
      setRotation(0);
      setZoom(1);

      // A. If already data URL or blob URL, use directly
      if (imageSrc.startsWith('data:') || imageSrc.startsWith('blob:')) {
        if (isMounted) {
          setSafeImageSrc(imageSrc);
          setIsLoadingImage(false);
        }
        return;
      }

      // B. Try direct fetch
      try {
        const directRes = await fetch(imageSrc, { mode: 'cors' });
        if (directRes.ok) {
          const blob = await directRes.blob();
          createdBlobUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setSafeImageSrc(createdBlobUrl);
            setIsLoadingImage(false);
          }
          return;
        }
      } catch (directErr) {
        // Direct fetch failed (likely CORS), fall through to backend proxy
      }

      // C. Fallback: load via backend proxy endpoint (/api/partners/proxy-image)
      try {
        const proxyUrl = `${API_BASE}/partners/proxy-image?url=${encodeURIComponent(imageSrc)}`;
        const proxyRes = await fetch(proxyUrl);
        if (proxyRes.ok) {
          const blob = await proxyRes.blob();
          createdBlobUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setSafeImageSrc(createdBlobUrl);
            setIsLoadingImage(false);
          }
          return;
        }
      } catch (proxyErr) {
        console.warn('Backend proxy image fetch error:', proxyErr);
      }

      // D. Final fallback: raw source
      if (isMounted) {
        setSafeImageSrc(imageSrc);
        setIsLoadingImage(false);
      }
    };

    loadSafeImage();

    return () => {
      isMounted = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [isOpen, imageSrc]);

  // ─── 2. Handle Image Rendered in DOM ───
  const handleImageLoaded = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const nw = img.naturalWidth || 800;
    const nh = img.naturalHeight || 600;
    const dw = img.clientWidth || 500;
    const dh = img.clientHeight || 300;

    setNaturalSize({ width: nw, height: nh });
    setDisplaySize({ width: dw, height: dh });

    // Initialize crop box to 90% centered
    const initW = Math.round(dw * 0.9);
    const initH = Math.round(dh * 0.9);
    const initX = Math.round((dw - initW) / 2);
    const initY = Math.round((dh - initH) / 2);

    setCrop({
      x: Math.max(0, initX),
      y: Math.max(0, initY),
      width: initW,
      height: initH,
    });
    setIsLoadingImage(false);
  };

  // ─── 3. Pointer Dragging from Every Handle (Window-level listener for reliability) ───
  const handlePointerDown = (
    e: React.PointerEvent,
    handle: DragHandle
  ) => {
    e.preventDefault();
    e.stopPropagation();

    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: { ...crop },
      handle,
    };
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current || !imgRef.current) return;

      const { startX, startY, initialCrop, handle } = dragStateRef.current;
      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;

      const dw = displaySize.width;
      const dh = displaySize.height;
      if (dw <= 0 || dh <= 0) return;

      const minSize = 24; // minimum 24px width/height

      let { x, y, width, height } = initialCrop;

      if (handle === 'move') {
        x = Math.max(0, Math.min(dw - width, initialCrop.x + dx));
        y = Math.max(0, Math.min(dh - height, initialCrop.y + dy));
      } else {
        // Adjust horizontal bounds
        if (handle.includes('e')) {
          width = Math.max(minSize, Math.min(dw - x, initialCrop.width + dx));
        }
        if (handle.includes('w')) {
          const maxLeft = initialCrop.x + initialCrop.width - minSize;
          const newX = Math.max(0, Math.min(maxLeft, initialCrop.x + dx));
          width = initialCrop.width - (newX - initialCrop.x);
          x = newX;
        }

        // Adjust vertical bounds
        if (handle.includes('s')) {
          height = Math.max(minSize, Math.min(dh - y, initialCrop.height + dy));
        }
        if (handle.includes('n')) {
          const maxTop = initialCrop.y + initialCrop.height - minSize;
          const newY = Math.max(0, Math.min(maxTop, initialCrop.y + dy));
          height = initialCrop.height - (newY - initialCrop.y);
          y = newY;
        }

        // Apply aspect ratio lock if active
        let targetRatio: number | null = null;
        if (aspectRatioMode === '16:9') targetRatio = 16 / 9;
        if (aspectRatioMode === '1:1') targetRatio = 1;
        if (aspectRatioMode === '4:3') targetRatio = 4 / 3;

        if (targetRatio) {
          if (handle === 'e' || handle === 'w') {
            height = Math.max(minSize, Math.min(dh - y, width / targetRatio));
            width = height * targetRatio;
          } else if (handle === 'n' || handle === 's') {
            width = Math.max(minSize, Math.min(dw - x, height * targetRatio));
            height = width / targetRatio;
          } else {
            // Corners: clamp to ratio
            const currentRatio = width / height;
            if (currentRatio > targetRatio) {
              width = height * targetRatio;
            } else {
              height = width / targetRatio;
            }
          }
        }
      }

      setCrop({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [displaySize, zoom, aspectRatioMode, crop]);

  // ─── 4. Preset Aspect Ratio Adjuster ───
  const applyAspectRatio = (mode: AspectRatioMode) => {
    setAspectRatioMode(mode);
    const dw = displaySize.width;
    const dh = displaySize.height;
    if (dw <= 0 || dh <= 0) return;

    if (mode === 'free') {
      return; // Keep current box, allow free drag
    }

    let targetRatio = 16 / 9;
    if (mode === '1:1') targetRatio = 1;
    if (mode === '4:3') targetRatio = 4 / 3;

    let newW = dw * 0.85;
    let newH = newW / targetRatio;

    if (newH > dh * 0.85) {
      newH = dh * 0.85;
      newW = newH * targetRatio;
    }

    const newX = (dw - newW) / 2;
    const newY = (dh - newH) / 2;

    setCrop({
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.round(newW),
      height: Math.round(newH),
    });
  };

  // ─── 5. Quick Helpers (Fit Logo, Reset, Center) ───
  const handleFitEntireLogo = () => {
    // Select the whole image and set export mode to 16:9 card with white background
    const dw = displaySize.width;
    const dh = displaySize.height;
    setCrop({ x: 0, y: 0, width: dw, height: dh });
    setAspectRatioMode('free');
    setExportMode('card_16_9');
    setBgColor('#FFFFFF');
  };

  const handleReset = () => {
    const dw = displaySize.width;
    const dh = displaySize.height;
    setCrop({ x: 0, y: 0, width: dw, height: dh });
    setRotation(0);
    setZoom(1);
    setAspectRatioMode('free');
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // ─── 6. Confirm and Export Cropped Image to High-Res Blob ───
  const handleConfirmCrop = useCallback(async () => {
    if (!imgRef.current || displaySize.width <= 0 || displaySize.height <= 0) return;
    setIsProcessing(true);

    try {
      const imgEl = imgRef.current;

      // Create an intermediate canvas to render rotated image if needed
      let sourceCanvas: HTMLCanvasElement | HTMLImageElement = imgEl;
      let sWidth = imgEl.naturalWidth;
      let sHeight = imgEl.naturalHeight;

      if (rotation !== 0) {
        const rotCanvas = document.createElement('canvas');
        const rotCtx = rotCanvas.getContext('2d');
        if (rotation === 90 || rotation === 270) {
          rotCanvas.width = sHeight;
          rotCanvas.height = sWidth;
        } else {
          rotCanvas.width = sWidth;
          rotCanvas.height = sHeight;
        }

        if (rotCtx) {
          rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
          rotCtx.rotate((rotation * Math.PI) / 180);
          rotCtx.drawImage(imgEl, -sWidth / 2, -sHeight / 2);
          sourceCanvas = rotCanvas;
          sWidth = rotCanvas.width;
          sHeight = rotCanvas.height;
        }
      }

      // Calculate source image crop coordinates
      const scaleX = sWidth / displaySize.width;
      const scaleY = sHeight / displaySize.height;

      const cropX = Math.max(0, Math.round(crop.x * scaleX));
      const cropY = Math.max(0, Math.round(crop.y * scaleY));
      const cropW = Math.min(sWidth - cropX, Math.round(crop.width * scaleX));
      const cropH = Math.min(sHeight - cropY, Math.round(crop.height * scaleY));

      if (cropW <= 0 || cropH <= 0) {
        throw new Error('Invalid crop dimensions.');
      }

      // Final canvas
      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) throw new Error('Could not initialize canvas context.');

      if (exportMode === 'card_16_9') {
        // Output standard 16:9 card banner (1200 x 675)
        finalCanvas.width = targetWidth;
        finalCanvas.height = targetHeight;

        // Fill background color
        finalCtx.fillStyle = bgColor;
        finalCtx.fillRect(0, 0, targetWidth, targetHeight);

        // If cropped area is already roughly 16:9, fill edge-to-edge
        const cropAspect = cropW / cropH;
        const targetAspect = targetWidth / targetHeight; // 1.777

        if (Math.abs(cropAspect - targetAspect) < 0.05) {
          // Exact full banner coverage
          finalCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, targetWidth, targetHeight);
        } else {
          // Fit comfortably inside the card with clean margins (ideal for Company Logo & Doctor Headshots)
          const padding = 24;
          const availW = targetWidth - padding * 2;
          const availH = targetHeight - padding * 2;
          const fitScale = Math.min(availW / cropW, availH / cropH);

          const destW = Math.round(cropW * fitScale);
          const destH = Math.round(cropH * fitScale);
          const destX = Math.round((targetWidth - destW) / 2);
          const destY = Math.round((targetHeight - destH) / 2);

          finalCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, destX, destY, destW, destH);
        }
      } else {
        // Exact crop mode: output the exact cropped rectangle
        finalCanvas.width = cropW;
        finalCanvas.height = cropH;
        finalCtx.fillStyle = bgColor;
        finalCtx.fillRect(0, 0, cropW, cropH);
        finalCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      }

      // Convert to blob and trigger callback
      finalCanvas.toBlob(
        (blob) => {
          setIsProcessing(false);
          if (!blob) {
            alert('Failed to generate cropped image.');
            return;
          }
          const croppedFile = new File([blob], `partner-image-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          const previewUrl = URL.createObjectURL(blob);
          onCropComplete(croppedFile, previewUrl);
        },
        'image/jpeg',
        0.92
      );
    } catch (err: any) {
      console.error('Cropping error:', err);
      alert(err.message || 'Error occurred while processing cropped image.');
      setIsProcessing(false);
    }
  }, [displaySize, crop, rotation, exportMode, bgColor, targetWidth, targetHeight, onCropComplete]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-gray-200">
        {/* ── Header ── */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Crop className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">
                Drag any of the 8 handles to manually crop from every side &bull; Perfect for Company Logos &amp; People Headshots
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Top Presets & Mode Selector ── */}
        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Aspect Ratio Tabs */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-600 mr-1 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-gray-400" /> Mode:
            </span>
            <button
              type="button"
              onClick={() => applyAspectRatio('free')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                aspectRatioMode === 'free'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
              title="Manual crop freely from every side"
            >
              Manual / Freeform
            </button>
            <button
              type="button"
              onClick={() => applyAspectRatio('16:9')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                aspectRatioMode === '16:9'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
              title="Standard Website Card Banner (16:9)"
            >
              16:9 Banner
            </button>
            <button
              type="button"
              onClick={() => applyAspectRatio('1:1')}
              className={`px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${
                aspectRatioMode === '1:1'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
              title="Square - ideal for Doctors / Person Headshots"
            >
              <User className="w-3 h-3" /> 1:1 Doctor / Person
            </button>
            <button
              type="button"
              onClick={() => applyAspectRatio('4:3')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                aspectRatioMode === '4:3'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              4:3 Photo
            </button>
          </div>

          {/* Quick Helper: Fit Whole Logo on Card */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFitEntireLogo}
              className="px-2.5 py-1 bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 rounded-md font-semibold flex items-center gap-1 transition shadow-xs"
              title="Center full logo on clean white 16:9 card (prevents cutting text)"
            >
              <Building2 className="w-3.5 h-3.5" />
              Fit Company Logo on White Card
            </button>
            <button
              type="button"
              onClick={handleRotate}
              className="p-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md transition"
              title="Rotate 90° Clockwise"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md transition"
              title="Reset Crop to Whole Image"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Main Workspace Area (The Image & 8-Handle Crop Box) ── */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-[380px] max-h-[560px] bg-[#0B0F19] flex items-center justify-center overflow-hidden p-4 select-none"
        >
          {isLoadingImage ? (
            <div className="flex flex-col items-center justify-center text-white/80 py-16 gap-3">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              <p className="text-xs font-medium">Loading and securing image stream...</p>
            </div>
          ) : loadError ? (
            <div className="text-center text-rose-300 py-12 px-4 max-w-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
              <p className="text-xs font-semibold">{loadError}</p>
            </div>
          ) : (
            <div
              className="relative inline-block transition-transform duration-75"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
            >
              {/* The underlying Image */}
              <img
                ref={imgRef}
                src={safeImageSrc || ''}
                alt="Crop Target"
                onLoad={handleImageLoaded}
                draggable={false}
                crossOrigin="anonymous"
                className="max-h-[460px] max-w-full object-contain block rounded-sm pointer-events-none shadow-2xl"
              />

              {/* ── 8-HANDLE MANUAL CROP BOX OVERLAY ── */}
              {displaySize.width > 0 && displaySize.height > 0 && crop.width > 0 && (
                <>
                  {/* Shaded backdrop mask outside the crop box */}
                  <div
                    className="absolute bg-black/60 pointer-events-none"
                    style={{ top: 0, left: 0, right: 0, height: `${crop.y}px` }}
                  />
                  <div
                    className="absolute bg-black/60 pointer-events-none"
                    style={{
                      top: `${crop.y + crop.height}px`,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  />
                  <div
                    className="absolute bg-black/60 pointer-events-none"
                    style={{
                      top: `${crop.y}px`,
                      left: 0,
                      width: `${crop.x}px`,
                      height: `${crop.height}px`,
                    }}
                  />
                  <div
                    className="absolute bg-black/60 pointer-events-none"
                    style={{
                      top: `${crop.y}px`,
                      left: `${crop.x + crop.width}px`,
                      right: 0,
                      height: `${crop.height}px`,
                    }}
                  />

                  {/* The Active Crop Selection Box */}
                  <div
                    className="absolute border-2 border-[#FE6700] shadow-[0_0_0_1px_rgba(255,255,255,0.4)] cursor-move transition-[box-shadow]"
                    style={{
                      left: `${crop.x}px`,
                      top: `${crop.y}px`,
                      width: `${crop.width}px`,
                      height: `${crop.height}px`,
                    }}
                    onPointerDown={(e) => handlePointerDown(e, 'move')}
                  >
                    {/* Rule of Thirds 3x3 Grid */}
                    <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
                      <div className="border-r border-b border-white/20" />
                      <div className="border-r border-b border-white/20" />
                      <div className="border-b border-white/20" />
                      <div className="border-r border-b border-white/20" />
                      <div className="border-r border-b border-white/20" />
                      <div className="border-b border-white/20" />
                      <div className="border-r border-b border-white/20" />
                      <div className="border-r border-b border-white/20" />
                      <div />
                    </div>

                    {/* Dimensions Pill Badge */}
                    <div className="absolute bottom-1.5 left-1.5 bg-black/75 backdrop-blur-md text-white text-[9.5px] font-semibold px-1.5 py-0.5 rounded pointer-events-none flex items-center gap-1 shadow">
                      <span>
                        {Math.round((crop.width / displaySize.width) * naturalSize.width)} ×{' '}
                        {Math.round((crop.height / displaySize.height) * naturalSize.height)}px
                      </span>
                    </div>

                    {/* ── 4 EDGE HANDLES (N, S, E, W) ── */}
                    {/* Top Edge Handle */}
                    <div
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border border-[#FE6700] rounded-full cursor-ns-resize shadow-md hover:scale-110 active:scale-95 transition-transform"
                      onPointerDown={(e) => handlePointerDown(e, 'n')}
                      title="Drag top edge"
                    />
                    {/* Bottom Edge Handle */}
                    <div
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border border-[#FE6700] rounded-full cursor-ns-resize shadow-md hover:scale-110 active:scale-95 transition-transform"
                      onPointerDown={(e) => handlePointerDown(e, 's')}
                      title="Drag bottom edge"
                    />
                    {/* Left Edge Handle */}
                    <div
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 bg-white border border-[#FE6700] rounded-full cursor-ew-resize shadow-md hover:scale-110 active:scale-95 transition-transform"
                      onPointerDown={(e) => handlePointerDown(e, 'w')}
                      title="Drag left edge"
                    />
                    {/* Right Edge Handle */}
                    <div
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-white border border-[#FE6700] rounded-full cursor-ew-resize shadow-md hover:scale-110 active:scale-95 transition-transform"
                      onPointerDown={(e) => handlePointerDown(e, 'e')}
                      title="Drag right edge"
                    />

                    {/* ── 4 CORNER HANDLES (NW, NE, SW, SE) ── */}
                    {/* Top-Left Corner */}
                    <div
                      className="absolute -top-2 -left-2 w-4 h-4 bg-[#FE6700] border-2 border-white rounded-full cursor-nwse-resize shadow-lg hover:scale-125 active:scale-95 transition-transform"
                      onPointerDown={(e) => handlePointerDown(e, 'nw')}
                      title="Drag top-left corner"
                    />
                    {/* Top-Right Corner */}
                    <div
                      className="absolute -top-2 -right-2 w-4 h-4 bg-[#FE6700] border-2 border-white rounded-full cursor-nesw-resize shadow-lg hover:scale-125 active:scale-95 transition-transform"
                      onPointerDown={(e) => handlePointerDown(e, 'ne')}
                      title="Drag top-right corner"
                    />
                    {/* Bottom-Left Corner */}
                    <div
                      className="absolute -bottom-2 -left-2 w-4 h-4 bg-[#FE6700] border-2 border-white rounded-full cursor-nesw-resize shadow-lg hover:scale-125 active:scale-95 transition-transform"
                      onPointerDown={(e) => handlePointerDown(e, 'sw')}
                      title="Drag bottom-left corner"
                    />
                    {/* Bottom-Right Corner */}
                    <div
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#FE6700] border-2 border-white rounded-full cursor-nwse-resize shadow-lg hover:scale-125 active:scale-95 transition-transform"
                      onPointerDown={(e) => handlePointerDown(e, 'se')}
                      title="Drag bottom-right corner"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom Controls Toolbar ── */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Zoom & Card Options */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Zoom Slider */}
            <div className="flex items-center gap-2">
              <ZoomOut className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-24 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FE6700]"
                title="Zoom view"
              />
              <ZoomIn className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] text-gray-400 w-8">{Math.round(zoom * 100)}%</span>
            </div>

            <div className="h-4 w-px bg-gray-300 hidden sm:block" />

            {/* Output Card Mode Toggle */}
            <div className="flex items-center gap-1.5 text-xs">
              <label className="text-gray-600 font-semibold">Format:</label>
              <select
                value={exportMode}
                onChange={(e) => setExportMode(e.target.value as ExportMode)}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded-md font-medium focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                <option value="card_16_9">16:9 Card Banner (Recommended for Website)</option>
                <option value="exact_crop">Exact Crop Selection</option>
              </select>
            </div>

            {/* Card Background Color Selector */}
            {exportMode === 'card_16_9' && (
              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-gray-600 font-semibold">Card BG:</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBgColor('#FFFFFF')}
                    className={`w-5 h-5 rounded-full border-2 transition ${
                      bgColor === '#FFFFFF' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-300'
                    } bg-white`}
                    title="Pure White (Recommended for Logos)"
                  />
                  <button
                    type="button"
                    onClick={() => setBgColor('#F8FAFC')}
                    className={`w-5 h-5 rounded-full border-2 transition ${
                      bgColor === '#F8FAFC' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-300'
                    } bg-slate-50`}
                    title="Soft Off-White"
                  />
                  <button
                    type="button"
                    onClick={() => setBgColor('#0F172A')}
                    className={`w-5 h-5 rounded-full border-2 transition ${
                      bgColor === '#0F172A' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-300'
                    } bg-slate-900`}
                    title="Dark Slate"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmCrop}
              disabled={isProcessing || isLoadingImage}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#FE6700] to-[#E05300] hover:from-[#E05300] hover:to-[#C94700] rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating Crop...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save &amp; Apply Crop
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageCropperModal;
