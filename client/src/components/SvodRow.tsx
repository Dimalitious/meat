import React, { memo } from 'react';

// ============================================
// ИНТЕРФЕЙСЫ (вытащены для переиспользования)
// ============================================

interface Product {
    id: number;
    name: string;
    code: string | null;
    priceListName: string | null;
    category: string | null;
    coefficient: number;
}

export interface SvodLine {
    id?: number;
    productId: number;
    shortName: string | null;
    category: string | null;
    coefficient: number | null;
    orderQty: number;
    productionInQty: number;
    openingStock: number;
    openingStockIsManual: boolean;
    afterPurchaseStock: number | null;
    availableQty?: number;
    qtyToShip: number | null;
    factMinusWaste: number | null;
    weightToShip: number | null;
    planFactDiff: number | null;
    underOver: number | null;
    isDistributionSource?: boolean;
    distributedFromLineId?: number | null;
    distributedFromName?: string | null;
    isPurchaseOnly?: boolean;
    isProductionOnly?: boolean;
    product?: Product;
}

export interface SvodSupplierCol {
    id?: number;
    colIndex: number;
    supplierId: number;
    supplierName: string;
    totalPurchase: number;
}

// ============================================
// СТИЛИ
// ============================================

export const thStyle: React.CSSProperties = {
    padding: '10px 8px',
    textAlign: 'left',
    fontWeight: 600,
    borderBottom: '2px solid #dee2e6',
    whiteSpace: 'nowrap'
};

export const tdStyle: React.CSSProperties = {
    padding: '8px',
    verticalAlign: 'middle'
};

export const inputStyle: React.CSSProperties = {
    width: '80px',
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px'
};

// ============================================
// УТИЛИТЫ
// ============================================

export function formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    if (value === 0) return '—';
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

export function getCategoryColor(category: string): string {
    switch (category) {
        case 'Баранина': return '#8B4513';
        case 'Говядина': return '#B22222';
        case 'Курица': return '#DAA520';
        default: return '#666';
    }
}

export function getCategoryBgColor(category: string): string {
    switch (category) {
        case 'Баранина': return '#FFF8DC';
        case 'Говядина': return '#FFE4E1';
        case 'Курица': return '#FFFACD';
        default: return '#e9ecef';
    }
}

export function getCategoryEmoji(category: string): string {
    switch (category) {
        case 'Баранина': return '🐑';
        case 'Говядина': return '🐄';
        case 'Курица': return '🐔';
        default: return '📦';
    }
}

// ============================================
// КОМПОНЕНТЫ
// ============================================

// Бейдж для типа строки
const LineBadge = memo(({ line, hasPurchase }: { line: SvodLine; hasPurchase: boolean }) => {
    if (line.isDistributionSource) {
        return <span style={badgeStyles.source}>Источник</span>;
    }
    if (line.distributedFromLineId) {
        return <span style={{ color: '#4caf50', fontSize: '14px' }}>↳</span>;
    }
    if (line.isProductionOnly && !line.distributedFromLineId) {
        return <span style={badgeStyles.production}>Производство</span>;
    }
    if ((line.isPurchaseOnly || (line.orderQty === 0 && hasPurchase)) && !line.distributedFromLineId && !line.isProductionOnly) {
        return <span style={badgeStyles.purchase}>Закупка</span>;
    }
    return null;
});

const badgeStyles = {
    source: {
        backgroundColor: '#1976d2',
        color: 'white',
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: 600
    } as React.CSSProperties,
    production: {
        backgroundColor: '#2196f3',
        color: 'white',
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: 600
    } as React.CSSProperties,
    purchase: {
        backgroundColor: '#9c27b0',
        color: 'white',
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: 600
    } as React.CSSProperties,
    distributed: {
        backgroundColor: '#e8f5e9',
        color: '#2e7d32',
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        marginLeft: '4px'
    } as React.CSSProperties
};

// Ячейка "Факт (− отходы)" с hover-эффектом
const FactCell = memo(({ value, onClick }: { value: number; onClick: () => void }) => {
    const [hover, setHover] = React.useState(false);

    return (
        <td
            style={{
                ...tdStyle,
                backgroundColor: hover ? '#f57c00' : '#ff9800',
                color: 'white',
                fontWeight: 600,
                textAlign: 'right',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(255,152,0,0.3)',
                transform: hover ? 'scale(1.02)' : 'scale(1)'
            }}
            onClick={onClick}
            title="Нажмите для распределения веса"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                {formatNumber(value)}
                <span style={{ fontSize: '12px' }}>➡</span>
            </span>
        </td>
    );
});

// ============================================
// ОСНОВНОЙ КОМПОНЕНТ СТРОКИ
// ============================================

interface SvodRowProps {
    line: SvodLine;
    supplierCols: SvodSupplierCol[];
    mode: 'preview' | 'saved' | 'editing';
    getNumericLineValue: (line: SvodLine, field: 'openingStock' | 'afterPurchaseStock') => number | null;
    handleLineEdit: (productId: number, field: string, value: string) => void;
    getSupplierValue: (productId: number, supplierId: number) => number;
    calculateAvailableQty: (line: SvodLine) => number;
    calculateFactMinusWaste: (line: SvodLine) => number;
    getTotalPurchaseForProduct: (productId: number) => number;
    openDistributionModal: (line: SvodLine) => void;
}

export const SvodRow = memo(({
    line,
    supplierCols,
    mode,
    getNumericLineValue,
    handleLineEdit,
    getSupplierValue,
    calculateAvailableQty,
    calculateFactMinusWaste,
    getTotalPurchaseForProduct,
    openDistributionModal
}: SvodRowProps) => {
    const category = line.category || 'Без категории';
    const hasPurchase = getTotalPurchaseForProduct(line.productId) > 0;
    const isEditing = mode === 'editing' || mode === 'preview';

    // Стиль строки
    const rowStyle: React.CSSProperties = {
        borderBottom: '1px solid #eee',
        backgroundColor: line.distributedFromLineId ? '#f0fff4' :
            line.isProductionOnly ? '#e3f2fd' :
                (line.isPurchaseOnly || (line.orderQty === 0 && hasPurchase)) ? '#f3e5f5' : undefined,
        borderLeft: line.isDistributionSource ? '4px solid #1976d2' :
            line.distributedFromLineId ? '4px solid #4caf50' :
                line.isProductionOnly ? '4px solid #2196f3' :
                    (line.isPurchaseOnly || (line.orderQty === 0 && hasPurchase)) ? '4px solid #9c27b0' : undefined
    };

    const diff = line.weightToShip && line.orderQty ? line.weightToShip - line.orderQty : null;
    const kRasp = line.weightToShip && line.orderQty && line.orderQty !== 0 ? line.weightToShip / line.orderQty : null;

    return (
        <tr style={rowStyle}>
            {/* Название товара */}
            <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <LineBadge line={line} hasPurchase={hasPurchase} />
                    <span>{line.product?.name || line.shortName}</span>
                    {line.distributedFromName && (
                        <span style={badgeStyles.distributed}>← из: {line.distributedFromName}</span>
                    )}
                </div>
            </td>

            {/* Код товара */}
            <td style={{ ...tdStyle, fontSize: '11px', color: '#666' }}>
                {line.product?.code || '—'}
            </td>

            {/* Категория */}
            <td style={{ ...tdStyle, color: getCategoryColor(category), fontWeight: 500 }}>
                {category}
            </td>

            {/* Заказ */}
            <td style={{ ...tdStyle, backgroundColor: '#e3f2fd', fontWeight: 500 }}>
                {formatNumber(line.orderQty)}
            </td>

            {/* Остаток на начало */}
            <td style={{ ...tdStyle, backgroundColor: '#fff3e0' }}>
                {isEditing ? (
                    <input
                        type="number"
                        step="0.001"
                        value={getNumericLineValue(line, 'openingStock') ?? ''}
                        onChange={(e) => handleLineEdit(line.productId, 'openingStock', e.target.value)}
                        style={inputStyle}
                        placeholder="—"
                    />
                ) : (
                    formatNumber(line.openingStock)
                )}
            </td>

            {/* Приход с производства */}
            <td style={{ ...tdStyle, backgroundColor: '#e8f5e9' }}>
                {formatNumber(line.productionInQty)}
            </td>

            {/* Значения по поставщикам */}
            {supplierCols.map(col => (
                <td key={col.supplierId} style={{ ...tdStyle, backgroundColor: '#e0f7fa', textAlign: 'center' }}>
                    {formatNumber(getSupplierValue(line.productId, col.supplierId))}
                </td>
            ))}

            {/* Имеется в наличии */}
            <td style={{ ...tdStyle, backgroundColor: '#c8e6c9', fontWeight: 600, textAlign: 'right' }}>
                {formatNumber(calculateAvailableQty(line))}
            </td>

            {/* Факт (− отходы) */}
            <FactCell value={calculateFactMinusWaste(line)} onClick={() => openDistributionModal(line)} />

            {/* Вес к отгрузке */}
            <td style={{
                ...tdStyle,
                backgroundColor: line.weightToShip ? '#c8e6c9' : '#eeeeee',
                textAlign: 'right',
                fontWeight: line.weightToShip ? 600 : 400
            }}>
                {line.weightToShip ? formatNumber(line.weightToShip) : '—'}
            </td>

            {/* Перебор/Недобор */}
            <td style={{
                ...tdStyle,
                backgroundColor: '#eeeeee',
                textAlign: 'right',
                color: diff !== null ? (diff > 0 ? '#4caf50' : diff < 0 ? '#f44336' : '#666') : '#999',
                fontWeight: diff !== null ? 500 : 400
            }}>
                {diff !== null ? formatNumber(diff) : '—'}
            </td>

            {/* K распределения */}
            <td style={{ ...tdStyle, backgroundColor: '#fff9c4', textAlign: 'right', fontWeight: 500 }}>
                {kRasp !== null ? formatNumber(kRasp) : '—'}
            </td>

            {/* Коэффициент */}
            <td style={tdStyle}>{line.coefficient ?? 1}</td>
        </tr>
    );
});

SvodRow.displayName = 'SvodRow';
LineBadge.displayName = 'LineBadge';
FactCell.displayName = 'FactCell';
