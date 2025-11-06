import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';

import translationEN from './en/translation.json';
import translationZH_CN from './zh-CN/translation.json';

// the translations
const resources = {
    en: {
        translation: translationEN,
    },
    'zh-CN': {
        translation: translationZH_CN,
    },
};

i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: 'zh-CN', // 默认语言设置为简体中文
        fallbackLng: 'zh-CN', // 后备语言设置为简体中文

        interpolation: {
            escapeValue: false, // react already safes from xss
        },
    });

export default i18n;