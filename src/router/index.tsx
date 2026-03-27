import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import HomeScreen from '../screens/HomeScreen';
import WorldMapScreen from '../screens/WorldMapScreen';
import ActivityScreen from '../screens/ActivityScreen';
import RewardScreen from '../screens/RewardScreen';
import ParentDashboardScreen from '../screens/ParentDashboardScreen';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'world', element: <WorldMapScreen /> },
      { path: 'activity/:id', element: <ActivityScreen /> },
      { path: 'reward', element: <RewardScreen /> },
      { path: 'parent', element: <ParentDashboardScreen /> },
    ],
  },
]);

export default router;
