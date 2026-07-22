import type { AlertButton, AlertOptions, QueuedDialog, QueuedToast, ToastOptions } from './types';

// Module-level controller registered by <AppAlertProvider/> in app/_layout.tsx , 
// mirrors the setUnauthorizedHandler pattern in ../../../lib/api-client.ts.
// An imperative singleton (not a hook) is required, not just convenient:
// notification-permissions.ts calls showAppAlert from a plain async module
// function with no component to call a hook from.
interface AlertController {
  pushDialog: (dialog: QueuedDialog) => void;
  pushToast: (toast: QueuedToast) => void;
}

let controller: AlertController | null = null;
let nextId = 1;

export function __registerAppAlertController(next: AlertController | null): void {
  controller = next;
}

function defaultToastDuration(message: string): number {
  const extra = Math.max(0, message.length - 20) * 30;
  return Math.min(4500, 2200 + extra);
}

/**
 * Drop-in replacement for RN's Alert.alert(title, message?, buttons?, options?).
 * Most call sites swap the import and add a `variant` to the 4th argument.
 */
export function showAppAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
): void {
  if (!controller) return;
  const resolvedButtons: AlertButton[] = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  controller.pushDialog({
    id: nextId++,
    title,
    message,
    buttons: resolvedButtons,
    variant: options?.variant ?? 'info',
    cancelable: options?.cancelable ?? true,
    icon: options?.icon,
    link: options?.link,
    onDismiss: options?.onDismiss,
  });
}

export function showAppToast(options: ToastOptions): void {
  if (!controller) return;
  controller.pushToast({
    id: nextId++,
    message: options.message,
    variant: options.variant ?? 'success',
    icon: options.icon,
    durationMs: options.durationMs ?? defaultToastDuration(options.message),
  });
}
