import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import RequireAuth from '@/components/RequireAuth';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import Auth from '@/pages/Auth';
import NewMission from '@/pages/NewMission';
import MissionDetail from '@/pages/MissionDetail';
import NeedsYou from '@/pages/NeedsYou';
import Messages from '@/pages/Messages';
import Conversation from '@/pages/Conversation';
import Notifications from '@/pages/Notifications';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import Safety from '@/pages/Safety';
import About from '@/pages/About';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/about" element={<About />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/missions/:id" element={<MissionDetail />} />
            <Route path="/missions/new" element={<RequireAuth><NewMission /></RequireAuth>} />
            <Route path="/needs-you" element={<RequireAuth><NeedsYou /></RequireAuth>} />
            <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="/messages/:id" element={<RequireAuth><Conversation /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
