/**
 * ProfilePhotoUploader — OOP-style reusable React (Admin Panel) component
 *
 * USAGE PATTERN (Config Object — easily extensible):
 *
 *   <ProfilePhotoUploader
 *     config={{
 *       targetType: 'care_companion',
 *       targetId: staffRecord.userId,    // userId resolves the correct DB table on backend
 *       currentPhotoUrl: staffRecord.photo,
 *       name: staffRecord.name,
 *       size: 96,
 *       editable: true,
 *       onSuccess: (url) => setPhoto(url),
 *     }}
 *   />
 *
 * To add a DocumentUploader later, just create a new config type and component
 * following the same pattern — this serves as the base contract.
 */

import React, { useRef,useEffect, useState } from 'react';
import { sanitizeImgSrc } from '../../utils/sanitizeUrl';
import { uploadApi, fileAccessApi } from '@/services/api';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle,
  DialogHeader,
} from '../ui/dialog';

// ─── Types (OOP config contract) ──────────────────────────────────────────────

/** All entity types the admin panel can upload photos for */
export type AdminPhotoTargetType =
  | 'subscriber'
  | 'care_companion'
  | 'field_manager'
  | 'operations_manager'
  | 'beneficiary';

/**
 * Config object for the admin ProfilePhotoUploader.
 * Mirrors the concept of a class constructor.
 */
export interface AdminPhotoUploaderConfig {
  /** Entity type whose photo is being uploaded */
  targetType: AdminPhotoTargetType;
  /**
   * The ID to pass to the backend.
   * - For staff (CC/FM/OM): use the User.id (backend resolves role-specific profile)
   * - For beneficiary: use the Beneficiary.id
   * - For subscriber: use the User.id
   */
  targetId: string;
  /** Current photo URL to display initially */
  currentPhotoUrl?: string | null;
  /** Display name — used to generate initials as avatar fallback */
  name?: string;
  /** Avatar size in pixels. Default: 80 */
  size?: number;
  /** Whether upload interaction is enabled. Default: true */
  editable?: boolean;
  /** Accent color for hover ring and badge. Default: '#F97316' */
  accentColor?: string;
  /** Called after a successful upload with the new photo URL and storage key */
  onSuccess?: (newPhotoUrl: string, storageKey?: string) => void;
  /** Called when an upload fails */
  onError?: (error: string) => void;
}

// ─── Helper: get initials from a name ─────────────────────────────────────────
function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProfilePhotoUploaderProps {
  config: AdminPhotoUploaderConfig;
  className?: string;
}

export function ProfilePhotoUploader({ config, className = '' }: ProfilePhotoUploaderProps) {
  const {
    targetType,
    targetId,
    currentPhotoUrl,
    name,
    size = 80,
    editable = true,
    accentColor = '#F97316',
    onSuccess,
    onError,
  } = config;

  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl ?? null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync and resolve presigned URL when currentPhotoUrl changes.
  // Mirrors the exact Sathi pattern:
  //   - null/empty            → show initials, no API call
  //   - already presigned URL → use directly (X-Amz-Signature present)
  //   - raw S3 key or unsigned S3 URL → call /api/files/presigned to get a fresh URL
  //   - any other https URL   → use directly (Supabase public, etc.)
  useEffect(() => {
    let isMounted = true;
    async function resolvePhoto() {
      if (!currentPhotoUrl) {
        if (isMounted) {
          setPhotoUrl(null);
          setImageLoadError(false);
        }
        return;
      }

      // Already a presigned URL (has AWS signature) — use directly
      if (currentPhotoUrl.includes('X-Amz-Signature')) {
        if (isMounted) {
          setPhotoUrl(currentPhotoUrl);
          setImageLoadError(false);
        }
        return;
      }

      // Raw S3 key (not http/https) or un-signed S3 HTTPS URL — needs presigning
      const isRawKey = !currentPhotoUrl.startsWith('http://') && !currentPhotoUrl.startsWith('https://');
      const isUnsignedS3Url = currentPhotoUrl.includes('s3.') && !currentPhotoUrl.includes('X-Amz-Signature');

      if (isRawKey || isUnsignedS3Url) {
        try {
          const freshUrl = await fileAccessApi.getPresignedUrl('profile_photo', targetId);
          if (isMounted && freshUrl) {
            setPhotoUrl(freshUrl);
            setImageLoadError(false);
            return;
          }
        } catch {
          // Presign failed (e.g. no photo in DB) — fall through to use currentPhotoUrl as-is
        }
      }

      // Already a valid https URL (Supabase, CDN, etc.) — use directly
      if (isMounted) {
        setPhotoUrl(currentPhotoUrl);
        setImageLoadError(false);
      }
    }
    resolvePhoto();
    return () => { isMounted = false; };
  }, [currentPhotoUrl, targetType, targetId]);

  const initials = getInitials(name);
  const badgeSize = Math.round(size * 0.32);

  // ── File Input Handler ──────────────────────────────────────────────────────

  function handleUploadClick() {
    if (!editable || uploading) return;
    fileInputRef.current?.click();
  }

  function handleAvatarClick() {
    if (photoUrl) {
      setIsViewerOpen(true);
    } else {
      handleUploadClick();
    }
  }

  function handleBadgeClick(e: React.MouseEvent) {
    e.stopPropagation();
    handleUploadClick();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';
    await uploadFile(file);
  }

  // ── Upload ──────────────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadApi.uploadProfilePhoto(targetType, targetId, file);
      // result.url is already a presigned URL from the backend
      setPhotoUrl(result.url);
      setImageLoadError(false);
      onSuccess?.(result.url, result.storageKey);
    } catch (err: any) {
      const msg = err.message || 'Upload failed';
      setError(msg);
      onError?.(msg);
    } finally {
      setUploading(false);
    }
  }

  // ── Drag and Drop ────────────────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!editable) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      uploadFile(file);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        id={`photo-uploader-${targetId}`}
      />

      {/* Avatar container */}
      <div
        onClick={handleAvatarClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDragOver={(e) => { e.preventDefault(); setHovered(true); }}
        onDragLeave={() => setHovered(false)}
        onDrop={handleDrop}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          cursor: editable ? 'pointer' : 'default',
          position: 'relative',
          border: `3px solid ${hovered && editable ? accentColor : '#E5E7EB'}`,
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          boxShadow: hovered && editable
            ? `0 0 0 3px ${accentColor}22`
            : '0 2px 8px rgba(0,0,0,0.08)',
          flexShrink: 0,
        }}
      >
        {/* Photo or initials */}
        {photoUrl && !imageLoadError ? (
          <img
            src={sanitizeImgSrc(photoUrl)}
            alt={name || 'Profile'}
            onError={() => setImageLoadError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                color: '#fff',
                fontWeight: 800,
                fontSize: size * 0.33,
                letterSpacing: 1,
                userSelect: 'none',
              }}
            >
              {initials}
            </span>
          </div>
        )}

        {/* Hover / uploading overlay */}
        {editable && (hovered || uploading) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'opacity 0.2s',
            }}
          >
            {uploading ? (
              <>
                <div className="upload-spinner" style={{
                  width: size * 0.28,
                  height: size * 0.28,
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  animation: 'spin 0.7s linear infinite',
                }} />
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>Uploading…</span>
              </>
            ) : (
              <>
                <svg width={size * 0.28} height={size * 0.28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>
                  {photoUrl ? 'View' : 'Upload'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Camera badge (bottom-right) */}
      {editable && !uploading && (
        <button
          onClick={handleBadgeClick}
          title="Upload photo"
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: badgeSize,
            height: badgeSize,
            borderRadius: '50%',
            background: '#fff',
            border: `2px solid ${accentColor}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {/* Camera icon SVG */}
          <svg
            width={badgeSize * 0.52}
            height={badgeSize * 0.52}
            viewBox="0 0 24 24"
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            color: '#EF4444',
            whiteSpace: 'nowrap',
            zIndex: 50,
          }}
        >
          {error}
        </div>
      )}

      {/* CSS keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Photo Viewer Modal */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Profile Photo</DialogTitle>
          </DialogHeader>
          {photoUrl && !imageLoadError && (
            <div className="relative flex items-center justify-center min-h-[300px]">
              <img 
                src={sanitizeImgSrc(photoUrl)} 
                alt={name || 'Profile'} 
                onError={() => setImageLoadError(true)}
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProfilePhotoUploader;
