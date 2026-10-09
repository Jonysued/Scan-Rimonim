import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ScrollToTop from './components/ScrollToTop';
import Dashboard from './pages/Dashboard';
import Lotes from './pages/Lotes';
import NuevaSesion from './pages/NuevaSesion';
import SesionResultado from './pages/SesionResultado';
import BloqueDetalle from './pages/BloqueDetalle';
import Comparar from './pages/Comparar';
import Admin from './pages/Admin';
import RoleRoute from './components/RoleRoute';
import OfflineBridge from './components/OfflineBridge';

const AuthenticatedApp = () => {
  const location = useLocation();
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user, logout } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const publicPage = { '/login': <Login/>, '/register': <Register/>, '/forgot-password': <ForgotPassword/>, '/reset-password': <ResetPassword/> }[location.pathname];
  if (publicPage) return publicPage;
  if (authError) return <div className="p-8" role="alert">{authError.message}</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace/>;
  if (user?.role === 'pending') return <div className="p-8">Tu cuenta está confirmada. Falta que el administrador habilite el acceso.<button onClick={logout} className="block mt-4">Cerrar sesión</button></div>;
  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/lotes" element={<Lotes />} />
      <Route element={<RoleRoute roles={["admin", "muestreador"]} />}>
        <Route path="/nueva-sesion" element={<NuevaSesion />} />
      </Route>
      <Route path="/sesion/:id" element={<SesionResultado />} />
      <Route path="/bloque/:id" element={<BloqueDetalle />} />
      <Route path="/comparar" element={<Comparar />} />
      <Route element={<RoleRoute roles={["admin"]} />}>
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <OfflineBridge />
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App