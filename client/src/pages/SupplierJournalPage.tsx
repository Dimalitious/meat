import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PurchasesPage from './PurchasesPage';
import SupplierAccountPage from './SupplierAccountPage';

type TabKey = 'purchases' | 'settlements';

const TAB_LABELS: Record<TabKey, string> = {
    purchases: 'Закупки',
    settlements: 'Расчёты',
};

const SupplierJournalPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') as TabKey) || 'purchases';
    const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

    useEffect(() => {
        const tabParam = searchParams.get('tab') as TabKey;
        if (tabParam && (tabParam === 'purchases' || tabParam === 'settlements')) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    const switchTab = (tab: TabKey) => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    return (
        <div className="space-y-4">
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-slate-200">
                {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => switchTab(tab)}
                        className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab
                            ? 'bg-white text-blue-600 border-b-2 border-blue-600 -mb-px'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        {TAB_LABELS[tab]}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div>
                {activeTab === 'purchases' && <PurchasesPage />}
                {activeTab === 'settlements' && <SupplierAccountPage />}
            </div>
        </div>
    );
};

export default SupplierJournalPage;
