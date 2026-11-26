import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  AlertButton,
  AlertOptions as RNAlertOptions,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

type AlertTone = 'info' | 'success' | 'error' | 'warning';

interface InternalAlertPayload {
  title: string;
  message?: string;
  type: AlertTone;
  buttons: AlertButton[];
  cancelable?: boolean;
  onDismiss?: () => void;
}

interface CustomAlertContextType {
  showAlert: (title: string, message: string, type?: AlertTone) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string) => void;
}

const CustomAlertContext = createContext<CustomAlertContextType | undefined>(undefined);

const nativeAlert = Alert.alert.bind(Alert);
let globalAlertDispatcher: ((payload: InternalAlertPayload) => void) | null = null;
let isGlobalAlertInstalled = false;

function inferAlertTone(title: string, buttons?: AlertButton[]): AlertTone {
  const lower = (title || '').toLowerCase();

  if (
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('invalid') ||
    lower.includes('unauthorized') ||
    lower.includes('unavailable') ||
    lower.includes('not found')
  ) {
    return 'error';
  }

  const hasDestructive = buttons?.some((b) => b.style === 'destructive');
  if (
    hasDestructive ||
    lower.includes('warning') ||
    lower.includes('view-only') ||
    lower.includes('exhausted') ||
    lower.includes('cannot') ||
    lower.includes('delete') ||
    lower.includes('remove') ||
    lower.includes('limit') ||
    lower.includes('no saathi')
  ) {
    return 'warning';
  }

  if (
    lower.includes('success') ||
    lower.includes('saved') ||
    lower.includes('recorded') ||
    lower.includes('activated') ||
    lower.includes('confirmed') ||
    lower.includes('assigned') ||
    lower.includes('approved') ||
    lower.includes('sent') ||
    lower.includes('updated') ||
    title.trim().startsWith('✅')
  ) {
    return 'success';
  }

  return 'info';
}

function cleanDisplayTitle(title: string): string {
  return (title || '').replace(/^✅\s*/, '').trim();
}

function installGlobalAlertOverride() {
  if (isGlobalAlertInstalled) return;
  isGlobalAlertInstalled = true;

  Alert.alert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: RNAlertOptions
  ) => {
    if (!globalAlertDispatcher) {
      nativeAlert(title, message, buttons, options);
      return;
    }

    const normalizedButtons: AlertButton[] =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: 'OK', style: 'default' }];

    globalAlertDispatcher({
      title: cleanDisplayTitle(title),
      message: message || undefined,
      type: inferAlertTone(title, normalizedButtons),
      buttons: normalizedButtons,
      cancelable: options?.cancelable,
      onDismiss: options?.onDismiss,
    });
  };
}

export function CustomAlertProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<InternalAlertPayload>({
    title: '',
    message: '',
    type: 'info',
    buttons: [{ text: 'OK', style: 'default' }],
  });
  const queueRef = useRef<InternalAlertPayload[]>([]);
  const isVisibleRef = useRef(false);

  const presentNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      isVisibleRef.current = true;
      setCurrent(next);
      setVisible(true);
    } else {
      isVisibleRef.current = false;
      setVisible(false);
    }
  }, []);

  const enqueueAlert = useCallback((payload: InternalAlertPayload) => {
    if (!isVisibleRef.current) {
      isVisibleRef.current = true;
      setCurrent(payload);
      setVisible(true);
    } else {
      queueRef.current.push(payload);
    }
  }, []);

  useEffect(() => {
    installGlobalAlertOverride();
    globalAlertDispatcher = enqueueAlert;
    return () => {
      if (globalAlertDispatcher === enqueueAlert) {
        globalAlertDispatcher = null;
      }
    };
  }, [enqueueAlert]);

  const showAlert = useCallback(
    (title: string, message: string, type: AlertTone = 'info') => {
      enqueueAlert({
        title: cleanDisplayTitle(title),
        message,
        type,
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
    [enqueueAlert]
  );

  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void, confirmText = 'Confirm') => {
      enqueueAlert({
        title: cleanDisplayTitle(title),
        message,
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: confirmText, style: 'destructive', onPress: onConfirm },
        ],
      });
    },
    [enqueueAlert]
  );

  const handleButtonPress = (btn?: AlertButton) => {
    presentNext();
    if (btn?.onPress) {
      btn.onPress();
    }
  };

  const handleDismiss = () => {
    if (current.cancelable === false) return;
    const cancelBtn = current.buttons.find((b) => b.style === 'cancel');
    const onDismiss = current.onDismiss;
    presentNext();
    if (cancelBtn?.onPress) {
      cancelBtn.onPress();
    } else if (onDismiss) {
      onDismiss();
    }
  };

  const getToneVisuals = (tone: AlertTone) => {
    switch (tone) {
      case 'success':
        return { icon: 'check-circle' as const, color: '#059669', bg: '#ECFDF5' };
      case 'error':
        return { icon: 'alert-circle' as const, color: '#DC2626', bg: '#FEF2F2' };
      case 'warning':
        return { icon: 'alert-triangle' as const, color: '#D97706', bg: '#FFFBEB' };
      default:
        return { icon: 'info' as const, color: '#FE6700', bg: '#FFF5ED' };
    }
  };

  const visuals = getToneVisuals(current.type);

  // Order 2-button layout so Cancel appears on the left and Primary/Destructive on the right
  const orderedButtons = (() => {
    if (current.buttons.length === 2) {
      const cancelIdx = current.buttons.findIndex((b) => b.style === 'cancel');
      if (cancelIdx === 1) {
        return [current.buttons[1], current.buttons[0]];
      }
      return current.buttons;
    }
    if (current.buttons.length >= 3) {
      const nonCancel = current.buttons.filter((b) => b.style !== 'cancel');
      const cancels = current.buttons.filter((b) => b.style === 'cancel');
      return [...nonCancel, ...cancels];
    }
    return current.buttons;
  })();

  const renderButtons = () => {
    if (orderedButtons.length <= 1) {
      const btn = orderedButtons[0] || { text: 'OK', style: 'default' };
      const isDestructive = btn.style === 'destructive';
      return (
        <TouchableOpacity
          style={[styles.singleBtn, isDestructive ? styles.destructiveBtn : styles.primaryBtn]}
          onPress={() => handleButtonPress(btn)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{btn.text || 'OK'}</Text>
        </TouchableOpacity>
      );
    }

    if (orderedButtons.length === 2) {
      return (
        <View style={styles.buttonRow}>
          {orderedButtons.map((btn, idx) => {
            const isCancel = btn.style === 'cancel';
            const isDestructive = btn.style === 'destructive';
            return (
              <TouchableOpacity
                key={`${btn.text || 'btn'}-${idx}`}
                style={[
                  styles.rowBtn,
                  isCancel
                    ? styles.cancelBtn
                    : isDestructive
                    ? styles.destructiveBtn
                    : styles.primaryBtn,
                ]}
                onPress={() => handleButtonPress(btn)}
                activeOpacity={0.85}
              >
                <Text
                  style={
                    isCancel ? styles.cancelBtnText : styles.primaryBtnText
                  }
                  numberOfLines={1}
                >
                  {btn.text || (isCancel ? 'Cancel' : 'OK')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // 3+ buttons stacked vertically
    return (
      <View style={styles.buttonStack}>
        {orderedButtons.map((btn, idx) => {
          const isCancel = btn.style === 'cancel';
          const isDestructive = btn.style === 'destructive';
          return (
            <TouchableOpacity
              key={`${btn.text || 'btn'}-${idx}`}
              style={[
                styles.stackBtn,
                isCancel
                  ? styles.cancelBtn
                  : isDestructive
                  ? styles.destructiveBtn
                  : styles.primaryBtn,
              ]}
              onPress={() => handleButtonPress(btn)}
              activeOpacity={0.85}
            >
              <Text style={isCancel ? styles.cancelBtnText : styles.primaryBtnText}>
                {btn.text || 'OK'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <CustomAlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={handleDismiss}
      >
        <Pressable style={styles.overlay} onPress={handleDismiss}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.iconBadge, { backgroundColor: visuals.bg }]}>
              <Feather name={visuals.icon} size={26} color={visuals.color} />
            </View>

            {current.title ? <Text style={styles.title}>{current.title}</Text> : null}
            {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

            {renderButtons()}
          </Pressable>
        </Pressable>
      </Modal>
    </CustomAlertContext.Provider>
  );
}

export const useCustomAlert = () => {
  const context = useContext(CustomAlertContext);
  if (!context) {
    throw new Error('useCustomAlert must be used within a CustomAlertProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 348,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3ECE5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  buttonStack: {
    width: '100%',
    gap: 10,
  },
  rowBtn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackBtn: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleBtn: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: '#FE6700',
  },
  destructiveBtn: {
    backgroundColor: '#DC2626',
  },
  primaryBtnText: {
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    fontFamily: 'Poppins-SemiBold',
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
});
