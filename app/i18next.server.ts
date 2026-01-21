import enCommon from "../public/locales/en/common.json";

function resolveKey(key: string, obj: any): string {
    const parts = key.split('.');
    let current = obj;
    for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        } else {
            return key; // Fallback to key if not found
        }
    }
    return typeof current === 'string' ? current : key;
}

const t = (key: string, options?: any) => {
    let text = resolveKey(key, enCommon);
    if (options && typeof options === 'object') {
        Object.keys(options).forEach(k => {
            text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(options[k]));
        });
    }
    return text;
};

export default {
    getLocale: (...args: any[]) => Promise.resolve("en"),
    getRouteNamespaces: (...args: any[]) => [],
    getFixedT: async (...args: any[]) => t
};
