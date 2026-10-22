import administrationUiText from './administration';
import dashboardsUiText from './dashboards';
import publicUiText from './public';
import sharedUiText from './shared';
import systemUiText from './system';

export const amharicUiText = {
  ...publicUiText,
  ...sharedUiText,
  ...administrationUiText,
  ...dashboardsUiText,
  ...systemUiText,
};

export const translateUiText = (englishText, language = 'en') => {
  if (typeof englishText !== 'string' || language !== 'am') return englishText;
  return amharicUiText[englishText] || englishText;
};
