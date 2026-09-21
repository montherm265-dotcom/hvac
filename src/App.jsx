import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { I18nProvider } from '@/i18n';
import RequireAuth from '@/components/RequireAuth';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import Auth from '@/pages/Auth';
import Onboarding from '@/pages/Onboarding';
import AskHuman from '@/pages/AskHuman';
import RequestDetail from '@/pages/RequestDetail';
import NewMission from '@/pages/NewMission';
import MissionDetail from '@/pages/MissionDetail';
import NeedsYou from '@/pages/NeedsYou';
import HumanChains from '@/pages/HumanChains';
import HumanMemory from '@/pages/HumanMemory';
import Search from '@/pages/Search';
import Messages from '@/pages/Messages';
import Conversation from '@/pages/Conversation';
import Notifications from '@/pages/Notifications';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import Admin from '@/pages/Admin';
import Safety from '@/pages/Safety';
import About from '@/pages/About';

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/safety" element={<Safety />} />
              <Route path="/about" element={<About />} />
              <Route path="/search" element={<Search />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/missions/:id" element={<MissionDetail />} />
              <Route path="/requests/:id" element={<RequestDetail />} />
              <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
              <Route path="/ask" element={<RequireAuth><AskHuman /></RequireAuth>} />
              <Route path="/missions/new" element={<RequireAuth><NewMission /></RequireAuth>} />
              <Route path="/needs-you" element={<RequireAuth><NeedsYou /></RequireAuth>} />
              <Route path="/chains" element={<RequireAuth><HumanChains /></RequireAuth>} />
              <Route path="/memory" element={<RequireAuth><HumanMemory /></RequireAuth>} />
              <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
              <Route path="/messages/:id" element={<RequireAuth><Conversation /></RequireAuth>} />
              <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
