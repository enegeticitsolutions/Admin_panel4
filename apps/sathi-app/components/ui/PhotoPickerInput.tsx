/**
 * PhotoPickerInput — Reusable photo picker for forms (enrollment wizards, etc.)
 *
 * Unlike ProfilePhotoUploader (which uploads immediately to the backend),
 * this component ONLY picks a photo from camera or gallery and returns the
 * local URI to the parent form. The parent decides when/how to upload.
 *
 * Use this in:
 *   - Beneficiary enrollment wizard (Step 2)
 *   - Care Companion profile setup
 *   - Subscriber registration
 *   - Any form where the entity doesn't have an ID yet
 *
 * Props:
 *   onPhotoSelected  — called with the local URI when user picks a photo
 *   onPhotoClear     — called when user removes the current photo (optional)
 *   currentUri       — current photo URI (controlled from parent form state)
 *   size             — width/height of the picker box. Default: 120
 *   shape            — 'circle' | 'square'. Default: 'square'
 *   accentColor      — color of the badge and border. Default: '#F97316'
 *   label            — text shown below the icon. Default: 'Upload Photo'
 *   hint             — small hint text shown below the box
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Alert,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoPickerInputProps {
  onPhotoSelected: (uri: string) => void;
  onPhotoClear?: () => void;
  currentUri?: string | null;
  size?: number;
  shape?: 'circle' | 'square';
  accentColor?: string;
  label?: string;
  hint?: string;
  editable?: boolean;
  width?: number;
  height?: number;
  emptyImageSource?: ImageSourcePropType;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PhotoPickerInput({
  onPhotoSelected,
  onPhotoClear,
  currentUri = null,
  size = 120,
  shape = 'square',
  accentColor = '#F97316',
  label = 'Upload Photo',
  hint,
  editable = true,
  width,
  height,
  emptyImageSource,
}: PhotoPickerInputProps) {
  const [showSheet, setShowSheet] = useState(false);
  const [loading, setLoading] = useState(false);

  const boxWidth = width ?? size;
  const boxHeight = height ?? size;
  const minBoxSize = Math.min(boxWidth, boxHeight);
  const borderRadius = shape === 'circle' ? minBoxSize / 2 : 14;
  const badgeSize = Math.max(26, Math.round(minBoxSize * 0.25));

  // ── Permission + picker logic ──────────────────────────────────────────────

  async function requestAndPick(source: 'camera' | 'gallery') {
    setLoading(true);
    try {
      let permResult;
      if (source === 'camera') {
        permResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (permResult.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          source === 'camera'
            ? 'Camera access is needed to take a photo.'
            : 'Photo library access is needed to pick an image.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.5,
            allowsEditing: true,
            aspect: [1, 1],
          })
          : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.5,
            allowsEditing: true,
            aspect: [1, 1],
          });

      if (!result.canceled && result.assets.length > 0) {
        onPhotoSelected(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not pick image');
    } finally {
      setLoading(false);
    }
  }

  // ── Handle press ───────────────────────────────────────────────────────────

  function handlePress() {
    if (!editable) return;

    if (Platform.OS === 'ios') {
      const opts = currentUri
        ? ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo']
        : ['Cancel', 'Take Photo', 'Choose from Library'];
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: 0, destructiveButtonIndex: currentUri ? 3 : undefined },
        (idx) => {
          if (idx === 1) requestAndPick('camera');
          if (idx === 2) requestAndPick('gallery');
          if (idx === 3 && onPhotoClear) onPhotoClear();
        }
      );
    } else {
      setShowSheet(true);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasPhoto = !!currentUri;

  return (
    <View style={styles.wrapper}>
      {/* Main tap target */}
      <TouchableOpacity
        style={[
          styles.box,
          {
            width: boxWidth,
            height: boxHeight,
            borderRadius,
            borderColor: hasPhoto ? accentColor : emptyImageSource ? 'transparent' : '#D1D5DB',
            borderWidth: hasPhoto ? 2 : emptyImageSource ? 0 : 1.5,
            borderStyle: hasPhoto ? 'solid' : emptyImageSource ? 'solid' : 'dashed',
            backgroundColor: emptyImageSource && !hasPhoto ? 'transparent' : '#F9FAFB',
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.75}
        disabled={!editable || loading}
      >
        {loading ? (
          <ActivityIndicator color={accentColor} size="small" />
        ) : hasPhoto ? (
          <Image
            source={{ uri: sanitizeImageUri(currentUri) }}
            style={{ width: boxWidth, height: boxHeight, borderRadius }}

            resizeMode="cover"
          />
        ) : emptyImageSource ? (
          <Image
            source={emptyImageSource}
            style={[StyleSheet.absoluteFillObject, { width: boxWidth, height: boxHeight }]}
            resizeMode="stretch"
          />
        ) : (
          <>
            <MaterialCommunityIcons name="image-plus" size={Math.round(size * 0.28)} color="#9CA3AF" />
            <Text style={styles.label}>{label}</Text>
          </>
        )}

        {/* Badge */}
        {editable && !loading && (hasPhoto || !emptyImageSource) && (
          <View
            style={[
              styles.badge,
              {
                width: badgeSize,
                height: badgeSize,
                borderRadius: badgeSize / 2,
                backgroundColor: accentColor,
                bottom: shape === 'circle' ? -(badgeSize * 0.1) : -8,
                right: shape === 'circle' ? -(badgeSize * 0.1) : -8,
              },
            ]}
          >
            <Ionicons
              name={hasPhoto ? 'pencil' : 'camera'}
              size={Math.round(badgeSize * 0.45)}
              color="#fff"
            />
          </View>
        )}
      </TouchableOpacity>

      {/* Hint text */}
      {hint || hasPhoto ? (
        <Text style={[styles.hint, hasPhoto && { color: '#10B981' }]}>
          {hasPhoto ? '✅ Photo selected — tap to change' : hint}
        </Text>
      ) : null}

      {/* Android action sheet modal */}
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
              <Text style={styles.sheetTitle}>Upload Photo</Text>

              <TouchableOpacity
                style={styles.sheetBtn}
                onPress={() => { setShowSheet(false); requestAndPick('camera'); }}
              >
                <Ionicons name="camera-outline" size={22} color="#111827" />
                <Text style={styles.sheetBtnText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetBtn}
                onPress={() => { setShowSheet(false); requestAndPick('gallery'); }}
              >
                <Ionicons name="image-outline" size={22} color="#111827" />
                <Text style={styles.sheetBtnText}>Choose from Gallery</Text>
              </TouchableOpacity>

              {hasPhoto && onPhotoClear && (
                <TouchableOpacity
                  style={styles.sheetBtn}
                  onPress={() => { setShowSheet(false); onPhotoClear(); }}
                >
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                  <Text style={[styles.sheetBtnText, { color: '#EF4444' }]}>Remove Photo</Text>
                </TouchableOpacity>
              )}

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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  box: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    overflow: 'visible',
    position: 'relative',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  hint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 10,
    textAlign: 'center',
  },
  // Android sheet
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
    fontWeight: '500',
  },
  sheetCancelBtn: {
    borderBottomWidth: 0,
    marginTop: 8,
    justifyContent: 'center',
  },
});

export default PhotoPickerInput;
