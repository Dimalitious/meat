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
import DictsPage from './pages/DictsPage';
import { ImportPage } from './pages/ImportPage';
import DashboardPage from './pages/DashboardPage';
import WarehousePage from './pages/WarehousePage';
import AssemblyPage from './pages/AssemblyPage';
import AssemblyOrderPage from './pages/AssemblyOrderPage';

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
          <Route path="/svod" element={<ProtectedRoute><SvodPage /></ProtectedRoute>} />
          <Route path="/shipments" element={<ProtectedRoute><ShipmentsPage /></ProtectedRoute>} />
          <Route path="/expeditors" element={<ProtectedRoute><ExpeditorsPage /></ProtectedRoute>} />
          <Route path="/dicts" element={<ProtectedRoute><DictsPage /></ProtectedRoute>} />
          <Route path="/warehouse" element={<ProtectedRoute><WarehousePage /></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
          <Route path="/assembly" element={<ProtectedRoute><AssemblyPage /></ProtectedRoute>} />
          <Route path="/assembly/:id" element={<ProtectedRoute><AssemblyOrderPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
