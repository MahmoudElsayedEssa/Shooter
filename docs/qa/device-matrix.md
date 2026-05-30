# Device And Browser Acceptance Matrix

## Supported Targets

| Target | Browser/WebView | Status | Result |
| --- | --- | --- | --- |
| iPhone SE width | iOS Safari WebView | supported | pass |
| iPhone modern notch | iOS Safari WebView | supported | pass |
| Android mid-range | Chrome WebView | supported | pass |
| Android low-end | Chrome WebView reduced fx | supported | pass |

## Unsupported Targets

| Target | Reason | Impact | Mitigation |
| --- | --- | --- | --- |
| Android 6 stock browser | missing modern WebGL and pointer-event support | visual effects and input feedback may be unreliable | require Chrome WebView or show unsupported-browser message |
