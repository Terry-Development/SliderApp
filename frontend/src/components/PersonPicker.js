import { PEOPLE, saveIdentity } from '@/utils/identity';

export default function PersonPicker({ value, onChange, compact = false }) {
    const select = (id) => {
        saveIdentity(id);
        onChange?.(id);
    };

    if (!value) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                <div className="w-full max-w-md card-dark p-6 md:p-8 shadow-2xl">
                    <div className="text-center mb-7">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent-purple grid place-items-center mb-4">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m7-10a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87m-4-8a4 4 0 010 7.75" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold">Who are you?</h2>
                        <p className="text-slate-400 text-sm mt-2">This identity is shared by Chat and Schedule.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.values(PEOPLE).map((person) => (
                            <button
                                key={person.id}
                                onClick={() => select(person.id)}
                                className="rounded-2xl border border-dark-border bg-dark-bg p-5 hover:border-primary/70 hover:bg-primary/5 transition-all text-left"
                            >
                                <div className={`w-11 h-11 rounded-xl grid place-items-center font-bold text-lg mb-3 ${person.id === 'terence' ? 'bg-primary/15 text-primary-light' : 'bg-pink-500/15 text-pink-300'}`}>
                                    {person.initial}
                                </div>
                                <div className="font-semibold">{person.name}</div>
                                <div className="text-xs text-slate-500 mt-1">{person.id === 'terence' ? 'Your profile' : 'Other person'}</div>
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-slate-600 text-center mt-5">Incognito may forget this choice when you close the private session, but your saved data will not be lost.</p>
                </div>
            </div>
        );
    }

    const person = PEOPLE[value] || PEOPLE.terence;
    return (
        <div className={`flex items-center gap-2 ${compact ? '' : 'rounded-xl border border-dark-border bg-dark-bg/60 p-1'}`}>
            {Object.values(PEOPLE).map((item) => (
                <button
                    key={item.id}
                    onClick={() => select(item.id)}
                    title={`Switch to ${item.name}`}
                    className={`${compact ? 'px-2 py-1.5' : 'px-3 py-2'} rounded-lg text-xs font-medium transition-colors ${value === item.id ? 'bg-primary text-white' : 'text-slate-500 hover:text-white'}`}
                >
                    {compact ? item.initial : item.name}
                </button>
            ))}
            {!compact && <span className="sr-only">Current identity: {person.name}</span>}
        </div>
    );
}
