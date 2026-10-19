import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface SoapData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  overallStatus: 'Stable' | 'Improved' | 'Needs attention' | 'Urgent';
  escalationLevel: 'None' | 'Inform Field Manager (24 h)' | 'Care Manager review (same day)' | 'ERC now';
  escalationReasons: string[];
  familyConnectSummary: string;
  followUpPrompts: string[];
  formattedNotes: string;
}

interface SoapReviewModalProps {
  visible: boolean;
  soapData: SoapData | null;
  onApply: (formattedNotes: string, mode: 'replace' | 'append') => void;
  onDismiss: () => void;
}

export const SoapReviewModal: React.FC<SoapReviewModalProps> = ({
  visible,
  soapData,
  onApply,
  onDismiss,
}) => {
  const [acknowledgedErc, setAcknowledgedErc] = useState(false);
  const [activeTab, setActiveTab] = useState<'soap' | 'family'>('soap');

  if (!soapData) return null;

  const isEmergency = soapData.escalationLevel === 'ERC now';
  const isCareManager = soapData.escalationLevel === 'Care Manager review (same day)';
  const isFieldManager = soapData.escalationLevel === 'Inform Field Manager (24 h)';
  const hasEscalation = isEmergency || isCareManager || isFieldManager;

  const handleConfirmReplace = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApply(soapData.formattedNotes, 'replace');
  };

  const handleConfirmAppend = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApply(soapData.formattedNotes, 'append');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Urgent':
        return { bg: '#FEE2E2', text: '#DC2626', border: '#F87171' };
      case 'Needs attention':
        return { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' };
      case 'Improved':
        return { bg: '#D1FAE5', text: '#059669', border: '#6EE7B7' };
      default:
        return { bg: '#E0E7FF', text: '#4338CA', border: '#A5B4FC' };
    }
  };

  const statusColors = getStatusColor(soapData.overallStatus);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <SafeAreaView style={styles.modalContainer}>
        <StatusBar barStyle="dark-content" />

        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <View>
            <View style={styles.titleRow}>
              <Ionicons name="sparkles" size={20} color="#4F46E5" style={{ marginRight: 6 }} />
              <Text style={styles.modalTitle}>SOAP Visit Note</Text>
            </View>
            <Text style={styles.modalSubtitle}>MHN-TPL-SOAP-001 Clinical Standard</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
            <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
              {soapData.overallStatus}
            </Text>
          </View>
        </View>

        {/* Tab Toggle: SOAP vs Family Connect */}
        <View style={styles.tabToggleRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'soap' && styles.tabButtonActive]}
            onPress={() => setActiveTab('soap')}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={activeTab === 'soap' ? '#4F46E5' : '#6B7280'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'soap' && styles.tabButtonTextActive]}>
              Clinical SOAP
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'family' && styles.tabButtonActive]}
            onPress={() => setActiveTab('family')}
          >
            <Ionicons
              name="heart-outline"
              size={16}
              color={activeTab === 'family' ? '#4F46E5' : '#6B7280'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'family' && styles.tabButtonTextActive]}>
              Family Connect
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Red Flag Auto-Escalation Banner */}
          {hasEscalation && (
            <View
              style={[
                styles.escalationBanner,
                isEmergency ? styles.emergencyBanner : styles.warningBanner,
              ]}
            >
              <View style={styles.escalationHeader}>
                <Ionicons
                  name={isEmergency ? 'alert-circle' : 'warning'}
                  size={22}
                  color={isEmergency ? '#DC2626' : '#D97706'}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.escalationTitle,
                    { color: isEmergency ? '#DC2626' : '#B45309' },
                  ]}
                >
                  ESCALATION: {soapData.escalationLevel}
                </Text>
              </View>

              {soapData.escalationReasons.map((reason, index) => (
                <View key={index} style={styles.reasonBullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))}

              {isEmergency && (
                <TouchableOpacity
                  style={[
                    styles.ackButton,
                    acknowledgedErc && styles.ackButtonActive,
                  ]}
                  onPress={() => setAcknowledgedErc(!acknowledgedErc)}
                >
                  <Ionicons
                    name={acknowledgedErc ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={acknowledgedErc ? '#059669' : '#DC2626'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.ackText}>
                    I acknowledge this emergency red flag and will notify ERC immediately.
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Follow-up Clarification Prompts (if any) */}
          {soapData.followUpPrompts && soapData.followUpPrompts.length > 0 && (
            <View style={styles.promptsCard}>
              <View style={styles.promptsHeader}>
                <Ionicons name="help-circle-outline" size={18} color="#0891B2" style={{ marginRight: 6 }} />
                <Text style={styles.promptsTitle}>Suggested Clarifications</Text>
              </View>
              <Text style={styles.promptsSub}>Gaps observed in dictation (optional):</Text>
              {soapData.followUpPrompts.map((prompt, idx) => (
                <View key={idx} style={styles.promptChip}>
                  <Text style={styles.promptNumber}>{idx + 1}.</Text>
                  <Text style={styles.promptChipText}>{prompt}</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'soap' ? (
            /* 4 Pillars of SOAP */
            <View style={styles.soapSections}>
              {/* S: Subjective */}
              <View style={styles.soapSectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.letterBadge, { backgroundColor: '#EEF2FF' }]}>
                    <Text style={[styles.letterBadgeText, { color: '#4F46E5' }]}>S</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Subjective</Text>
                  <Text style={styles.sectionCaption}>(Beneficiary words & feelings)</Text>
                </View>
                <Text style={styles.sectionBody}>{soapData.subjective || 'Not recorded'}</Text>
              </View>

              {/* O: Objective */}
              <View style={styles.soapSectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.letterBadge, { backgroundColor: '#ECFDF5' }]}>
                    <Text style={[styles.letterBadgeText, { color: '#059669' }]}>O</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Objective</Text>
                  <Text style={styles.sectionCaption}>(Measured vitals & observations)</Text>
                </View>
                <Text style={styles.sectionBody}>{soapData.objective || 'Not recorded'}</Text>
              </View>

              {/* A: Assessment */}
              <View style={styles.soapSectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.letterBadge, { backgroundColor: '#FFFBEB' }]}>
                    <Text style={[styles.letterBadgeText, { color: '#D97706' }]}>A</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  <Text style={styles.sectionCaption}>(Status vs baseline — No diagnosis)</Text>
                </View>
                <Text style={styles.sectionBody}>{soapData.assessment || 'Stable'}</Text>
              </View>

              {/* P: Plan */}
              <View style={styles.soapSectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.letterBadge, { backgroundColor: '#F5F3FF' }]}>
                    <Text style={[styles.letterBadgeText, { color: '#7C3AED' }]}>P</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  <Text style={styles.sectionCaption}>(Action items, owner & due dates)</Text>
                </View>
                <Text style={styles.sectionBody}>{soapData.plan || 'Routine monitoring'}</Text>
              </View>
            </View>
          ) : (
            /* Family Connect Preview */
            <View style={styles.familyCard}>
              <View style={styles.familyHeader}>
                <Ionicons name="people-circle-outline" size={24} color="#EA580C" style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.familyTitle}>Family Connect Update</Text>
                  <Text style={styles.familySub}>Reassuring update automatically sent to family</Text>
                </View>
              </View>
              <View style={styles.familySpeechBubble}>
                <Text style={styles.familyText}>{soapData.familyConnectSummary}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions Bar */}
        <View style={styles.modalBottomBar}>
          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissBtnText}>Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.appendBtn}
            onPress={handleConfirmAppend}
            disabled={isEmergency && !acknowledgedErc}
          >
            <Ionicons name="add-circle-outline" size={18} color="#4F46E5" style={{ marginRight: 4 }} />
            <Text style={styles.appendBtnText}>Append</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.applyBtn,
              isEmergency && !acknowledgedErc && { opacity: 0.5 },
            ]}
            onPress={handleConfirmReplace}
            disabled={isEmergency && !acknowledgedErc}
          >
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.applyBtnText}>Apply SOAP Note</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Poppins-Bold',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#EEF2FF',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
  },
  tabButtonTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  escalationBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  emergencyBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  warningBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  escalationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  escalationTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  reasonBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: '#DC2626',
    marginRight: 6,
  },
  reasonText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
    fontFamily: 'Poppins-Regular',
  },
  ackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  ackButtonActive: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  ackText: {
    fontSize: 12,
    color: '#1F2937',
    flex: 1,
    fontFamily: 'Poppins-Medium',
  },
  promptsCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  promptsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  promptsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
    fontFamily: 'Poppins-Bold',
  },
  promptsSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
    fontFamily: 'Poppins-Regular',
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  promptNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
    marginRight: 6,
  },
  promptChipText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    fontFamily: 'Poppins-Medium',
  },
  soapSections: {
    gap: 12,
  },
  soapSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  letterBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  letterBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Poppins-Bold',
    marginRight: 6,
  },
  sectionCaption: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Poppins-Regular',
  },
  sectionBody: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  familyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  familyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  familyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9A3412',
    fontFamily: 'Poppins-Bold',
  },
  familySub: {
    fontSize: 11,
    color: '#78716C',
    fontFamily: 'Poppins-Regular',
  },
  familySpeechBubble: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#EA580C',
  },
  familyText: {
    fontSize: 14,
    color: '#431407',
    lineHeight: 22,
    fontFamily: 'Poppins-Regular',
  },
  modalBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  dismissBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
  },
  appendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  appendBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
    fontFamily: 'Poppins-Medium',
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Poppins-Bold',
  },
});
