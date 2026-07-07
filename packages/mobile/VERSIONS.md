# Mobile dependency versions. read before bumping

The native-module versions in this package are **pinned to match the installed
Expo SDK** (currently **SDK 54**). They are not arbitrary, and they are **not a
"downgrade for Expo Go."** Every Expo SDK is built and tested against one exact
React Native version; mixing in a newer RN (or reanimated/worklets/screens/etc.)
breaks the Metro bundler and native runtime for **all** build types. Expo Go
*and* production EAS dev/prod builds.

## The pinned set (Expo SDK 54)

| Package | Pinned | Why |
|---|---|---|
| `expo` | `~54.0.35` | The SDK everything else is aligned to |
| `react` | `19.1.0` | The renderer RN 0.81 ships |
| `react-native` | `0.81.5` | The RN version SDK 54 is built against |
| `react-native-reanimated` | `~4.1.1` | Worklet ABI must match the RN runtime |
| `react-native-worklets` | `0.5.1` | Paired with reanimated 4.1.x |
| `react-native-gesture-handler` | `~2.28.0` | SDK 54 native module |
| `react-native-screens` | `~4.16.0` | SDK 54 native module |
| `react-native-safe-area-context` | `~5.6.2` | SDK 54 native module |

> These were realigned after a Dependabot bump pushed RN to `0.85.3` / react to
> `19.2.6`, which is **incompatible with SDK 54** and broke the bundle
> (`VirtualViewNativeComponent: Unable to determine event arguments`). The app on
> a clean install must resolve the versions above. verify with
> `npx expo install --check`.

## Do NOT bump these individually

A PR (or Dependabot) that raises `react-native`, `react`, `react-native-reanimated`,
`react-native-worklets`, `react-native-screens`, or `react-native-safe-area-context`
on its own will break the build. These move **together, with an Expo SDK upgrade.**

## The correct way to upgrade React Native (later)

Upgrade the whole SDK as a unit. don't touch RN directly:

```bash
# from packages/mobile
npx expo install expo@^55          # or the target SDK
npx expo install --fix             # realigns every Expo-managed dep to that SDK
npx expo-doctor                    # verifies the tree is consistent
```

Then rebuild and re-test (Expo Go for the new SDK, or an EAS dev build).

## Dependabot

Keep Dependabot from independently bumping the Expo-managed native packages
above. group or ignore them so they only change via an intentional
`expo install` SDK upgrade. See `.github/dependabot.yml`.
