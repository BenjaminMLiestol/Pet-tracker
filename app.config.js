// The settings live in app.json. This file only adds a switch to build WITHOUT the home-screen
// widget: NO_WIDGET=1 npx expo prebuild --platform ios --clean
// The widget needs the App Groups capability, which a free Apple account may refuse to sign.
// Without the widget everything else works the same.
module.exports = ({ config }) => {
	if (process.env.NO_WIDGET !== "1") return config;

	const { entitlements = {}, ...ios } = config.ios ?? {};
	const { "com.apple.security.application-groups": _appGroups, ...otherEntitlements } = entitlements;
	return {
		...config,
		ios: {
			...ios,
			...(Object.keys(otherEntitlements).length > 0 ? { entitlements: otherEntitlements } : {}),
		},
		plugins: (config.plugins ?? []).filter((p) => (Array.isArray(p) ? p[0] : p) !== "@bacons/apple-targets"),
	};
};
