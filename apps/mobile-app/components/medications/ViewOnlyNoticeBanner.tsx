import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export function ViewOnlyNoticeBanner() {
  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <Feather name="shield" size={18} color="#704B00" style={styles.icon} />
        <Text style={styles.headerText}>View-only friendly</Text>
      </View>
      <Text style={styles.bodyText}>
        Care Circle members see updates without changing medicines unless you grant edit access.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    backgroundColor: '#FFF3D2',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  icon: {
    marginRight: 2,
  },
  headerText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#704B00',
  },
  bodyText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    lineHeight: 23,
    color: '#795F28',
  },
});
