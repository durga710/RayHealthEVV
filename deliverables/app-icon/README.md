# RayHealth EVV — App Icon

Real (non-placeholder) icon master + size-matrix for App Store and Play Store submission. Replaces the auto-generated blue square that Apple would reject.

## Design

Heraldic shield in brand white over a vertical gradient of `#0B5FB1 → #08407A`, with a teal `#10A4A4` ECG pulse line passing through the shield. The shield encodes "Verified / Audit-ready." The pulse encodes "Care, alive, monitored." That is the brand promise — *Care. Verified. Delivered.* — visualized.

Composition choices:
- No text. Apple HIG: icons must read at 29×29 Settings size.
- No rounded corners. Apple applies the squircle mask at the OS layer.
- No alpha channel. App Store Connect rejects PNGs with transparency.
- Center-weighted shield. High contrast against any home-screen wallpaper.

## Files

| File | Use |
|---|---|
| `rayhealth-icon-1024.png` | **Master.** Upload to App Store Connect → App Information → Icon. |
| `rayhealth-icon-180.png` | iPhone @3x (`AppIcon.appiconset/Icon-180.png`) |
| `rayhealth-icon-120.png` | iPhone @2x |
| `rayhealth-icon-167.png` | iPad Pro |
| `rayhealth-icon-152.png` | iPad |
| `rayhealth-icon-512-android.png` | Play Store listing icon |
| `rayhealth-icon-192-android.png` | Android adaptive launcher (foreground) |
| `build-icon.py` | Source. Regenerate with `python3 build-icon.py`. |

## Apple checklist before upload

- [x] 1024×1024 exact
- [x] PNG, RGB (no alpha)
- [x] No rounded corners
- [x] No translucency
- [x] Recognizable at 29×29

## Regenerating

```bash
cd deliverables/app-icon
python3 build-icon.py
```

All sizes are derived from the 1024 master with Lanczos resampling. Edit `build()` in `build-icon.py` if the brand direction changes.
