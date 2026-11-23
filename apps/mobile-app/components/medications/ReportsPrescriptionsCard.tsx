import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ReportsPrescriptionsCardProps {
  fileCount?: number;
  onPress: () => void;
}

export function ReportsPrescriptionsCard({
  fileCount = 8,
  onPress,
}: ReportsPrescriptionsCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Left Icon Square */}
      <View style={styles.iconBox}>
        <Feather name="file-text" size={20} color="#2865C7" />
      </View>

      {/* Middle Text Details */}
      <View style={styles.textContainer}>
        <Text style={styles.titleText}>Reports & prescriptions</Text>
        <Text style={styles.subtitleText}>{fileCount} securely stored files</Text>
      </View>

      {/* Right Chevron */}
      <Feather name="chevron-right" size={20} color="#1F2937" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 92,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.08,
    borderColor: '#E7DED6',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#EAF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#1F2937',
  },
  subtitleText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#667085',
    marginTop: 4,
  },
});
