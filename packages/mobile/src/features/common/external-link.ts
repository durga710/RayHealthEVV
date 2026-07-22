import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { showAppAlert } from './alerts/appAlert';
import { colors } from './tokens';
import type { IoniconName } from './alerts/types';

/** Human display form of a URL for link chips: no protocol, no trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Open a web page in the in-app browser sheet so the user never leaves the
 * app. Falls back to the system browser, then to an info dialog with the URL.
 */
export async function openInAppBrowser(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, {
      controlsColor: colors.brandBlue,
      toolbarColor: colors.cardBg,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  } catch {
    try {
      await Linking.openURL(url);
    } catch {
      showAppAlert('Unable to open page', `Visit ${displayUrl(url)} in your browser.`, undefined, {
        variant: 'info',
        icon: 'globe-outline',
      });
    }
  }
}

/**
 * Confirm-before-leaving popup for web links: shows the destination as a
 * tappable chip plus an "Open page" button. Nothing opens until the user
 * explicitly chooses to.
 */
export function confirmWebLink({
  title,
  message,
  url,
  icon,
}: {
  title: string;
  message: string;
  url: string;
  icon?: IoniconName;
}): void {
  showAppAlert(
    title,
    message,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open page', onPress: () => void openInAppBrowser(url) },
    ],
    {
      variant: 'info',
      icon,
      link: { label: displayUrl(url), onPress: () => void openInAppBrowser(url) },
    },
  );
}

/**
 * Confirm-before-leaving popup for email links: shows the address as a
 * tappable chip plus an "Open Mail" button that launches the mail composer.
 */
export function confirmEmail({
  title,
  message,
  email,
  subject,
  icon,
}: {
  title: string;
  message: string;
  email: string;
  subject?: string;
  icon?: IoniconName;
}): void {
  const mailto = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
  const openMail = () => {
    Linking.openURL(mailto).catch(() => {
      showAppAlert('Unable to open mail app', `Email us at ${email}`, undefined, {
        variant: 'info',
        icon: icon ?? 'mail-outline',
      });
    });
  };
  showAppAlert(
    title,
    message,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Mail', onPress: openMail },
    ],
    {
      variant: 'info',
      icon,
      link: { label: email, onPress: openMail },
    },
  );
}
