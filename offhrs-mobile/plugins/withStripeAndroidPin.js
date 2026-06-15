const { withProjectBuildGradle } = require('@expo/config-plugins');

const STRIPE_ANDROID_VERSION = '21.22.1';
const MARKER = 'OFFHRS_STRIPE_ANDROID_PIN';

function applyStripeAndroidPin(buildGradle) {
  if (buildGradle.includes(MARKER)) {
    return buildGradle;
  }

  return `${buildGradle.trimEnd()}

// ${MARKER}: avoid Gradle resolving com.stripe:*:21.22.+ metadata from flaky repositories.
allprojects {
    configurations.configureEach {
        resolutionStrategy.eachDependency { details ->
            if (details.requested.group == 'com.stripe' && details.requested.version == '21.22.+') {
                details.useVersion '${STRIPE_ANDROID_VERSION}'
                details.because 'Pin Stripe Android modules for reliable EAS dependency resolution'
            }
        }
    }
}
`;
}

module.exports = function withStripeAndroidPin(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = applyStripeAndroidPin(config.modResults.contents);
    }

    return config;
  });
};
