import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { HomeColors } from '@/constants/homeTheme';

interface WeeklyCalendarStripProps {
  selectedDate: string; // 'YYYY-MM-DD'
  onSelectDate: (dateStr: string) => void;
}

interface DayItem {
  dayName: string;
  dayNumber: string;
  dateStr: string;
  isToday: boolean;
}

export function WeeklyCalendarStrip({
  selectedDate,
  onSelectDate,
}: WeeklyCalendarStripProps) {
  // Generate a 7-day strip centered around the selected date or current week
  const days: DayItem[] = useMemo(() => {
    const today = new Date();
    const activeDate = selectedDate ? new Date(selectedDate) : today;
    const baseDate = isNaN(activeDate.getTime()) ? today : activeDate;

    // Start from Monday of the base date's week
    const currentDayOfWeek = baseDate.getDay(); // 0 is Sun, 1 is Mon
    const distanceToMonday = (currentDayOfWeek + 6) % 7;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() - distanceToMonday);

    const weekDays: DayItem[] = [];
    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const isToday =
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();

      weekDays.push({
        dayName: dayNames[i],
        dayNumber: String(d.getDate()),
        dateStr,
        isToday,
      });
    }

    return weekDays;
  }, [selectedDate]);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {days.map((item) => {
          const isSelected = item.dateStr === selectedDate;

          return (
            <TouchableOpacity
              key={item.dateStr}
              style={[
                styles.dayCard,
                isSelected ? styles.dayCardSelected : styles.dayCardUnselected,
              ]}
              onPress={() => onSelectDate(item.dateStr)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.dayNameText,
                  isSelected ? styles.dayNameSelected : styles.dayNameUnselected,
                ]}
              >
                {item.dayName}
              </Text>
              <Text
                style={[
                  styles.dayNumberText,
                  isSelected ? styles.dayNumberSelected : styles.dayNumberUnselected,
                ]}
              >
                {item.dayNumber}
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
  dayCard: {
    width: 62,
    minWidth: 62,
    height: 72,
    minHeight: 72,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCardSelected: {
    backgroundColor: '#FE6700',
    shadowColor: '#FE6700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 4,
  },
  dayCardUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.08,
    borderColor: '#E7DED6',
  },
  dayNameText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  dayNameSelected: {
    color: '#FFFFFF',
  },
  dayNameUnselected: {
    color: '#667085',
  },
  dayNumberText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    marginTop: 2,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  dayNumberUnselected: {
    color: '#667085',
  },
});
