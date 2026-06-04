# iOS — e& Penalty Challenge

A standalone native iOS app wrapper using **WKWebView** to run the pre-built web game.  
**No npm, no Capacitor, no CocoaPods** — just open in Xcode and run.

## Architecture

```
ios/
├── Shooter.xcodeproj/     ← Xcode project (open this)
└── Shooter/
    ├── AppDelegate.swift          ← App entry point
    ├── GameViewController.swift   ← WKWebView fullscreen loader
    ├── Info.plist                  ← App config (portrait, immersive)
    ├── LaunchScreen.storyboard    ← Splash screen
    └── www/                       ← Pre-built web game files go here
```

## Setup

1. **Build the web game** (one time, on any machine with Node):
   ```bash
   npm run build
   ```

2. **Copy `dist/` into `www/`**:
   ```bash
   # macOS/Linux
   cp -r dist/* ios/Shooter/www/
   
   # Windows PowerShell
   Copy-Item -Recurse -Force dist\* ios\Shooter\www\
   ```

3. **Open in Xcode**:
   ```bash
   open ios/Shooter.xcodeproj
   ```

4. **Run** on a simulator or physical device.

## Requirements

- Xcode 15+
- iOS 15.0+ deployment target
- No package managers needed
