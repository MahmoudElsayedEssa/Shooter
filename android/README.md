# Android Wrapper

This project wraps the Vite/Phaser web game in a portrait-only Android WebView.

## Build

From `android/`:

```powershell
.\gradlew.bat assembleDebug
```

The Gradle build runs `npm run build`, copies `dist/` into generated Android assets, and loads it through `WebViewAssetLoader` at `https://shooter.local/index.html`.

The native wrapper is intentionally small:

- portrait-only `MainActivity`
- bundled offline web assets
- JavaScript and DOM storage enabled for Phaser
- system UI hidden for full-screen play
- WebView overscroll and scrollbars disabled
