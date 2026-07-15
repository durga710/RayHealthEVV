import type { Ionicons } from '@expo/vector-icons';

export type IoniconName = keyof typeof Ionicons.glyphMap;

export type DialogVariant = 'confirm' | 'destructive' | 'success' | 'error' | 'info' | 'warning';
export type ToastVariant = 'success' | 'info' | 'warning';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertOptions {
  variant?: DialogVariant;
  /** Backdrop tap / Android back dismiss. Defaults to true, matching Alert.alert. */
  cancelable?: boolean;
  icon?: IoniconName;
  onDismiss?: () => void;
}

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  icon?: IoniconName;
  durationMs?: number;
}

export interface QueuedDialog {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  variant: DialogVariant;
  cancelable: boolean;
  icon?: IoniconName;
  onDismiss?: () => void;
}

export interface QueuedToast {
  id: number;
  message: string;
  variant: ToastVariant;
  icon?: IoniconName;
  durationMs: number;
}
