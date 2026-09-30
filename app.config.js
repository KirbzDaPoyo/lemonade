const { associationConfiguration } = require('./script/sharing-associations.cjs');
module.exports = ({ config }) => {
  const sharing = associationConfiguration();
  const isDevelopment = process.env.EXPO_PUBLIC_APP_ENV === "development";
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  const iosKey = process.env.GOOGLE_MAPS_IOS_API_KEY?.trim();
  return {
    ...config,
    ...(isDevelopment
      ? { name: "Lemonade Dev", scheme: "project-lemonade-dev" }
      : {}),
    ios: {
      ...config.ios,
      ...(sharing?.iosId ? { associatedDomains: [...(config.ios?.associatedDomains ?? []), 'applinks:' + sharing.hostname] } : {}),
      ...(isDevelopment
        ? { bundleIdentifier: "com.projectlemonade.mvp.dev" }
        : {}),
      config: {
        ...config.ios?.config,
        ...(iosKey ? { googleMapsApiKey: iosKey } : {}),
      },
    },
    android: {
      ...config.android,
      ...(sharing ? { intentFilters: [...(config.android?.intentFilters ?? []), { action: 'VIEW', autoVerify: true, category: ['BROWSABLE', 'DEFAULT'], data: [{ scheme: 'https', host: sharing.hostname, path: '/s' }] }] } : {}),
      ...(isDevelopment ? { package: "com.projectlemonade.mvp.dev" } : {}),
      blockedPermissions: [
        ...(config.android?.blockedPermissions ?? []),
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
      ],
      config: {
        ...config.android?.config,
        ...(androidKey ? { googleMaps: { apiKey: androidKey } } : {}),
      },
    },
    plugins: [
      ...config.plugins,
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow Project Lemonade to show which of your saved places are near you.",
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
        },
      ],
    ],
    extra: {
      ...config.extra,
      mapSdk: { android: Boolean(androidKey), ios: Boolean(iosKey) },
    },
  };
};
