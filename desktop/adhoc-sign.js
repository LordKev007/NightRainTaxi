// Runs after each app is packaged. On macOS it gives the app a free "ad-hoc" signature.
// Apple Silicon Macs refuse to open an app with no signature at all ("damaged"); with an ad-hoc one,
// players only need to right-click > Open the first time. A paid Apple Developer ID would remove even that.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
