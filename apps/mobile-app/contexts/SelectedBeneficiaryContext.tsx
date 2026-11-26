import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BeneficiaryItem } from '@/components/dashboard/FamilyCareSection';

interface SelectedBeneficiaryContextValue {
  selectedBeneficiary: BeneficiaryItem | null;
  setSelectedBeneficiary: (beneficiary: BeneficiaryItem | null) => void;
  canEditSelected: boolean;
}

const SelectedBeneficiaryContext = createContext<SelectedBeneficiaryContextValue>({
  selectedBeneficiary: null,
  setSelectedBeneficiary: () => {},
  canEditSelected: true,
});

export const SelectedBeneficiaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedBeneficiary, setSelectedBeneficiaryState] = useState<BeneficiaryItem | null>(null);

  const setSelectedBeneficiary = useCallback((beneficiary: BeneficiaryItem | null) => {
    setSelectedBeneficiaryState(beneficiary);
    if (beneficiary?.id) {
      AsyncStorage.setItem('selectedBeneficiaryId', beneficiary.id).catch(() => {});
    }
  }, []);

  const canEditSelected = useMemo(() => {
    if (!selectedBeneficiary) return true;
    return selectedBeneficiary.canEditDetails !== false;
  }, [selectedBeneficiary]);

  const value = useMemo(
    () => ({
      selectedBeneficiary,
      setSelectedBeneficiary,
      canEditSelected,
    }),
    [selectedBeneficiary, setSelectedBeneficiary, canEditSelected]
  );

  return (
    <SelectedBeneficiaryContext.Provider value={value}>
      {children}
    </SelectedBeneficiaryContext.Provider>
  );
};

export const useSelectedBeneficiary = () => useContext(SelectedBeneficiaryContext);
