# Android — e& Penalty Challenge

A standalone native Android app wrapper using **WebView** to run the pre-built web game.  
**No npm, no Vite** — just open in Android Studio and run.

## Architecture

```
android/
├── app/
│   ├── build.gradle                          ← Copies dist/ into APK assets
│   └── src/main/
│       ├── java/.../MainActivity.java        ← WebView fullscreen loader
│       └── AndroidManifest.xml
├── build.gradle
├── settings.gradle
└── gradlew / gradlew.bat
```

## Setup

1. **Build the web game** (one time, on any machine with Node):
   ```bash
   npm run build
   ```

2. **Open `android/` in Android Studio** — the Gradle sync will automatically
   copy `../dist/` into the APK's assets at build time.

3. **Run** on an emulator or physical device.

## Requirements

- Android Studio (latest)
- Android SDK 35 (compileSdk)
- minSdk 24 (Android 7.0+)
- No npm/Node needed on the build machine
