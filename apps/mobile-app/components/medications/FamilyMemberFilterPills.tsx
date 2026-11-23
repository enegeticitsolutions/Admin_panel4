import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { HomeColors } from '@/constants/homeTheme';

export interface FamilyFilterMember {
  id: string;
  name: string;
  isSelf?: boolean;
}

interface FamilyMemberFilterPillsProps {
  members: FamilyFilterMember[];
  selectedId: string;
  onSelectMember: (id: string) => void;
}

export function FamilyMemberFilterPills({
  members,
  selectedId,
  onSelectMember,
}: FamilyMemberFilterPillsProps) {
  if (!members || members.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {members.map((member) => {
          const isSelected = member.id === selectedId;
          return (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.pill,
                isSelected ? styles.pillSelected : styles.pillUnselected,
              ]}
              onPress={() => onSelectMember(member.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.pillText,
                  isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
                ]}
                numberOfLines={1}
              >
                {member.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 12,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  pill: {
    height: 44,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillSelected: {
    backgroundColor: '#252D3A',
  },
  pillUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.08,
    borderColor: '#E7DED6',
  },
  pillText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  pillTextUnselected: {
    color: '#667085',
  },
});
