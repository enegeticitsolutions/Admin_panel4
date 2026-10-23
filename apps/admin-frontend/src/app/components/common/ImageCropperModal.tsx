import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crop,
  Check,
  Maximize2,
  Sparkles,
} from 'lucide-react';

export interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  aspectRatio?: number; // default 16 / 9
  title?: string;
  targetWidth?: number; // default 1200
  targetHeight?: number; // default 675
  onCropComplete: (croppedFile: File, previewUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropperModal({
  isOpen,
  imageSrc,
  aspectRatio = 16 / 9,
  title = 'Crop & Frame Partner Cover (16:9 Mandated Ratio)',
  targetWidth = 1200,
  targetHeight = 675,
  onCropComplete,
  onCancel,
}: ImageCropperModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fitMode, setFitMode] = useState<'fill' | 'contain'>('fill');

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset when opening a new image
  useEffect(() => {
    if (isOpen && imageSrc) {
      setImageLoaded(false);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setFitMode('fill');
    }
  }, [isOpen, imageSrc]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    setNaturalSize({ width: nw, height: nh });
    setImageLoaded(true);

    // Initial best fit
    const imgAspect = nw / nh;
    if (imgAspect < aspectRatio) {
      // Taller than 16:9 — fill width
      setScale(1);
    } else {
      // Wider than 16:9 — fill height
      setScale(1);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleFitModeToggle = () => {
    if (fitMode === 'fill') {
      setFitMode('contain');
      setScale(0.85);
    } else {
      setFitMode('fill');
      setScale(1.15);
    }
    setPosition({ x: 0, y: 0 });
  };

  const handleConfirmCrop = useCallback(() => {
    if (!imageSrc || !imgRef.current || !containerRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background with clean neutral or brand-safe tone (in case of letterboxing)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const imgEl = imgRef.current;
    const imgRect = imgEl.getBoundingClientRect();

    // Mapping factor from UI container to high-res canvas (1200 x 675)
    const factorX = targetWidth / containerRect.width;
    const factorY = targetHeight / containerRect.height;

    const drawX = (imgRect.left - containerRect.left) * factorX;
    const drawY = (imgRect.top - containerRect.top) * factorY;
    const drawWidth = imgRect.width * factorX;
    const drawHeight = imgRect.height * factorY;

    // Draw the image onto the 16:9 canvas
    const sourceImg = new Image();
    sourceImg.crossOrigin = 'anonymous';
    sourceImg.onload = () => {
      ctx.drawImage(sourceImg, drawX, drawY, drawWidth, drawHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            alert('Failed to generate cropped image.');
            return;
          }
          const croppedFile = new File([blob], `partner-banner-16x9-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          const previewUrl = URL.createObjectURL(blob);
          onCropComplete(croppedFile, previewUrl);
        },
        'image/jpeg',
        0.92
      );
    };
    sourceImg.src = imageSrc;
  }, [imageSrc, targetWidth, targetHeight, onCropComplete]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">
                16:9 Ratio ({targetWidth} × {targetHeight}px) &bull; Mandated format for the public website
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

        {/* Cropper Viewport Area */}
        <div className="p-6 bg-gray-900 flex flex-col items-center justify-center select-none overflow-hidden">
          {/* Instructions Pill */}
          <div className="mb-3 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-[11px] font-medium flex items-center gap-1.5 shadow">
            <Sparkles className="w-3 h-3 text-orange-400" />
            Drag image to position &bull; Use zoom slider below to frame
          </div>

          {/* 16:9 Frame Container */}
          <div
            ref={containerRef}
            className="relative w-full max-w-[560px] aspect-video bg-gray-950 rounded-xl overflow-hidden border-2 border-orange-500/80 shadow-2xl cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* The Image being positioned */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop Source"
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
              draggable={false}
              className="absolute pointer-events-none transition-transform duration-75 will-change-transform"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                maxWidth: fitMode === 'contain' ? '100%' : 'none',
                maxHeight: fitMode === 'contain' ? '100%' : 'none',
              }}
            />

            {/* Rule of Thirds Guidelines */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-white/15" />
              <div className="border-r border-white/15" />
              <div />
            </div>

            {/* 16:9 Badge */}
            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
              16:9 Aspect Ratio
            </div>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Zoom Slider & Actions */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <ZoomOut className="w-3.5 h-3.5 text-gray-400" />
            </span>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-36 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FE6700]"
            />
            <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <ZoomIn className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] text-gray-400 w-8">{Math.round(scale * 100)}%</span>
            </span>

            <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={handleFitModeToggle}
              className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition flex items-center gap-1"
              title="Toggle Fill vs Contain"
            >
              <Maximize2 className="w-3 h-3" />
              {fitMode === 'fill' ? 'Fit Whole' : 'Fill Area'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition"
              title="Reset position & zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmCrop}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#FE6700] to-[#E05300] hover:from-[#E05300] hover:to-[#C94700] rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              Save 16:9 Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default ImageCropperModal;
