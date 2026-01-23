import { useState, useMemo } from 'react';
import { FileText, ChevronDown, Calendar, Loader2 } from 'lucide-react';

// Названия месяцев на русском
const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// Получить количество дней в месяце
function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

// Сгенерировать массив годов (последние 5 лет + текущий + следующий)
function getYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 5; y <= currentYear + 1; y++) {
        years.push(y);
    }
    return years;
}

export default function MaterialReportPage() {
    const currentDate = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
    const [selectedDay, setSelectedDay] = useState<number>(currentDate.getDate());
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);

    // Количество дней в выбранном месяце
    const daysInMonth = useMemo(() => {
        return getDaysInMonth(selectedYear, selectedMonth);
    }, [selectedYear, selectedMonth]);

    // Массив дней для отображения
    const daysArray = useMemo(() => {
        return Array.from({ length: daysInMonth }, (_, i) => i + 1);
    }, [daysInMonth]);

    // Проверка и корректировка выбранного дня при смене месяца
    const handleMonthChange = (monthIndex: number) => {
        setSelectedMonth(monthIndex);
        const maxDays = getDaysInMonth(selectedYear, monthIndex);
        if (selectedDay > maxDays) {
            setSelectedDay(maxDays);
        }
    };

    // Проверка и корректировка при смене года
    const handleYearChange = (year: number) => {
        setSelectedYear(year);
        const maxDays = getDaysInMonth(year, selectedMonth);
        if (selectedDay > maxDays) {
            setSelectedDay(maxDays);
        }
    };

    // Сформировать отчет
    const handleGenerateReport = async () => {
        setLoading(true);
        try {
            // Формируем дату для запроса
            const reportDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
            console.log('Generating report for date:', reportDate);

            // TODO: API вызов для генерации отчета
            // const response = await axios.get(`${API_URL}/api/reports/material`, {
            //     params: { date: reportDate },
            //     headers: { Authorization: `Bearer ${token}` }
            // });
            // setReportData(response.data);

            // Имитация загрузки
            await new Promise(resolve => setTimeout(resolve, 1000));
            setReportData({ date: reportDate, generated: true });

        } catch (error) {
            console.error('Error generating report:', error);
            alert('Ошибка при формировании отчета');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Заголовок */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px'
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                }}>
                    <FileText size={24} color="white" />
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a1a2e' }}>
                        Материальный отчет
                    </h1>
                    <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>
                        Формирование материального отчета по дате
                    </p>
                </div>
            </div>

            {/* Панель управления */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                padding: '24px',
                marginBottom: '24px'
            }}>
                {/* Выбор года */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#333',
                        marginBottom: '8px'
                    }}>
                        <Calendar size={16} />
                        Год
                    </label>
                    <div style={{ position: 'relative', width: '200px' }}>
                        <select
                            value={selectedYear}
                            onChange={(e) => handleYearChange(Number(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '12px 40px 12px 16px',
                                fontSize: '16px',
                                fontWeight: 600,
                                border: '2px solid #e0e0e0',
                                borderRadius: '10px',
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                appearance: 'none',
                                color: '#333',
                                transition: 'border-color 0.2s, box-shadow 0.2s'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#667eea';
                                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#e0e0e0';
                                e.target.style.boxShadow = 'none';
                            }}
                        >
                            {getYearOptions().map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        <ChevronDown
                            size={20}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                pointerEvents: 'none',
                                color: '#666'
                            }}
                        />
                    </div>
                </div>

                {/* Табы месяцев */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#333',
                        marginBottom: '12px'
                    }}>
                        Месяц
                    </label>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        padding: '8px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '12px'
                    }}>
                        {MONTHS.map((month, index) => (
                            <button
                                key={month}
                                onClick={() => handleMonthChange(index)}
                                style={{
                                    padding: '10px 16px',
                                    fontSize: '14px',
                                    fontWeight: selectedMonth === index ? 600 : 500,
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    backgroundColor: selectedMonth === index
                                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                        : 'transparent',
                                    background: selectedMonth === index
                                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                        : 'transparent',
                                    color: selectedMonth === index ? 'white' : '#555',
                                    boxShadow: selectedMonth === index
                                        ? '0 4px 12px rgba(102, 126, 234, 0.4)'
                                        : 'none',
                                    transform: selectedMonth === index ? 'scale(1.02)' : 'scale(1)'
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedMonth !== index) {
                                        e.currentTarget.style.backgroundColor = '#e9ecef';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedMonth !== index) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                {month}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Подтабы дней */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#333',
                        marginBottom: '12px'
                    }}>
                        Число ({MONTHS[selectedMonth]} {selectedYear})
                    </label>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        padding: '12px',
                        backgroundColor: '#f0f4ff',
                        borderRadius: '12px',
                        border: '1px solid #e0e7ff'
                    }}>
                        {daysArray.map(day => {
                            const isSelected = selectedDay === day;
                            const isToday =
                                day === currentDate.getDate() &&
                                selectedMonth === currentDate.getMonth() &&
                                selectedYear === currentDate.getFullYear();

                            return (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDay(day)}
                                    style={{
                                        width: '42px',
                                        height: '42px',
                                        fontSize: '14px',
                                        fontWeight: isSelected ? 700 : 500,
                                        border: isToday && !isSelected ? '2px solid #667eea' : 'none',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        background: isSelected
                                            ? 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)'
                                            : 'white',
                                        color: isSelected ? 'white' : isToday ? '#667eea' : '#333',
                                        boxShadow: isSelected
                                            ? '0 4px 12px rgba(76, 175, 80, 0.4)'
                                            : '0 1px 3px rgba(0,0,0,0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.backgroundColor = '#e8f5e9';
                                            e.currentTarget.style.transform = 'scale(1.05)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.backgroundColor = 'white';
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }
                                    }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Выбранная дата и кнопка */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '12px',
                    border: '1px solid #e0e0e0'
                }}>
                    <div>
                        <span style={{ fontSize: '14px', color: '#666' }}>Выбранная дата:</span>
                        <div style={{
                            fontSize: '20px',
                            fontWeight: 700,
                            color: '#1a1a2e',
                            marginTop: '4px'
                        }}>
                            {selectedDay} {MONTHS[selectedMonth]} {selectedYear}
                        </div>
                    </div>
                    <button
                        onClick={handleGenerateReport}
                        disabled={loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '14px 28px',
                            fontSize: '16px',
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: '12px',
                            cursor: loading ? 'wait' : 'pointer',
                            background: loading
                                ? '#ccc'
                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            boxShadow: loading
                                ? 'none'
                                : '0 4px 15px rgba(102, 126, 234, 0.4)',
                            transition: 'all 0.2s ease',
                            transform: 'scale(1)'
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) {
                                e.currentTarget.style.transform = 'scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                        }}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="spin" />
                                Формирование...
                            </>
                        ) : (
                            <>
                                <FileText size={20} />
                                Сформировать
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Область отчета */}
            {reportData && (
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    padding: '24px'
                }}>
                    <h2 style={{
                        margin: '0 0 16px',
                        fontSize: '20px',
                        fontWeight: 600,
                        color: '#333'
                    }}>
                        Материальный отчет за {selectedDay} {MONTHS[selectedMonth]} {selectedYear}
                    </h2>
                    <div style={{
                        padding: '40px',
                        textAlign: 'center',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '12px',
                        color: '#666'
                    }}>
                        <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <p style={{ margin: 0, fontSize: '16px' }}>
                            Данные отчета будут отображены здесь после интеграции с API
                        </p>
                    </div>
                </div>
            )}

            {/* CSS для анимации */}
            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
