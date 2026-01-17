

const DashboardPage = () => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Обзор (Overview)</h2>
                <p className="text-slate-500">Ключевые показатели за сегодня</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Активные заказы"
                    value="12"
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                    color="blue"
                    trend="+2.5%"
                />
                <StatCard
                    title="Выручка сегодня"
                    value="4.2M"
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    color="emerald"
                    trend="+12%"
                />
                <StatCard
                    title="Новые клиенты"
                    value="5"
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                    color="violet"
                />
                <StatCard
                    title="Низкий остаток"
                    value="3"
                    icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                    color="red"
                    trend="-1"
                    trendDown
                />
            </div>

            {/* Recent Activity & Charts Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-semibold text-slate-900">Динамика продаж (Sales Trend)</h3>
                        <div className="flex gap-2">
                            <span className="text-xs font-medium px-2 py-1 bg-white border border-slate-200 rounded text-slate-600">Неделя</span>
                            <span className="text-xs font-medium px-2 py-1 bg-slate-100 border border-transparent rounded text-slate-500">Месяц</span>
                        </div>
                    </div>
                    <div className="p-6 h-64 flex items-center justify-center text-slate-400 bg-slate-50/20">
                        {/* Placeholder for Chart */}
                        <div className="text-center">
                            <svg className="w-12 h-12 mx-auto text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                            <p>График продаж будет здесь</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-900">Последние заказы</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="p-4 hover:bg-slate-50 flex items-center justify-between group cursor-pointer transition-colors">
                                <div>
                                    <div className="font-medium text-slate-900 text-sm">Заказ #{10230 + i}</div>
                                    <div className="text-xs text-slate-500">2 мин назад</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-slate-900 text-sm">{15000 * i} ₸</div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">New</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                        <button className="text-sm font-medium text-blue-600 hover:text-blue-700">Все заказы &rarr;</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color, trend, trendDown }: any) => {
    const colorClasses: any = {
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        violet: 'bg-violet-50 text-violet-600',
        red: 'bg-red-50 text-red-600',
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${colorClasses[color] || 'bg-slate-100 text-slate-600'}`}>
                    {icon}
                </div>
                {trend && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${!trendDown ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            </div>
        </div>
    );
};

export default DashboardPage;
