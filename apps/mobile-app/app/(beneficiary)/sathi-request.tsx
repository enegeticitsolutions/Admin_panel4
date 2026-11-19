import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { SaathiView } from '@/components/shared/SaathiView';
import { SaathiBeneficiaryPickerModal, SaathiEligibleMember } from '@/components/saathi';
import { API_URL } from '@/constants/api';

export default function SathiRequestScreen() {
  const { sathiId, beneficiaryId: paramBeneficiaryId, beneficiaryName: paramBeneficiaryName } = useLocalSearchParams();
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>((paramBeneficiaryId as string) || null);
  const [beneficiaryName, setBeneficiaryName] = useState<string | null>((paramBeneficiaryName as string) || null);
  const [eligibleBeneficiaries, setEligibleBeneficiaries] = useState<SaathiEligibleMember[]>([]);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initBeneficiary = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userStr = await AsyncStorage.getItem('userData');
        const user = userStr ? JSON.parse(userStr) : null;

        let eligibleList: SaathiEligibleMember[] = [];
        if (token) {
          try {
            const res = await fetch(`${API_URL}/subscriber/beneficiaries/sathi-eligible`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
              eligibleList = json.data.map((b: any) => ({
                id: b.id,
                name: b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Family Member',
                relationship: b.relationship || 'Family',
                photo: b.photo || null,
                age: b.age || null,
                remainingHours: b.remainingUnits,
                planName: b.activePackageName || b.packageName || undefined,
              }));
            }
          } catch (e) {
            console.warn('[sathi-request] Error loading eligible beneficiaries:', e);
          }
        }

        if (!isMounted) return;
        setEligibleBeneficiaries(eligibleList);

        if (paramBeneficiaryId) {
          setBeneficiaryId(paramBeneficiaryId as string);
          if (paramBeneficiaryName) {
            setBeneficiaryName(paramBeneficiaryName as string);
          } else {
            const matched = eligibleList.find(b => b.id === paramBeneficiaryId);
            if (matched) setBeneficiaryName(matched.name);
          }
        } else if (eligibleList.length > 0) {
          // If no specific param is provided, default to the first eligible member (e.g. nanaji)
          setBeneficiaryId(eligibleList[0].id);
          setBeneficiaryName(eligibleList[0].name);
        } else if (user) {
          // Fallback to personal account
          setBeneficiaryId(user.id);
          setBeneficiaryName(user.name || null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initBeneficiary();

    return () => {
      isMounted = false;
    };
  }, [paramBeneficiaryId, paramBeneficiaryName]);

  if (loading || !beneficiaryId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6A00" />
      </View>
    );
  }

  return (
    <>
      <SaathiView
        beneficiaryId={beneficiaryId}
        beneficiaryName={beneficiaryName || undefined}
        initialVolunteerId={sathiId as string}
        onChangeBeneficiary={eligibleBeneficiaries.length > 1 ? () => setShowPickerModal(true) : undefined}
      />
      <SaathiBeneficiaryPickerModal
        visible={showPickerModal}
        onClose={() => setShowPickerModal(false)}
        beneficiaries={eligibleBeneficiaries}
        onSelectBeneficiary={(member) => {
          setBeneficiaryId(member.id);
          setBeneficiaryName(member.name);
          setShowPickerModal(false);
        }}
      />
    </>
  );
}
