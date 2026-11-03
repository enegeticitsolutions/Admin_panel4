import React from 'react';
import { AddMedicationModal, MedicationFormPayload } from '@/components/medications/AddMedicationModal';

export type Medication = {
    id?: string;
    name: string;
    dosage: string;
    route?: string;
    cadence?: string;
    frequency: string;
    timeSlots?: string[];
    setReminders: boolean;
};

interface AddMedicineModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (medication: any) => void;
}

const AddMedicineModal: React.FC<AddMedicineModalProps> = ({ visible, onClose, onAdd }) => {
    return (
        <AddMedicationModal
            visible={visible}
            onClose={onClose}
            onSave={(payload) => onAdd(payload)}
        />
    );
};

export default AddMedicineModal;
