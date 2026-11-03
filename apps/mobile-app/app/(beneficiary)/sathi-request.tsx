import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { SaathiView } from '@/components/shared/SaathiView';

export default function SathiRequestScreen() {
  const { sathiId, beneficiaryId: paramBeneficiaryId, beneficiaryName: paramBeneficiaryName } = useLocalSearchParams();
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>((paramBeneficiaryId as string) || null);
  const [beneficiaryName, setBeneficiaryName] = useState<string | null>((paramBeneficiaryName as string) || null);

  useEffect(() => {
    if (paramBeneficiaryId) {
      setBeneficiaryId(paramBeneficiaryId as string);
      if (paramBeneficiaryName) {
        setBeneficiaryName(paramBeneficiaryName as string);
      }
      return;
    }
    const loadUser = async () => {
      const userStr = await AsyncStorage.getItem('userData');
      if (userStr) {
        const user = JSON.parse(userStr);
        setBeneficiaryId(user.id);
        if (!paramBeneficiaryName) {
          setBeneficiaryName(user.name || null);
        }
      }
    };
    loadUser();
  }, [paramBeneficiaryId, paramBeneficiaryName]);

  if (!beneficiaryId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6A00" />
      </View>
    );
  }

  return (
    <SaathiView
      beneficiaryId={beneficiaryId}
      beneficiaryName={beneficiaryName || undefined}
      initialVolunteerId={sathiId as string}
    />
  );
}
