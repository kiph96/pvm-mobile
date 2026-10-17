import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { errorMessage } from '@/utils/format';

type Kind = 'success' | 'error' | 'info';
interface ToastState { message: string; kind: Kind }

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((message: string, kind: Kind = 'success') => {
    clearTimeout(timer.current);
    setToast({ message, kind });
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
    }, kind === 'error' ? 4200 : 2400);
  }, [opacity]);

  const tone = toast?.kind === 'error' ? colors.danger : toast?.kind === 'info' ? colors.info : colors.primary;
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="none"
          style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 84, alignItems: 'center', opacity }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.text, borderRadius: 14,
            paddingHorizontal: 16, paddingVertical: 12, maxWidth: 520 }}>
            <Ionicons name={toast.kind === 'error' ? 'alert-circle' : toast.kind === 'info' ? 'information-circle' : 'checkmark-circle'} size={20} color={tone} />
            <Text style={{ color: colors.background, fontWeight: '600', flexShrink: 1 }}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/**
 * Runs a write call, then refreshes every query and shows a toast.
 * Returns [run, busyKey] so a screen can show a spinner on the pressed button.
 */
export function useAction() {
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async <R,>(key: string, fn: () => Promise<R>, success?: string | ((r: R) => string)): Promise<R | undefined> => {
    setBusy(key);
    try {
      const r = await fn();
      await qc.invalidateQueries();
      if (success) toast(typeof success === 'function' ? success(r) : success);
      return r;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return undefined;
    } finally {
      setBusy(null);
    }
  }, [qc, toast]);
  return [run, busy] as const;
}
