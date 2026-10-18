/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
	type: "widget",
	name: "PetWidget",
	displayName: "Pet Tracker",
	// Buttons that act without opening the app (the log buttons) need iOS 17.
	deploymentTarget: "17.0",
	frameworks: ["SwiftUI", "WidgetKit", "AppIntents"],
	colors: {
		$accent: { color: "#E1A04A", darkColor: "#E1A04A" },
		$widgetBackground: { color: "#FFFFFF", darkColor: "#1C1C1E" },
		Honey: { color: "#8F5410", darkColor: "#F0B15C" },
		Muted: { color: "#5D6370", darkColor: "#9AA0AB" },
	},
	// The same group as the app: how the app hands the widget its data and login.
	entitlements: {
		"com.apple.security.application-groups":
			config.ios.entitlements["com.apple.security.application-groups"],
	},
});
