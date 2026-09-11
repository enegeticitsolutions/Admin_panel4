/**
 * VisitImageGallery — Multi-image upload gallery for Visit Details
 *
 * Reuses PhotoPickerInput for the camera/gallery picking logic.
 * All upload limits (maxImages, maxFileSizeMB, allowedTypes) are fetched
 * from the backend config endpoint so they are never hardcoded in the app.
 *
 * Usage:
 *   <VisitImageGallery
 *     visitId={visitId}
 *     token={token}
 *     isCompleted={isCompleted}   // read-only mode when true
 *   />
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '@/constants/api';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadConfig {
  maxImages: number;
  maxFileSizeMB: number;
  allowedTypes: string[];
}

interface ImageSlot {
  /** Remote URL if already uploaded, or local URI if just picked */
  url: string;
  /** True while this slot is being uploaded to the server */
  uploading: boolean;
}

interface VisitImageGalleryProps {
  visitId: string;
  token: string;
  /** When true, only thumbnails are shown — no add/remove buttons */
  isCompleted?: boolean;
}

const ACCENT = '#FE6700';
const TILE_SIZE = 90;

// ─── Component ────────────────────────────────────────────────────────────────

export function VisitImageGallery({ visitId, token, isCompleted = false }: VisitImageGalleryProps) {
  const [config, setConfig] = useState<UploadConfig>({
    maxImages: 10,
    maxFileSizeMB: 25,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  });
  const [images, setImages] = useState<ImageSlot[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Fetch config from backend once ─────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/care-companion/visit-images/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) setConfig(json.data);
    } catch {
      // Fall back to defaults — not critical
    }
  }, [token]);

  // ── Fetch existing images ──────────────────────────────────────────────────

  const fetchImages = useCallback(async () => {
    if (!visitId) return;
    setLoadingImages(true);
    try {
      const res = await fetch(`${API_URL}/care-companion/visit-images/${visitId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data?.imageUrls) {
        setImages((json.data.imageUrls as string[]).map(url => ({ url, uploading: false })));
      }
    } catch {
      // silent — list stays empty
    } finally {
      setLoadingImages(false);
    }
  }, [visitId, token]);

  useEffect(() => {
    fetchConfig();
    fetchImages();
  }, [fetchConfig, fetchImages]);

  // ── Permission helper ───────────────────────────────────────────────────────

  async function requestPermission(source: 'camera' | 'gallery'): Promise<boolean> {
    const result = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (result.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        source === 'camera'
          ? 'Camera access is required to take a photo.'
          : 'Photo library access is required to pick an image.',
      );
      return false;
    }
    return true;
  }

  // ── Pick + upload flow ──────────────────────────────────────────────────────

  async function pickAndUpload(source: 'camera' | 'gallery') {
    setShowSheet(false);

    if (images.filter(i => !i.uploading).length >= config.maxImages) {
      Alert.alert('Limit Reached', `You can upload up to ${config.maxImages} images per visit.`);
      return;
    }

    const granted = await requestPermission(source);
    if (!granted) return;

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.3,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.3,
          allowsEditing: false,
          allowsMultipleSelection: false,
        });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];

    // Client-side size check (fileSize is in bytes)
    if (asset.fileSize && asset.fileSize > config.maxFileSizeMB * 1024 * 1024) {
      Alert.alert(
        'File Too Large',
        `Please choose an image smaller than ${config.maxFileSizeMB}MB. This image is ${(asset.fileSize / (1024 * 1024)).toFixed(1)}MB.`,
      );
      return;
    }

    // Optimistically add a spinner tile
    const placeholderId = `local_${Date.now()}`;
    setImages(prev => [...prev, { url: asset.uri, uploading: true }]);

    try {
      const fileName = asset.fileName || `visit_photo_${Date.now()}.jpg`;
      let mimeType = asset.mimeType || 'image/jpeg';
      if (mimeType === 'image/jpg') {
        mimeType = 'image/jpeg';
      }

      const formData = new FormData();
      if (Platform.OS === 'web') {
        const blobRes = await fetch(asset.uri);
        const blob = await blobRes.blob();
        formData.append('file', blob, fileName);
      } else {
        formData.append('file', { uri: asset.uri, name: fileName, type: mimeType } as any);
      }

      const uploadRes = await fetch(`${API_URL}/care-companion/visit-images/${visitId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const responseText = await uploadRes.text();
      let json: any;
      try {
        json = JSON.parse(responseText);
      } catch (parseErr) {
        setImages(prev => prev.filter(i => !(i.url === asset.uri && i.uploading)));
        console.error('[upload debug] Raw response not JSON:', responseText);
        Alert.alert(
          'Upload Failed',
          `Server returned invalid response (Status ${uploadRes.status || 'unknown'}).`
        );
        return;
      }

      if (!json.success) {
        // Remove the placeholder on failure
        setImages(prev => prev.filter(i => !(i.url === asset.uri && i.uploading)));
        Alert.alert('Upload Failed', json.message || 'Could not upload photo. Please try again.');
        return;
      }

      // Replace placeholder with real server URL
      setImages(prev => {
        const idx = prev.findIndex(i => i.url === asset.uri && i.uploading);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { url: json.url, uploading: false };
        return next;
      });
    } catch (err: any) {
      setImages(prev => prev.filter(i => !(i.url === asset.uri && i.uploading)));
      Alert.alert('Upload Error', err.message || 'Network error during upload.');
    }
  }

  // ── Remove image ────────────────────────────────────────────────────────────

  async function removeImage(url: string) {
    Alert.alert('Remove Photo', 'Remove this photo from the visit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          // Optimistic remove
          setImages(prev => prev.filter(i => i.url !== url));
          try {
            await fetch(`${API_URL}/care-companion/visit-images/${visitId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ url }),
            });
          } catch {
            // Re-fetch to reconcile on failure
            fetchImages();
          }
        },
      },
    ]);
  }

  // ── Open picker action sheet ────────────────────────────────────────────────

  function handleAddPress() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Gallery'], cancelButtonIndex: 0 },
        idx => {
          if (idx === 1) pickAndUpload('camera');
          if (idx === 2) pickAndUpload('gallery');
        },
      );
    } else {
      setShowSheet(true);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const canAddMore = !isCompleted && images.length < config.maxImages;

  if (loadingImages) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={ACCENT} />
        <Text style={styles.loadingText}>Loading photos…</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Counter badge */}
      <Text style={styles.counter}>
        {images.filter(i => !i.uploading).length} / {config.maxImages} photos
        {isCompleted ? ' (read-only)' : ''}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {/* Existing / uploading tiles */}
        {images.map((slot, idx) => (
          <View key={`${slot.url}_${idx}`} style={styles.tile}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => !slot.uploading && setPreviewUrl(slot.url)}
            >
              <Image
                source={{ uri: sanitizeImageUri(slot.url) }}
                style={[styles.thumb, slot.uploading && { opacity: 0.4 }]}
                resizeMode="cover"
              />
              {slot.uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Remove button */}
            {!isCompleted && !slot.uploading && (
              <TouchableOpacity style={styles.removeBadge} onPress={() => removeImage(slot.url)}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Add Photo tile */}
        {canAddMore && (
          <TouchableOpacity style={styles.addTile} onPress={handleAddPress} activeOpacity={0.75}>
            <Ionicons name="camera-outline" size={26} color={ACCENT} />
            <Text style={styles.addText}>Add Photo</Text>
          </TouchableOpacity>
        )}

        {/* Empty state */}
        {images.length === 0 && !canAddMore && (
          <Text style={styles.emptyText}>No photos uploaded for this visit.</Text>
        )}
      </ScrollView>

      {/* Max size hint */}
      {!isCompleted && (
        <Text style={styles.hint}>
          Up to {config.maxImages} images · Max {config.maxFileSizeMB}MB each
        </Text>
      )}

      {/* Android action sheet */}
      {Platform.OS !== 'ios' && (
        <Modal
          visible={showSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSheet(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setShowSheet(false)}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Add Visit Photo</Text>
              <TouchableOpacity
                style={styles.sheetBtn}
                onPress={() => pickAndUpload('camera')}
              >
                <Ionicons name="camera-outline" size={22} color="#111827" />
                <Text style={styles.sheetBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetBtn}
                onPress={() => pickAndUpload('gallery')}
              >
                <Ionicons name="image-outline" size={22} color="#111827" />
                <Text style={styles.sheetBtnText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetCancelBtn]}
                onPress={() => setShowSheet(false)}
              >
                <Text style={[styles.sheetBtnText, { color: '#9CA3AF' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Fullscreen preview modal */}
      <Modal
        visible={!!previewUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUrl(null)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUrl(null)}>
          {previewUrl && (
            <Image
              source={{ uri: sanitizeImageUri(previewUrl) }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewUrl(null)}>
            <Ionicons name="close-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: 'Poppins_400Regular',
  },
  counter: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Poppins_500Medium',
    marginBottom: 10,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 4,
  },
  tile: {
    position: 'relative',
  },
  thumb: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
      android: { elevation: 3 },
    }),
  },
  addTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF7F0',
    gap: 4,
  },
  addText: {
    fontSize: 11,
    color: ACCENT,
    fontFamily: 'Poppins_500Medium',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: 'Poppins_400Regular',
    paddingVertical: 8,
  },
  hint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Poppins_400Regular',
    marginTop: 8,
  },
  // Android bottom sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 14,
  },
  sheetBtnText: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Poppins_500Medium',
  },
  sheetCancelBtn: {
    borderBottomWidth: 0,
    marginTop: 8,
    justifyContent: 'center',
  },
  // Fullscreen image preview
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '95%',
    height: '80%',
  },
  previewClose: {
    position: 'absolute',
    top: 52,
    right: 20,
  },
});

export default VisitImageGallery;
