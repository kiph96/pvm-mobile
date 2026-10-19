import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t, useI18n } from '@/i18n';
import { cardShadow, useTheme, type Colors } from '@/theme';
import { errorMessage, initials } from '@/utils/format';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function toneColors(c: Colors, tone: Tone) {
  switch (tone) {
    case 'primary': return { fg: c.primary, bg: c.primarySoft };
    case 'accent': return { fg: c.accent, bg: c.accentSoft };
    case 'success': return { fg: c.success, bg: c.successSoft };
    case 'warning': return { fg: c.warning, bg: c.warningSoft };
    case 'danger': return { fg: c.danger, bg: c.dangerSoft };
    case 'info': return { fg: c.info, bg: c.infoSoft };
    default: return { fg: c.textMuted, bg: c.surfaceAlt };
  }
}

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
};

// ---------------------------------------------------------------- text
type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'small' | 'tiny';
export function Txt({ variant = 'body', muted, color, style, children, numberOfLines, center }: {
  variant?: Variant; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; children: React.ReactNode;
  numberOfLines?: number; center?: boolean;
}) {
  const { colors, font } = useTheme();
  return (
    <Text numberOfLines={numberOfLines}
      style={[font[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

// -------------------------------------------------------------- screen
export function Screen({ title, subtitle, right, children, onRefresh, refreshing = false, scroll = true, padded = true, onTitlePress, titleLabel }: {
  title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; onRefresh?: () => void;
  refreshing?: boolean; scroll?: boolean; padded?: boolean;
  /** makes the title a button with a ▾ (e.g. the store switcher); titleLabel is its accessibility label */
  onTitlePress?: () => void; titleLabel?: string;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const header = title ? (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Txt variant="small" muted>{subtitle}</Txt> : null}
        {onTitlePress ? (
          <Pressable onPress={onTitlePress} accessibilityRole="button" accessibilityLabel={titleLabel ?? title} hitSlop={6}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}>
            <Txt variant="title" style={{ flexShrink: 1 }}>{title}</Txt>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-down" size={16} color={colors.text} />
            </View>
          </Pressable>
        ) : <Txt variant="title">{title}</Txt>}
      </View>
      {right}
    </View>
  ) : null;
  const body = (
    <View style={[styles.content, padded && { paddingHorizontal: spacing.lg }, { maxWidth: 720, width: '100%', alignSelf: 'center' }]}>
      {header}
      {children}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xxl * 2, paddingTop: title ? 0 : insets.top }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}>
          {body}
        </ScrollView>
      ) : body}
    </View>
  );
}

// ---------------------------------------------------------------- card
export function Card({ children, onPress, style, tone }: {
  children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; tone?: Tone;
}) {
  const { colors, radius, spacing } = useTheme();
  const bg = tone ? toneColors(colors, tone).bg : colors.surface;
  const base: ViewStyle = { backgroundColor: bg, borderRadius: radius.lg, padding: spacing.lg, borderWidth: tone ? 0 : StyleSheet.hairlineWidth, borderColor: colors.border };
  if (!onPress) return <View style={[base, !tone && cardShadow(colors), style]}>{children}</View>;
  return (
    <Pressable onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [base, !tone && cardShadow(colors), pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, style]}>
      {children}
    </Pressable>
  );
}

// -------------------------------------------------------------- button
export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, small, style, full }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'; icon?: IconName;
  loading?: boolean; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle>; full?: boolean;
}) {
  const { colors, radius } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.textInverse, border: colors.primary },
    accent: { bg: colors.accent, fg: colors.textInverse, border: colors.accent },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable disabled={off} onPress={() => { tap(); onPress?.(); }} accessibilityRole="button"
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: palette.bg, borderColor: palette.border, borderWidth: 1, borderRadius: radius.md,
        paddingVertical: small ? 8 : 13, paddingHorizontal: small ? 12 : 18, opacity: off ? 0.5 : pressed ? 0.85 : 1,
        alignSelf: full ? 'stretch' : undefined,
      }, style]}>
      {loading ? <ActivityIndicator size="small" color={palette.fg} />
        : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={palette.fg} /> : null}
      <Text style={{ color: palette.fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, tone = 'neutral', badge }: {
  icon: IconName; onPress: () => void; label: string; tone?: Tone; badge?: number;
}) {
  const { colors } = useTheme();
  const t = toneColors(colors, tone);
  return (
    <Pressable accessibilityLabel={label} onPress={() => { tap(); onPress(); }} hitSlop={8}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'neutral' ? colors.surface : t.bg, borderWidth: tone === 'neutral' ? StyleSheet.hairlineWidth : 0, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={20} color={tone === 'neutral' ? colors.text : t.fg} />
      {badge ? (
        <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ------------------------------------------------------------ badges etc
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const { colors, radius } = useTheme();
  const t = toneColors(colors, tone);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
      {icon ? <Ionicons name={icon} size={12} color={t.fg} /> : null}
      <Text style={{ color: t.fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const AVATAR_TONES: Tone[] = ['primary', 'accent', 'info', 'warning', 'success'];
/** Initials in a coloured circle, or the picture at `uri` when there is one. */
export function Avatar({ name, size = 40, uri, square }: { name: string; size?: number; uri?: string | null; square?: boolean }) {
  const { colors } = useTheme();
  const tone = AVATAR_TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  const t = toneColors(colors, tone);
  const [broken, setBroken] = useState(false);
  if (uri && !broken) {
    return (
      <Image source={{ uri }} accessibilityLabel={name} onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: square ? size * 0.28 : size / 2, backgroundColor: colors.surfaceAlt }} />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.fg, fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

export function IconBubble({ icon, tone = 'primary', size = 40 }: { icon: IconName; tone?: Tone; size?: number }) {
  const { colors } = useTheme();
  const t = toneColors(colors, tone);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={t.fg} />
    </View>
  );
}

export function Row({ children, gap = 12, style, wrap }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Gap({ size = 12 }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function Section({ title, action, onAction, children, style }: {
  title: string; action?: string; onAction?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ marginTop: 24 }, style]}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <Txt variant="heading">{title}</Txt>
        {action ? (
          <Pressable onPress={() => { tap(); onAction?.(); }} hitSlop={8}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{action}</Text>
          </Pressable>
        ) : null}
      </Row>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

export function ListItem({ title, subtitle, left, right, onPress, chevron = !!onPress }: {
  title: string; subtitle?: string; left?: React.ReactNode; right?: React.ReactNode; onPress?: () => void; chevron?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={{ paddingVertical: 14 }}>
      <Row>
        {left}
        <View style={{ flex: 1 }}>
          <Txt variant="subheading" numberOfLines={1}>{title}</Txt>
          {subtitle ? <Txt variant="small" muted numberOfLines={2} style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
        </View>
        {right}
        {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
      </Row>
    </Card>
  );
}

export function Stat({ label, value, icon, tone = 'primary', onPress }: {
  label: string; value: string | number; icon: IconName; tone?: Tone; onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} style={{ flex: 1, minWidth: 96, gap: 10, padding: 14 }}>
      <IconBubble icon={icon} tone={tone} size={34} />
      <View>
        <Txt variant="heading">{value}</Txt>
        <Txt variant="small" muted>{label ?? t('common.loading')}</Txt>
      </View>
    </Card>
  );
}

// ------------------------------------------------------------- states
export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.primary} />
      <Txt variant="small" muted>{label ?? t('common.loading')}</Txt>
    </View>
  );
}

export function Empty({ icon = 'cafe-outline', title, message, action, onAction }: {
  icon?: IconName; title: string; message?: string; action?: string; onAction?: () => void;
}) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
      <IconBubble icon={icon} tone="accent" size={52} />
      <Txt variant="subheading" center>{title}</Txt>
      {message ? <Txt variant="small" muted center>{message}</Txt> : null}
      {action ? <Button title={action} onPress={onAction} small style={{ marginTop: 6 }} /> : null}
    </Card>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <Empty icon="cloud-offline-outline" title={t('common.couldNotLoad')}
      message={errorMessage(error)} action={onRetry ? t('common.tryAgain') : undefined} onAction={onRetry} />
  );
}

// -------------------------------------------------------------- inputs
export function Field({ label, hint, style, ...props }: TextInputProps & { label: string; hint?: string }) {
  const { colors, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="small" muted>{label ?? t('common.loading')}</Txt>
      <TextInput
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        {...props}
        style={[{
          backgroundColor: colors.surface, borderWidth: 1.5, borderColor: focused ? colors.primary : colors.border,
          borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text,
        }, style]} />
      {hint ? <Txt variant="small" muted>{hint}</Txt> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable onPress={() => { tap(); onPress(); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : colors.surface, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}>
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.textInverse : colors.textMuted} /> : null}
      <Text style={{ color: selected ? colors.textInverse : colors.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; badge?: number }[]; value: T; onChange: (v: T) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { tap(); onChange(o.value); }}
            style={[{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
              on && { backgroundColor: colors.surface, ...cardShadow(colors) }]}>
            <Text style={{ fontWeight: on ? '700' : '500', color: on ? colors.text : colors.textMuted, fontSize: 14 }}>{o.label}</Text>
            {o.badge ? <Badge label={String(o.badge)} tone="danger" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 99 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  const { colors } = useTheme();
  const btn = (icon: IconName, next: number, off: boolean) => (
    <Pressable disabled={off} onPress={() => { tap(); onChange(next); }}
      accessibilityRole="button" accessibilityLabel={`${label} ${icon === 'add' ? '+' : '−'}`}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, opacity: off ? 0.4 : 1 }}>
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Txt>{label}</Txt>
      <Row gap={14}>
        {btn('remove', value - 1, value <= min)}
        <Txt variant="subheading" style={{ minWidth: 24, textAlign: 'center' }}>{value}</Txt>
        {btn('add', value + 1, value >= max)}
      </Row>
    </Row>
  );
}

export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => { tap(); onChange(!value); }} accessibilityRole="switch" accessibilityLabel={label}
      accessibilityState={{ checked: value }} aria-checked={value}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt>{label}</Txt>
          {hint ? <Txt variant="small" muted>{hint}</Txt> : null}
        </View>
        <View style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? colors.primary : colors.border, alignItems: value ? 'flex-end' : 'flex-start' }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' }} />
        </View>
      </Row>
    </Pressable>
  );
}

// --------------------------------------------------------- staffing bar
export function StaffingBar({ assigned, min, optimal, max }: { assigned: number; min: number; optimal: number; max: number }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const tone = assigned < min ? colors.danger : assigned < optimal ? colors.warning : colors.success;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: max }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < assigned ? tone : colors.surfaceAlt,
            borderWidth: i === optimal - 1 && i >= assigned ? 1 : 0, borderColor: colors.border }} />
        ))}
      </View>
      <Txt variant="small" muted>{t('shiftCard.staffing', { assigned, max, min, opt: optimal })}</Txt>
    </View>
  );
}

// --------------------------------------------------------------- sheet
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { colors, radius } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,12,6,0.45)' }} onPress={onClose} />
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '88%',
          paddingBottom: insets.bottom + 16, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
          </View>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
            <Txt variant="heading">{title}</Txt>
            <IconButton icon="close" label={t('common.close')} onPress={onClose} />
          </Row>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Cross-platform confirmation dialog. */
interface ConfirmRequest { title: string; message: string; confirmLabel: string; destructive: boolean; resolve: (ok: boolean) => void }
let showConfirm: ((r: ConfirmRequest) => void) | null = null;

/**
 * Cross-platform confirmation. Phones use the native alert. On web we render our own dialog
 * (<ConfirmHost/>): window.confirm is blocked in many in-app browsers / web views and returns
 * false immediately, which silently cancelled actions such as signing out.
 */
export function confirm(title: string, message: string, confirmLabel = t('common.confirm'), destructive = false): Promise<boolean> {
  if (Platform.OS !== 'web') {
    return new Promise((resolve) => Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }));
  }
  const host = showConfirm;
  if (!host) return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => host({ title, message, confirmLabel, destructive, resolve }));
}

/** Renders confirm() dialogs on web. Mounted once in the root layout. */
export function ConfirmHost() {
  const { colors, radius } = useTheme();
  const { t } = useI18n();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  React.useEffect(() => {
    showConfirm = (r) => setRequest((current) => {
      current?.resolve(false); // a newer dialog replaces an unanswered one
      return r;
    });
    return () => { showConfirm = null; };
  }, []);
  const answer = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };
  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => answer(false)}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,12,6,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onPress={() => answer(false)}>
        {/* inner Pressable stops taps on the card from closing the dialog */}
        <Pressable onPress={() => undefined} accessibilityRole="alert"
          style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 22, gap: 12, width: '100%', maxWidth: 380 }}>
          <Txt variant="heading">{request?.title ?? ''}</Txt>
          <Txt muted>{request?.message ?? ''}</Txt>
          <Row gap={10} style={{ marginTop: 8 }}>
            <Button title={t('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={() => answer(false)} />
            <Button title={request?.confirmLabel ?? t('common.confirm')} variant={request?.destructive ? 'danger' : 'primary'}
              style={{ flex: 1 }} onPress={() => answer(true)} />
          </Row>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingBottom: 16 },
  content: {},
});
