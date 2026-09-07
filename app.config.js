module.exports = ({ config }) => {
  const isDevelopment = process.env.EXPO_PUBLIC_APP_ENV === 'development';

  if (!isDevelopment) {
    return config;
  }

  return {
    ...config,
    name: 'Lemonade Dev',
    scheme: 'project-lemonade-dev',
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.projectlemonade.mvp.dev',
    },
    android: {
      ...config.android,
      package: 'com.projectlemonade.mvp.dev',
    },
  };
};
