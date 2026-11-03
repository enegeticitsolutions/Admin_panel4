import React from 'react';
import { AddMedicationModal, MedicationFormPayload } from '../medications/AddMedicationModal';

export type MedicationFormData = {
    id?: string;
    name: string;
    dosage: string;
    route?: string;
    cadence?: string;
    frequency: string;
    instructions?: string;
    startDate?: string;
    endDate?: string;
    timeSlots?: string[];
    timesPerDay?: string[];
    setReminders?: boolean;
    totalDays?: number | null;
};

interface AddMedicineModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (medicine: any) => Promise<void> | void;
    initialData?: any;
    loading?: boolean;
}

/**
 * Unified AddMedicineModal Adapter:
 * Forwards directly to the unified AddMedicationModal.
 */
export const AddMedicineModal: React.FC<AddMedicineModalProps> = ({
    visible,
    onClose,
    onSave,
    initialData,
    loading = false,
}) => {
    return (
        <AddMedicationModal
            visible={visible}
            onClose={onClose}
            onSave={onSave}
            initialData={initialData}
            loading={loading}
        />
    );
};

export default AddMedicineModal;
