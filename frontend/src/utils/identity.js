export const PEOPLE = {
    terence: { id: 'terence', name: 'Terence', initial: 'T' },
    partner: { id: 'partner', name: 'Jessy', initial: 'J' }
};

const STORAGE_KEY = 'sliderapp_person';

export function getStoredIdentity() {
    if (typeof window === 'undefined') return '';
    const value = localStorage.getItem(STORAGE_KEY) || '';
    return PEOPLE[value] ? value : '';
}

export function saveIdentity(id) {
    if (typeof window === 'undefined' || !PEOPLE[id]) return;
    localStorage.setItem(STORAGE_KEY, id);
}

export function personHeaders(id, includeJson = false) {
    const headers = {
        'x-admin-password': typeof window !== 'undefined' ? (localStorage.getItem('admin_password') || '') : '',
        'x-user-id': id || ''
    };
    if (includeJson) headers['Content-Type'] = 'application/json';
    return headers;
}
