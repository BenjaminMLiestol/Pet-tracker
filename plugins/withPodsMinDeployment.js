const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

// Current Xcode only supports iOS 15+ deployment targets, but a few pods still
// declare older ones (12.4, 13.4) and fail the build. Raise them when installing pods.
const MARKER = "# [pet-tracker] raise pods below iOS 15";
const SNIPPET = `
    ${MARKER}
    min_ios = '15.1'
    ([installer.pods_project] + installer.pods_project.targets).each do |item|
      item.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios if current > 0 && current < 15.0
      end
    end
`;

module.exports = function withPodsMinDeployment(config) {
	return withDangerousMod(config, [
		"ios",
		(c) => {
			const podfile = path.join(c.modRequest.platformProjectRoot, "Podfile");
			let src = fs.readFileSync(podfile, "utf8");
			if (!src.includes(MARKER)) {
				// Append inside post_install, right after react_native_post_install(...)
				src = src.replace(
					/(react_native_post_install\([\s\S]*?\n    \)\n)/,
					`$1${SNIPPET}`,
				);
				fs.writeFileSync(podfile, src);
			}
			return c;
		},
	]);
};
