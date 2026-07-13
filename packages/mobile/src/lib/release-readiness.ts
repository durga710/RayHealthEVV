type JsonRecord = Record<string, unknown>;

export interface MobileReleaseReadinessInput {
  app: unknown;
  eas: unknown;
  apiClientSource: string;
  profileSource: string;
}

export interface MobileReleaseReadinessResult {
  errors: string[];
  externalBlockers: string[];
}

const REQUIRED_PRIVACY_DATA_TYPES = [
  'NSPrivacyCollectedDataTypeName',
  'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypePreciseLocation',
  'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeHealth',
] as const;

const REQUIRED_REASON_CATEGORIES = [
  'NSPrivacyAccessedAPICategoryDiskSpace',
  'NSPrivacyAccessedAPICategoryFileTimestamp',
  'NSPrivacyAccessedAPICategorySystemBootTime',
  'NSPrivacyAccessedAPICategoryUserDefaults',
] as const;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

export function validateMobileReleaseReadiness(
  input: MobileReleaseReadinessInput,
): MobileReleaseReadinessResult {
  const errors: string[] = [];
  const appRoot = record(input.app);
  const expo = record(appRoot.expo);
  const ios = record(expo.ios);
  const android = record(expo.android);
  const infoPlist = record(ios.infoPlist);
  const privacy = record(ios.privacyManifests);
  const eas = record(input.eas);
  const builds = record(eas.build);
  const production = record(builds.production);

  const serialized = JSON.stringify(input.app) + JSON.stringify(input.eas);
  if (/FILL_IN|YOUR_[A-Z0-9_]+|REPLACE_ME/i.test(serialized)) {
    errors.push('Committed mobile configuration contains placeholder values.');
  }
  if (!expo.name || !expo.slug || !expo.version || !expo.icon) {
    errors.push('Expo name, slug, version, and icon are required.');
  }
  if (!ios.bundleIdentifier || !android.package || ios.bundleIdentifier !== android.package) {
    errors.push('iOS bundleIdentifier and Android package must be present and identical.');
  }
  if (ios.supportsTablet !== false) {
    errors.push('iPad support must stay disabled until iPad screenshots and QA are complete.');
  }
  if (infoPlist.ITSAppUsesNonExemptEncryption !== false) {
    errors.push('iOS export-compliance exemption must be declared in Info.plist.');
  }

  const collectedTypes = Array.isArray(privacy.NSPrivacyCollectedDataTypes)
    ? privacy.NSPrivacyCollectedDataTypes.map((item) => String(record(item).NSPrivacyCollectedDataType ?? ''))
    : [];
  for (const dataType of REQUIRED_PRIVACY_DATA_TYPES) {
    if (!collectedTypes.includes(dataType)) errors.push(`iOS privacy manifest is missing ${dataType}.`);
  }
  if (privacy.NSPrivacyTracking !== false) {
    errors.push('iOS privacy manifest must explicitly declare tracking disabled.');
  }

  const accessedCategories = Array.isArray(privacy.NSPrivacyAccessedAPITypes)
    ? privacy.NSPrivacyAccessedAPITypes.map((item) => String(record(item).NSPrivacyAccessedAPIType ?? ''))
    : [];
  for (const category of REQUIRED_REASON_CATEGORIES) {
    if (!accessedCategories.includes(category)) errors.push(`iOS privacy manifest is missing ${category}.`);
  }

  if (!input.apiClientSource.includes('process.env.EXPO_PUBLIC_API_URL')) {
    errors.push('The mobile API client does not consume EXPO_PUBLIC_API_URL from EAS.');
  }
  if (!input.profileSource.includes('https://rayhealthevv.com/privacy')) {
    errors.push('The mobile profile does not expose the public privacy policy.');
  }
  for (const profileName of ['development', 'preview', 'production']) {
    const profile = record(builds[profileName]);
    if (profile.environment !== profileName) {
      errors.push(`EAS ${profileName} build must select the ${profileName} environment.`);
    }
  }
  if (production.autoIncrement !== true) {
    errors.push('EAS production builds must auto-increment store build numbers.');
  }
  const productionAndroid = record(production.android);
  if (productionAndroid.buildType !== 'app-bundle') {
    errors.push('Android production must build an app bundle.');
  }

  const externalBlockers = [
    'Create/link the EAS project and commit expo.extra.eas.projectId.',
    'Set EXPO_PUBLIC_API_URL and GOOGLE_MAPS_ANDROID_API_KEY in the EAS production environment.',
    'Create the App Store Connect app record and configure the Apple team in EAS credentials.',
    'Create the Google Play app record, enable Play App Signing, and upload its service account to EAS.',
    'Capture store screenshots with synthetic data and complete both stores’ privacy questionnaires.',
  ];

  if (record(record(expo.extra).eas).projectId) externalBlockers.shift();
  return { errors, externalBlockers };
}

export function formatMobileReleaseReadiness(result: MobileReleaseReadinessResult): string {
  const lines = result.errors.length === 0
    ? ['Mobile source release checks passed.']
    : ['Mobile source release checks failed:', ...result.errors.map((error) => `- ${error}`)];
  lines.push('External release steps:');
  lines.push(...result.externalBlockers.map((blocker) => `- ${blocker}`));
  return lines.join('\n');
}
