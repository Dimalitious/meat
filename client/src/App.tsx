import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SvodPage from './pages/SvodPage';
import ShipmentsPage from './pages/ShipmentsPage';
import ExpeditorsPage from './pages/ExpeditorsPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import SuppliersPage from './pages/SuppliersPage';
import OrdersPage from './pages/OrdersPage';
import OrderFormPage from './pages/OrderFormPage';
import OrderViewPage from './pages/OrderViewPage';
import OrderEditPage from './pages/OrderEditPage';
import OrderPrintPage from './pages/OrderPrintPage';
import DictsPage from './pages/DictsPage';
import { ImportPage } from './pages/ImportPage';
import DashboardPage from './pages/DashboardPage';
import WarehousePage from './pages/WarehousePage';
import AssemblyPage from './pages/AssemblyPage';
import AssemblyOrderPage from './pages/AssemblyOrderPage';
import AssemblyOrdersPage from './pages/AssemblyOrdersPage';
import SummaryOrdersPage from './pages/SummaryOrdersPage';
import SummaryJournalPage from './pages/SummaryJournalPage';
import AssemblyJournalPage from './pages/AssemblyJournalPage';
import ExpeditionPage from './pages/ExpeditionPage';
import ExpeditionInvoicePage from './pages/ExpeditionInvoicePage';
import ProductionPage from './pages/ProductionPage';
import ProductionJournalPage from './pages/ProductionJournalPage';
import ProductionStaffPage from './pages/ProductionStaffPage';
import PurchasePricePage from './pages/PurchasePricePage';
import PurchasePriceJournalPage from './pages/PurchasePriceJournalPage';
import SalesPricePage from './pages/SalesPricePage';
import SalesPriceJournalPage from './pages/SalesPriceJournalPage';
import PurchasePriceListsPage from './pages/PurchasePriceListsPage';
import PurchasePriceListFormPage from './pages/PurchasePriceListFormPage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <CustomersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute>
                <SuppliersPage />
              </ProtectedRoute>
            }
          />
          <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="/orders/new" element={<ProtectedRoute><OrderFormPage /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute><OrderViewPage /></ProtectedRoute>} />
          <Route path="/orders/:id/edit" element={<ProtectedRoute><OrderEditPage /></ProtectedRoute>} />
          <Route path="/orders/:id/print" element={<ProtectedRoute><OrderPrintPage /></ProtectedRoute>} />
          <Route path="/svod" element={<ProtectedRoute><SvodPage /></ProtectedRoute>} />
          <Route path="/shipments" element={<ProtectedRoute><ShipmentsPage /></ProtectedRoute>} />
          <Route path="/expeditors" element={<ProtectedRoute><ExpeditorsPage /></ProtectedRoute>} />
          <Route path="/dicts" element={<ProtectedRoute><DictsPage /></ProtectedRoute>} />
          <Route path="/warehouse" element={<ProtectedRoute><WarehousePage /></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
          <Route path="/assembly" element={<ProtectedRoute><AssemblyPage /></ProtectedRoute>} />
          <Route path="/assembly/:id" element={<ProtectedRoute><AssemblyOrderPage /></ProtectedRoute>} />
          <Route path="/summary-orders" element={<ProtectedRoute><SummaryOrdersPage /></ProtectedRoute>} />
          <Route path="/assembly-orders" element={<ProtectedRoute><AssemblyOrdersPage /></ProtectedRoute>} />
          <Route path="/journals/summary" element={<ProtectedRoute><SummaryJournalPage /></ProtectedRoute>} />
          <Route path="/journals/assembly" element={<ProtectedRoute><AssemblyJournalPage /></ProtectedRoute>} />
          {/* Expedition routes */}
          <Route path="/expedition" element={<ProtectedRoute><ExpeditionPage /></ProtectedRoute>} />
          <Route path="/expedition/:id/invoice" element={<ProtectedRoute><ExpeditionInvoicePage /></ProtectedRoute>} />
          {/* Production routes */}
          <Route path="/production" element={<ProtectedRoute><ProductionPage /></ProtectedRoute>} />
          <Route path="/production/staff" element={<ProtectedRoute><ProductionStaffPage /></ProtectedRoute>} />
          <Route path="/journals/production" element={<ProtectedRoute><ProductionJournalPage /></ProtectedRoute>} />
          {/* Price routes */}
          <Route path="/prices/purchase" element={<ProtectedRoute><PurchasePricePage /></ProtectedRoute>} />
          <Route path="/prices/sales" element={<ProtectedRoute><SalesPricePage /></ProtectedRoute>} />
          <Route path="/journals/purchase-prices" element={<ProtectedRoute><PurchasePriceJournalPage /></ProtectedRoute>} />
          <Route path="/journals/sales-prices" element={<ProtectedRoute><SalesPriceJournalPage /></ProtectedRoute>} />
          {/* NEW: Purchase Price Lists (Journal style) */}
          <Route path="/purchase-price-lists" element={<ProtectedRoute><PurchasePriceListsPage /></ProtectedRoute>} />
          <Route path="/purchase-price-list/:id" element={<ProtectedRoute><PurchasePriceListFormPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

