/**
 * ProfilePhotoUploader — OOP-style reusable React Native component
 *
 * USAGE PATTERN (Config Object — easily extensible):
 *
 *   <ProfilePhotoUploader
 *     config={{
 *       targetType: 'self',         // 'self' | 'beneficiary'
 *       targetId: user.id,          // required for beneficiary
 *       currentPhotoUrl: user.profilePhoto,
 *       size: 100,
 *       editable: true,
 *       onSuccess: (url) => setPhoto(url),
 *     }}
 *   />
 *
 * To add a DocumentUploader later, just create a new config type and component
 * following the same pattern — this serves as the base contract.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ActionSheetIOS,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { PresignedUrlService } from '@/utils/PresignedUrlService';
import CustomAlertModal, { AlertType } from '@/components/shared/CustomAlertModal';
import { queryClient } from '@/services/queryClient';

// ─── Types (OOP config contract) ──────────────────────────────────────────────

/** Supported upload target types in the mobile app */
export type PhotoTargetType = 'self' | 'beneficiary';

/**
 * Config object for ProfilePhotoUploader.
 * Mirrors the concept of a class constructor — pass this to control all behaviour.
 */
export interface PhotoUploaderConfig {
  /** Who is being uploaded: 'self' = logged-in user, 'beneficiary' = a managed beneficiary */
  targetType: PhotoTargetType;
  /**
   * Required when targetType = 'beneficiary'.
   * For 'self', this is unused (the backend resolves the user from the token).
   */
  targetId?: string;
  /** Current photo URL (displayed as the avatar before any upload) */
  currentPhotoUrl?: string | null;
  /** Avatar circle diameter in pixels. Default: 100 */
  size?: number;
  /** Whether to show the camera badge / allow upload. Default: true */
  editable?: boolean;
  /** Fallback initials text (e.g. "JD" for John Doe) */
  initials?: string;
  /** Accent color for the camera badge and active ring. Default: '#F97316' */
  accentColor?: string;
  /** Called after a successful upload with the new photo URL */
  onSuccess?: (newPhotoUrl: string) => void;
  /** Called when an upload fails */
  onError?: (error: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProfilePhotoUploaderProps {
  config: PhotoUploaderConfig;
  style?: object;
}

export function ProfilePhotoUploader({ config, style }: ProfilePhotoUploaderProps) {
  const {
    targetType,
    targetId,
    currentPhotoUrl,
    size = 100,
    editable = true,
    initials = '?',
    accentColor = '#F97316',
    onSuccess,
    onError,
  } = config;

  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: AlertType;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  // Sync and resolve presigned URL when currentPhotoUrl or target changes
  useEffect(() => {
    let isMounted = true;
    async function resolveCurrentUrl() {
      if (!currentPhotoUrl) {
        if (isMounted) setPhotoUrl(null);
        return;
      }
      const isS3Path = !currentPhotoUrl.startsWith('http://') && !currentPhotoUrl.startsWith('https://');
      const isRawS3Url = currentPhotoUrl.includes('s3.') && !currentPhotoUrl.includes('X-Amz-Signature');
      if (isS3Path || isRawS3Url) {
        try {
          const resType = targetType === 'beneficiary' ? 'beneficiary_photo' : 'profile_photo';
          const resId = targetType === 'beneficiary' && targetId ? targetId : 'me';
          const presigned = await PresignedUrlService.get(resType, resId);
          if (isMounted && presigned) {
            setPhotoUrl(presigned);
            setImageError(false);
            return;
          }
        } catch {
          // Keep currentPhotoUrl if lookup fails
        }
      }
      if (isMounted) {
        setPhotoUrl(currentPhotoUrl);
        setImageError(false);
      }
    }
    resolveCurrentUrl();
    return () => { isMounted = false; };
  }, [currentPhotoUrl, targetType, targetId]);

  const radius = size / 2;
  const badgeSize = Math.max(28, Math.round(size * 0.28));
  const badgeRadius = badgeSize / 2;
  const badgeOffset = Math.round(size * 0.05);

  // ── Image Picker ────────────────────────────────────────────────────────────

  async function requestPermissions(source: 'camera' | 'gallery') {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  }

  async function pickFromCamera() {
    const granted = await requestPermissions('camera');
    if (!granted) {
      setAlertConfig({
        visible: true,
        title: 'Permission Required',
        message: 'Camera access is needed to take a photo.',
        type: 'warning',
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.3,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadImage(result.assets[0]);
    }
  }

  async function pickFromGallery() {
    const granted = await requestPermissions('gallery');
    if (!granted) {
      setAlertConfig({
        visible: true,
        title: 'Permission Required',
        message: 'Photo library access is needed to pick a photo.',
        type: 'warning',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.3,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadImage(result.assets[0]);
    }
  }

  // ── iOS Action Sheet (camera vs gallery) ────────────────────────────────────

  function handlePress() {
    if (!editable) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickFromCamera();
          if (buttonIndex === 2) pickFromGallery();
        }
      );
    } else {
      // Android / Web: show custom modal action sheet
      setShowActionSheet(true);
    }
  }

  // ── Upload ──────────────────────────────────────────────────────────────────

  async function uploadImage(asset: ImagePicker.ImagePickerAsset) {
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Not authenticated. Please log in again.');

      const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
      let mimeType = asset.mimeType || 'image/jpeg';
      if (mimeType === 'image/jpg') {
        mimeType = 'image/jpeg';
      }

      let data: any;

      if (Platform.OS === 'web') {
        const formData = new FormData();
        const blobResponse = await fetch(asset.uri);
        const blob = await blobResponse.blob();
        formData.append('file', blob, fileName);
        
        formData.append('targetType', targetType);
        if (targetType === 'beneficiary' && targetId) {
          formData.append('targetId', targetId);
        }

        const response = await fetch(`${API_URL}/profile-photo/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const responseText = await response.text();
        try {
          data = JSON.parse(responseText);
        } catch (parseErr) {
          console.error('[profile photo upload debug] Raw response not JSON:', responseText);
          throw new Error(`Server returned invalid response (Status ${response.status || 'unknown'}).`);
        }
      } else {
        // Native platforms: Use FileSystem.uploadAsync to prevent Android binary corruption
        const uploadTask = await FileSystem.uploadAsync(
          `${API_URL}/profile-photo/upload`,
          asset.uri,
          {
            httpMethod: 'POST',
            uploadType: 1, // FileSystem.FileSystemUploadType.MULTIPART
            fieldName: 'file',
            mimeType: mimeType,
            headers: {
              Authorization: `Bearer ${token}`,
            },
            parameters: {
              targetType,
              ...(targetType === 'beneficiary' && targetId ? { targetId } : {})
            }
          }
        );

        try {
          data = JSON.parse(uploadTask.body);
        } catch (parseErr) {
          console.error('[profile photo upload debug] Raw response not JSON:', uploadTask.body);
          throw new Error(`Server returned invalid response (Status ${uploadTask.status || 'unknown'}).`);
        }
      }

      if (!data.success) throw new Error(data.message || 'Upload failed');

      // Invalidate cached presigned URL
      const resType = targetType === 'beneficiary' ? 'beneficiary_photo' : 'profile_photo';
      const resId = targetType === 'beneficiary' && targetId ? targetId : 'me';
      PresignedUrlService.invalidate(resType, resId);

      if (targetType === 'beneficiary') {
        AsyncStorage.removeItem('beneficiaryDashboardCache').catch(() => {});
        queryClient.invalidateQueries({ queryKey: ['subscriberDashboard'] });
        queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      } else if (targetType === 'self' && data.url) {
        try {
          const rawUserData = await AsyncStorage.getItem('userData');
          if (rawUserData) {
            const parsed = JSON.parse(rawUserData);
            parsed.profilePhoto = data.url;
            parsed.photo = data.url;
            await AsyncStorage.setItem('userData', JSON.stringify(parsed));
          }
        } catch (e) {
          console.warn('[ProfilePhotoUploader] Failed to update cached userData:', e);
        }
      }

      // Update local state immediately (optimistic UI)
      setPhotoUrl(data.url);
      setImageError(false); // reset any previous load error
      onSuccess?.(data.url);

      console.log('[ProfilePhotoUploader] ✅ Upload success, URL:', data.url);

      // ✅ Show success confirmation via custom modal
      setAlertConfig({
        visible: true,
        title: 'Photo Updated!',
        message: data.message || 'Profile photo has been updated successfully.',
        type: 'success',
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to upload photo';
      console.error('[ProfilePhotoUploader] Upload error:', msg);
      setAlertConfig({
        visible: true,
        title: 'Upload Failed',
        message: msg,
        type: 'error',
      });
      onError?.(msg);
    } finally {
      setUploading(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.wrapper, style]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={editable ? 0.8 : 1}
        disabled={uploading}
        style={[
          styles.avatarContainer,
          { width: size, height: size, borderRadius: radius },
        ]}
      >
        {/* Avatar Image or Initials */}
        {photoUrl && !imageError ? (
          <Image
            source={{ uri: sanitizeImageUri(photoUrl) }}
            style={{ width: '100%', height: '100%', borderRadius: radius }}
            resizeMode="cover"
            onError={(e) => {
              console.warn('[ProfilePhotoUploader] Image failed to load:', photoUrl, e.nativeEvent?.error);
              setImageError(true);
            }}
          />
        ) : (
          <View
            style={[
              styles.initialsCircle,
              {
                width: '100%',
                height: '100%',
                borderRadius: radius,
                backgroundColor: accentColor,
              },
            ]}
          >
            <Text style={[styles.initialsText, { fontSize: Math.round(size * 0.33) }]}>
              {initials}
            </Text>
          </View>
        )}

        {/* Loading overlay */}
        {uploading && (
          <View
            style={[
              styles.loadingOverlay,
              { width: size, height: size, borderRadius: radius },
            ]}
          >
            <ActivityIndicator color="#FFFFFF" size="small" />
          </View>
        )}
      </TouchableOpacity>

      {/* Camera Badge */}
      {editable && !uploading && (
        <TouchableOpacity
          onPress={handlePress}
          style={[
            styles.cameraBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeRadius,
              bottom: badgeOffset,
              right: badgeOffset,
              borderColor: accentColor,
            },
          ]}
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={Math.round(badgeSize * 0.5)} color={accentColor} />
        </TouchableOpacity>
      )}

      {/* Android Action Sheet Modal */}
      {Platform.OS !== 'ios' && (
        <Modal
          visible={showActionSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowActionSheet(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowActionSheet(false)}>
            <View style={styles.actionSheetContainer}>
              <Text style={styles.actionSheetTitle}>Upload Photo</Text>
              <TouchableOpacity
                style={styles.actionSheetBtn}
                onPress={() => { setShowActionSheet(false); pickFromCamera(); }}
              >
                <Ionicons name="camera-outline" size={22} color="#111827" />
                <Text style={styles.actionSheetBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionSheetBtn}
                onPress={() => { setShowActionSheet(false); pickFromGallery(); }}
              >
                <Ionicons name="image-outline" size={22} color="#111827" />
                <Text style={styles.actionSheetBtnText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionSheetBtn, styles.actionSheetCancelBtn]}
                onPress={() => setShowActionSheet(false)}
              >
                <Text style={[styles.actionSheetBtnText, { color: '#EF4444' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
      {/* Custom Alert Modal for Success / Warning / Error messages */}
      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        primaryText="OK"
        onPrimary={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'center',
  },
  avatarContainer: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  initialsCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4 },
      android: { elevation: 5 },
    }),
  },
  // Android modal action sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  actionSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 14,
  },
  actionSheetBtnText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  actionSheetCancelBtn: {
    borderBottomWidth: 0,
    marginTop: 8,
    justifyContent: 'center',
  },
});

export default ProfilePhotoUploader;
