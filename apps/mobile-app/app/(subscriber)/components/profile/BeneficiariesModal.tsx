import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { API_URL } from '@/constants/api';
import { scale } from '@/utils/responsive';

export interface BeneficiaryItemData {
  id: string;
  name: string;
  age?: number;
  relationship?: string;
  photo?: string | null;
  isActive?: boolean;
  status?: string; // 'active' | 'inactive' | 'deleted'
  gender?: string;
  subscriptions?: Array<{
    id: string;
    packageType?: string;
    isActive?: boolean;
    package?: { name?: string };
  }>;
}

interface BeneficiariesModalProps {
  visible: boolean;
  onClose: () => void;
  beneficiaries: BeneficiaryItemData[];
  onSelectBeneficiary?: (beneficiaryId: string) => void;
  onRefresh?: () => void;
  hasUnassignedPackage?: boolean;
}

type FilterTab = 'all' | 'active' | 'inactive';

export const BeneficiariesModal: React.FC<BeneficiariesModalProps> = ({
  visible,
  onClose,
  beneficiaries = [],
  onSelectBeneficiary,
  onRefresh,
  hasUnassignedPackage,
}) => {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [localBeneficiaries, setLocalBeneficiaries] = useState<BeneficiaryItemData[]>(beneficiaries);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<BeneficiaryItemData | null>(null);
  const [hasUnassigned, setHasUnassigned] = useState<boolean>(Boolean(hasUnassignedPackage));
  const [isCheckingUnassigned, setIsCheckingUnassigned] = useState(false);
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  useEffect(() => {
    setLocalBeneficiaries(beneficiaries);
  }, [beneficiaries]);

  useEffect(() => {
    if (typeof hasUnassignedPackage === 'boolean') {
      setHasUnassigned(hasUnassignedPackage);
    }
  }, [hasUnassignedPackage]);

  useEffect(() => {
    if (visible) {
      checkUnassignedStatus();
    }
  }, [visible]);

  const checkUnassignedStatus = async () => {
    try {
      setIsCheckingUnassigned(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      const res = await fetch(`${API_URL}/subscriber/subscriptions/unlinked-check`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        setHasUnassigned(Boolean(data.hasUnlinkedSubscription));
      }
    } catch (e) {
      console.warn('[BeneficiariesModal] Failed to check unlinked subscription:', e);
    } finally {
      setIsCheckingUnassigned(false);
    }
  };

  const handleAddNewBeneficiary = () => {
    if (!hasUnassigned) {
      Alert.alert(
        'Package Required',
        'You need an active unassigned care package before you can add a new beneficiary. Please purchase a package first.'
      );
      return;
    }
    onClose();
    router.push({
      pathname: '/(setup)/subscribe-form',
      params: { isLinkingFlow: 'true' },
    });
  };

  const isBenActive = (b: BeneficiaryItemData): boolean => {
    // If explicitly deleted or inactive by status field, not active
    if (b.status === 'deleted' || b.status === 'inactive') return false;
    if (b.isActive === false) return false;
    if (Array.isArray(b.subscriptions)) {
      return b.subscriptions.some((s) => Boolean(s.isActive));
    }
    return Boolean(b.isActive);
  };

  const activeCount = useMemo(() => {
    return localBeneficiaries.filter((b) => isBenActive(b)).length;
  }, [localBeneficiaries]);

  const inactiveCount = useMemo(() => {
    return localBeneficiaries.filter((b) => !isBenActive(b)).length;
  }, [localBeneficiaries]);

  const filteredBeneficiaries = useMemo(() => {
    return localBeneficiaries.filter((b) => {
      // 1. Tab filter
      const active = isBenActive(b);
      if (activeFilter === 'active' && !active) return false;
      if (activeFilter === 'inactive' && active) return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (b.name || '').toLowerCase().includes(q);
        const relMatch = (b.relationship || '').toLowerCase().includes(q);
        const ageMatch = String(b.age || '').includes(q);
        return nameMatch || relMatch || ageMatch;
      }
      return true;
    });
  }, [localBeneficiaries, activeFilter, searchQuery]);

  const getInitials = (name: string) => {
    if (!name) return 'B';
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleBeneficiaryPress = async (b: BeneficiaryItemData) => {
    onClose();
    try {
      await AsyncStorage.setItem('selectedBeneficiaryId', b.id);
      if (onSelectBeneficiary) {
        onSelectBeneficiary(b.id);
      }
    } catch (e) {
      console.warn('Error selecting beneficiary:', e);
    }
  };

  const executeDeleteBeneficiary = async (beneficiaryId: string, name: string) => {
    setDeletingId(beneficiaryId);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setFeedback({
          title: 'Session Expired',
          message: 'Authentication session expired. Please log in again.',
          type: 'error',
        });
        return;
      }

      const res = await fetch(`${API_URL}/subscriber/beneficiaries/${beneficiaryId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Remove locally
        setLocalBeneficiaries((prev) => prev.filter((b) => b.id !== beneficiaryId));
        
        // Clear if it was the selected one
        const currentSelected = await AsyncStorage.getItem('selectedBeneficiaryId');
        if (currentSelected === beneficiaryId) {
          await AsyncStorage.removeItem('selectedBeneficiaryId');
        }

        setFeedback({
          title: 'Beneficiary Removed',
          message: `${name || 'Beneficiary'} has been removed successfully.`,
          type: 'success',
        });

        if (onRefresh) {
          onRefresh();
        }
      } else {
        const errorMsg = data.message || 'Could not delete beneficiary.';
        setFeedback({
          title: 'Delete Failed',
          message: errorMsg,
          type: 'error',
        });
      }
    } catch (error: any) {
      console.error('[BeneficiariesModal] Delete error:', error);
      setFeedback({
        title: 'Error',
        message: 'Network error while removing beneficiary. Please try again.',
        type: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteBeneficiary = (item: BeneficiaryItemData) => {
    const isSelf = (item.relationship || '').toLowerCase() === 'self';
    if (isSelf) {
      setFeedback({
        title: 'Cannot Delete Self Profile',
        message: 'Your personal subscriber profile cannot be removed as a beneficiary.',
        type: 'warning',
      });
      return;
    }
    setItemToDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const target = itemToDelete;
    await executeDeleteBeneficiary(target.id, target.name);
    setItemToDelete(null);
  };

  const renderBeneficiaryCard = ({ item }: { item: BeneficiaryItemData }) => {
    const active = isBenActive(item);
    const activeSub = (item.subscriptions || []).find((s) => s.isActive);
    const packageName = activeSub?.package?.name || activeSub?.packageType;
    const isSelf = (item.relationship || '').toLowerCase() === 'self';
    const isDeleting = deletingId === item.id;

    return (
      <View style={[styles.benCard, !active && styles.benCardInactive]}>
        <TouchableOpacity
          style={styles.cardMainTouchable}
          activeOpacity={0.7}
          onPress={() => handleBeneficiaryPress(item)}
        >
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {item.photo ? (
              <Image
                source={{ uri: sanitizeImageUri(item.photo) }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={[styles.avatarFallback, isSelf && styles.avatarSelf]}>
                <Text style={[styles.avatarInitials, isSelf && styles.avatarSelfText]}>
                  {getInitials(item.name)}
                </Text>
              </View>
            )}
            {/* Dot Indicator on Avatar */}
            <View
              style={[
                styles.avatarStatusDot,
                active ? styles.dotActive : styles.dotInactive,
              ]}
            />
          </View>

          {/* Info Column */}
          <View style={styles.infoCol}>
            <View style={styles.nameRow}>
              <Text style={styles.benName} numberOfLines={1}>
                {item.name}
              </Text>
              {isSelf && (
                <View style={styles.selfBadge}>
                  <Text style={styles.selfBadgeText}>Self</Text>
                </View>
              )}
            </View>

            <Text style={styles.benSubText}>
              {item.relationship ? `${item.relationship}` : 'Beneficiary'}
              {item.age ? ` • ${item.age} yrs` : ''}
              {item.gender ? ` • ${item.gender.charAt(0).toUpperCase() + item.gender.slice(1)}` : ''}
            </Text>

            {packageName && (
              <View style={styles.planBadgeRow}>
                <Ionicons name="shield-checkmark" size={scale(12)} color="#059669" />
                <Text style={styles.planBadgeText} numberOfLines={1}>
                  {packageName}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Right Actions Column */}
        <View style={styles.actionsCol}>
          <View style={[styles.statusPill, active ? styles.statusPillActive : styles.statusPillInactive]}>
            <View style={[styles.miniDot, active ? styles.miniDotActive : styles.miniDotInactive]} />
            <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextInactive]}>
              {active ? 'Active' : 'Inactive'}
            </Text>
          </View>

          {/* Delete Action (for non-Self beneficiaries) */}
          {!isSelf && (
            <TouchableOpacity
              style={styles.deleteIconBtn}
              onPress={() => handleDeleteBeneficiary(item)}
              hitSlop={{ top: scale(8), bottom: scale(8), left: scale(8), right: scale(8) }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Ionicons name="trash-outline" size={scale(18)} color="#EF4444" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdropDismiss}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sheetContainer, { maxHeight: height * 0.88 }]}>
          {/* Top Grab Handle */}
          <View style={styles.grabHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.title}>All Beneficiaries</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{localBeneficiaries.length}</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                Manage, select, or delete beneficiary members
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: scale(12), bottom: scale(12), left: scale(12), right: scale(12) }}
            >
              <Feather name="x" size={scale(20)} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={scale(18)} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, relation or age..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: scale(4) }}>
                <Feather name="x-circle" size={scale(16)} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'all' && styles.filterPillSelected]}
              onPress={() => setActiveFilter('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextSelected]}>
                All ({localBeneficiaries.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === 'active' && styles.filterPillSelected,
              ]}
              onPress={() => setActiveFilter('active')}
              activeOpacity={0.7}
            >
              <View style={[styles.pillDot, styles.miniDotActive]} />
              <Text style={[styles.filterPillText, activeFilter === 'active' && styles.filterPillTextSelected]}>
                Active ({activeCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                activeFilter === 'inactive' && styles.filterPillSelected,
              ]}
              onPress={() => setActiveFilter('inactive')}
              activeOpacity={0.7}
            >
              <View style={[styles.pillDot, styles.miniDotInactive]} />
              <Text style={[styles.filterPillText, activeFilter === 'inactive' && styles.filterPillTextSelected]}>
                Inactive ({inactiveCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Beneficiaries FlatList */}
          <FlatList
            data={filteredBeneficiaries}
            keyExtractor={(item) => item.id}
            renderItem={renderBeneficiaryCard}
            contentContainerStyle={[
              styles.listContent,
              !hasUnassigned && { paddingBottom: Platform.OS === 'ios' ? scale(32) : scale(20) },
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={scale(44)} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No beneficiaries found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? `No results matching "${searchQuery}"`
                    : activeFilter === 'inactive'
                    ? 'No inactive beneficiaries'
                    : 'No beneficiaries registered yet'}
                </Text>
              </View>
            }
          />

          {/* Bottom Add Action - Only visible and functional if subscriber has an unassigned package */}
          {hasUnassigned && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.addBtn}
                activeOpacity={0.8}
                onPress={handleAddNewBeneficiary}
              >
                <Ionicons name="person-add-outline" size={scale(18)} color="#FFFFFF" style={{ marginRight: scale(8) }} />
                <Text style={styles.addBtnText}>Add New Beneficiary</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Custom Delete Confirmation Modal UI */}
          {itemToDelete && (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmCard}>
                <View style={styles.confirmIconContainer}>
                  <Feather name="alert-triangle" size={scale(36)} color="#D97706" />
                </View>
                <Text style={styles.confirmTitle}>Delete Beneficiary</Text>
                <Text style={styles.confirmMessage}>
                  Are you sure you want to delete <Text style={{ fontWeight: '700', color: '#111827' }}>{itemToDelete.name}</Text>? Deleting this profile will delete the beneficiary account and the beneficiary will lose access.
                </Text>

                <View style={styles.confirmBtnRow}>
                  <TouchableOpacity
                    style={styles.confirmCancelBtn}
                    onPress={() => !deletingId && setItemToDelete(null)}
                    disabled={!!deletingId}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmDeleteBtn, !!deletingId && { opacity: 0.7 }]}
                    onPress={handleConfirmDelete}
                    disabled={!!deletingId}
                    activeOpacity={0.7}
                  >
                    {deletingId ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmDeleteBtnText}>Delete</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Custom Feedback Dialog Modal UI (Success / Error / Warning) */}
          {feedback && (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmCard}>
                <View style={styles.confirmIconContainer}>
                  {feedback.type === 'success' && (
                    <Feather name="check-circle" size={scale(38)} color="#059669" />
                  )}
                  {feedback.type === 'error' && (
                    <Feather name="alert-circle" size={scale(38)} color="#DC2626" />
                  )}
                  {feedback.type === 'warning' && (
                    <Feather name="alert-triangle" size={scale(38)} color="#D97706" />
                  )}
                  {feedback.type === 'info' && (
                    <Feather name="info" size={scale(38)} color="#2563EB" />
                  )}
                </View>
                <Text style={styles.confirmTitle}>{feedback.title}</Text>
                <Text style={styles.confirmMessage}>{feedback.message}</Text>

                <TouchableOpacity
                  style={[
                    styles.confirmOkBtn,
                    feedback.type === 'success' && { backgroundColor: '#059669' },
                    feedback.type === 'error' && { backgroundColor: '#DC2626' },
                  ]}
                  onPress={() => setFeedback(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmOkBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: scale(10),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  grabHandle: {
    width: scale(40),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: scale(10),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
    paddingBottom: scale(12),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  title: {
    fontSize: scale(20),
    fontWeight: '700',
    color: '#111827',
  },
  countBadge: {
    backgroundColor: '#FFF2E8',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: '#FFD8BF',
  },
  countBadgeText: {
    fontSize: scale(12),
    fontWeight: '700',
    color: '#EA580C',
  },
  subtitle: {
    fontSize: scale(13),
    color: '#6B7280',
    marginTop: scale(2),
  },
  closeBtn: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: scale(20),
    paddingHorizontal: scale(12),
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: scale(12),
  },
  searchIcon: {
    marginRight: scale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: scale(14),
    color: '#111827',
    padding: 0,
  },
  filterPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: scale(20),
    gap: scale(8),
    marginBottom: scale(14),
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: scale(7),
    borderRadius: scale(20),
    backgroundColor: '#F3F4F6',
  },
  filterPillSelected: {
    backgroundColor: '#111827',
  },
  filterPillText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#4B5563',
  },
  filterPillTextSelected: {
    color: '#FFFFFF',
  },
  pillDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    marginRight: scale(6),
  },
  listContent: {
    paddingHorizontal: scale(20),
    paddingBottom: scale(16),
    gap: scale(10),
  },
  benCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(14),
    padding: scale(12),
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  benCardInactive: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E5E7EB',
    opacity: 0.9,
  },
  cardMainTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: scale(12),
  },
  avatarImg: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: '#E5E7EB',
  },
  avatarFallback: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: '#FFF5ED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  avatarSelf: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  avatarInitials: {
    fontSize: scale(16),
    fontWeight: '700',
    color: '#EA580C',
  },
  avatarSelfText: {
    color: '#2563EB',
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dotActive: {
    backgroundColor: '#10B981',
  },
  dotInactive: {
    backgroundColor: '#9CA3AF',
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  benName: {
    fontSize: scale(15),
    fontWeight: '700',
    color: '#111827',
    maxWidth: '80%',
  },
  selfBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: scale(6),
    paddingVertical: 1,
    borderRadius: scale(6),
  },
  selfBadgeText: {
    fontSize: scale(10),
    fontWeight: '700',
    color: '#2563EB',
  },
  benSubText: {
    fontSize: scale(12),
    color: '#6B7280',
    marginTop: scale(2),
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginTop: scale(4),
  },
  planBadgeText: {
    fontSize: scale(11),
    fontWeight: '600',
    color: '#059669',
  },
  actionsCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: scale(8),
    gap: scale(8),
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(10),
  },
  statusPillActive: {
    backgroundColor: '#ECFDF5',
  },
  statusPillInactive: {
    backgroundColor: '#F3F4F6',
  },
  miniDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    marginRight: scale(5),
  },
  miniDotActive: {
    backgroundColor: '#10B981',
  },
  miniDotInactive: {
    backgroundColor: '#9CA3AF',
  },
  statusText: {
    fontSize: scale(11),
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#059669',
  },
  statusTextInactive: {
    color: '#6B7280',
  },
  deleteIconBtn: {
    padding: scale(5),
    borderRadius: scale(8),
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(40),
  },
  emptyTitle: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#374151',
    marginTop: scale(10),
  },
  emptySubtitle: {
    fontSize: scale(13),
    color: '#9CA3AF',
    marginTop: scale(4),
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: scale(20),
    paddingTop: scale(12),
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5B0A',
    borderRadius: scale(12),
    paddingVertical: scale(13),
  },
  addBtnText: {
    fontSize: scale(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
    zIndex: 999,
    elevation: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    paddingHorizontal: scale(24),
    paddingVertical: scale(24),
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(6) },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 10,
  },
  confirmIconContainer: {
    marginBottom: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(8),
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: scale(14),
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: scale(22),
    marginBottom: scale(22),
  },
  confirmBtnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: scale(12),
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: scale(12),
    borderRadius: scale(10),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelBtnText: {
    color: '#4B5563',
    fontSize: scale(15),
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: scale(12),
    borderRadius: scale(10),
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteBtnText: {
    color: '#FFFFFF',
    fontSize: scale(15),
    fontWeight: '600',
  },
  confirmOkBtn: {
    width: '100%',
    paddingVertical: scale(12),
    borderRadius: scale(10),
    backgroundColor: '#FF5B0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmOkBtnText: {
    color: '#FFFFFF',
    fontSize: scale(15),
    fontWeight: '700',
  },
});

export default BeneficiariesModal;
