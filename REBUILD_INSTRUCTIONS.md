# Rebuild Instructions

## Every Time You Make Changes

```bash
cd /media/akshay/LinxGarage/Project/DayMemory
npm run sync
npm run build:android
```

The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

## All Commands

```bash
npm run sync              # Copy www/ changes to android/
npm run build:android     # Build debug APK
npm run build:android:release  # Build release APK (when ready to publish)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk  # Install APK on device
```

## Troubleshooting

```bash
# If build fails, clean and retry:
cd android && ./gradlew clean && cd ..
npm run sync
npm run build:android
```

Done!
