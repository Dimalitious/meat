import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Option {
    id: number;
    name: string;
    isActive?: boolean;
    deletedAt?: string | null;
}

interface SearchableSelectProps {
    options: Option[];
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    placeholder?: string;
    emptyLabel?: string;
    required?: boolean;
    /** Show inactive/deleted options but mark them */
    showInactive?: boolean;
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Поиск...',
    emptyLabel = 'Не выбрано',
    required = false,
    showInactive = true,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find(o => o.id === value);

    // Filter options based on search
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return options;
        return options.filter(o => o.name.toLowerCase().includes(q));
    }, [options, search]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (id: number | undefined) => {
        onChange(id);
        setIsOpen(false);
        setSearch('');
    };

    const getOptionLabel = (o: Option) => {
        if (o.deletedAt) return `${o.name} (удалена)`;
        if (o.isActive === false) return `${o.name} (архив)`;
        return o.name;
    };

    const isDisabled = (o: Option) => !o.isActive || !!o.deletedAt;

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger / display */}
            <button
                type="button"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between bg-white"
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) {
                        setTimeout(() => inputRef.current?.focus(), 50);
                    }
                }}
            >
                <span className={selectedOption ? 'text-slate-900' : 'text-slate-400'}>
                    {selectedOption ? getOptionLabel(selectedOption) : emptyLabel}
                </span>
                <span className="flex items-center gap-1">
                    {value !== undefined && !required && (
                        <span
                            className="text-slate-400 hover:text-slate-600 p-0.5"
                            onClick={(e) => { e.stopPropagation(); handleSelect(undefined); }}
                        >
                            <X size={14} />
                        </span>
                    )}
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-56 flex flex-col">
                    <div className="p-2 border-b border-slate-100">
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder={placeholder}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Escape') {
                                    setIsOpen(false);
                                    setSearch('');
                                }
                            }}
                        />
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {!required && (
                            <button
                                type="button"
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${value === undefined ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-500'}`}
                                onClick={() => handleSelect(undefined)}
                            >
                                {emptyLabel}
                            </button>
                        )}
                        {filtered.length === 0 && (
                            <div className="px-3 py-4 text-center text-sm text-slate-400">
                                Ничего не найдено
                            </div>
                        )}
                        {filtered.map(o => {
                            const disabled = isDisabled(o) && !showInactive;
                            const inactive = isDisabled(o);
                            const isSelected = o.id === value;
                            return (
                                <button
                                    key={o.id}
                                    type="button"
                                    disabled={disabled}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors
                                        ${isSelected ? 'bg-blue-50 font-medium text-blue-700' : ''}
                                        ${inactive ? 'text-slate-400' : 'text-slate-700'}
                                        ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-blue-50 cursor-pointer'}
                                    `}
                                    onClick={() => handleSelect(o.id)}
                                >
                                    {getOptionLabel(o)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
