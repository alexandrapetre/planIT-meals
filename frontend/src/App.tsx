import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Navbar from './components/Navbar/Navbar';
import BottomTabs from './components/BottomTabs/BottomTabs';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import Dashboard from './pages/Dashboard/Dashboard';
import Recipes from './pages/Recipes/Recipes';
import MealPlan from './pages/MealPlan/MealPlan';
import Fridge from './pages/Fridge/Fridge';
import Profile from './pages/Profile/Profile';
import Tracking from './pages/Tracking/Tracking';
import { fetchMe } from './store/slices/authSlice';
import { useAppDispatch, useAppSelector } from './store';

export default function App() {
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);
  const location = useLocation();

  useEffect(() => {
    if (token) {
      dispatch(fetchMe());
    }
  }, [dispatch, token]);

  const isAuthRoute =
    location.pathname === '/login' || location.pathname === '/register';
  const showBottomTabs = Boolean(user) && !isAuthRoute;

  return (
    <div className="app">
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/recipes"
            element={
              <PrivateRoute>
                <Recipes />
              </PrivateRoute>
            }
          />
          <Route
            path="/meal-plan"
            element={
              <PrivateRoute>
                <MealPlan />
              </PrivateRoute>
            }
          />
          <Route
            path="/tracking"
            element={
              <PrivateRoute>
                <Tracking />
              </PrivateRoute>
            }
          />
          <Route
            path="/fridge"
            element={
              <PrivateRoute>
                <Fridge />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showBottomTabs && <BottomTabs />}
    </div>
  );
}
