# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Shift-alert reminders (30 seconds before each shift)

The mobile app fires a vibration + banner exactly **30 seconds before** every
scheduled shift. Implementation lives in `src/lib/shift-alert-scheduler.ts`,
`src/lib/notification-permissions.ts`, and the dashboard screen at
`src/features/evv/DashboardScreen.tsx`.

### Permission flow

- On the first successful dashboard load after login, we call
  `ensureNotificationPermission()`.
- The user sees a short explainer (`Alert`): *"Allow notifications so we can
  remind you 30 seconds before each shift."*
- After they tap **Continue** we invoke `Notifications.requestPermissionsAsync()`.
- The resulting status (`granted` / `denied` / `undetermined`) is persisted in
  `expo-secure-store` under the key `rayhealth_notification_perm_v1`.
- On subsequent launches we **do not re-prompt**. We reconcile the cached
  value with `Notifications.getPermissionsAsync()` so changes the user makes
  in OS Settings flow back into the app state without an extra prompt.

### Scheduler idempotency

`scheduleShiftAlerts(assignments)` is safe to call on every dashboard refresh:

1. Read previously-scheduled notification IDs from
   `rayhealth_scheduled_shift_alerts_v1` (secure-store).
2. Cancel every one via `Notifications.cancelScheduledNotificationAsync`.
3. Walk the new assignment list. For each with a parseable ISO `time`,
   compute `triggerAt = time - 30_000ms`. If `triggerAt` is more than 5
   seconds in the future, schedule a notification and capture the new ID.
4. Persist the new ID list back to secure-store.

The 5-second buffer prevents the OS from firing a "trigger in the past"
notification instantly. Assignments without `time` or with a malformed
timestamp are silently skipped.

### Foreground vs background paths

- **Background / locked / app suspended:** the OS-scheduled local
  notification fires with `vibrate: [0, 500, 200, 500, 200, 500]`, the
  `shift-alerts-v2` Android channel (MAX importance), and the bundled
  `shift_alarm.wav` chime: a soft alarm that rings for ~28 seconds (iOS caps
  notification sounds at 30s). On Android the channel routes the sound
  through the ALARM audio stream, so it plays at alarm volume even when
  notification volume is low. Channels are immutable after creation, which
  is why the sound change shipped as a `-v2` channel; the old `shift-alerts`
  channel is deleted on the next `ensureShiftAlertChannel()` run. The custom
  sound requires a real build (the expo-notifications config plugin bundles
  it); Expo Go falls back to the default notification sound.
- **Foreground:** the app presents a full-screen in-app alarm overlay
  (`ShiftAlarmOverlay`, hosted by `ShiftAlarmHost` in `app/_layout.tsx`)
  instead of the small system banner: pulsing bell, live countdown, client
  details, a repeating haptic pulse, and two actions, "Go to clock-in" and
  "Dismiss". Two triggers converge on `presentShiftAlarm()`
  (`src/lib/shift-alarm.ts`): the `addNotificationReceivedListener` in the
  root layout (fires on any screen when the scheduled notification is
  delivered while foregrounded; the notification handler suppresses the
  banner for shift alerts but keeps the chime playing) and the dashboard's
  5-second interval tick (covers Expo Go on Android, where local
  notifications are unavailable). `presentShiftAlarm` dedups per
  `${assignmentId}@${scheduledTime}`, so the overlay shows at most once per
  shift occurrence no matter which trigger lands first. The overlay
  auto-dismisses after 75 seconds if ignored.
- **Tap on the notification:** `app/_layout.tsx` subscribes to
  `addNotificationResponseReceivedListener` and deep-links to `/clockin`
  with the same params shape the dashboard `Pressable` uses
  (`assignmentId`, `clientName`, `scheduledTime`, `serviceCode`).

### Dev-test gesture

In `__DEV__` builds, **long-press the SECURE SESSION pill** on the
dashboard for ~600 ms. This calls `fireDevTestShiftAlert()` which schedules
a test notification 5 seconds in the future so you can validate the full
permission → channel → vibration → tap-to-deep-link pipeline without
waiting for a real shift. The handler is hard-guarded with `if (!__DEV__)
return;` so it cannot ship to production users.
