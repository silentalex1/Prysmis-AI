import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import AccountAuth from './AccountAuth';
import Dashboard from './Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/accountauth" element={<AccountAuth />} />
        <Route path="/dashboard/project" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
