import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import ToolPage from '@/pages/ToolPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/:slug" element={<ToolPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
