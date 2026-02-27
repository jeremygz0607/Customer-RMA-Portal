import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CustomerModal from './components/CustomerModal';
import AdminDashboard from './components/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/ui" element={<CustomerModal />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/" element={<div>RMA System - Use /ui or /admin</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
