import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import DNAHelix from './components/ui/DNAHelix';
import ParticleField from './components/ui/ParticleField';
import HomePage from './pages/HomePage';
import GeneDashboardPage from './pages/GeneDashboardPage';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);

  return (
    <BrowserRouter>
      <div className={`noise-overlay min-h-screen flex flex-col ${darkMode ? 'dark' : ''}`}>
        {/* Background layers */}
        <DNAHelix opacity={0.1} />
        <ParticleField />

        {/* App shell */}
        <Navbar darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />

        <main className="flex-1 relative z-10 pt-14">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/gene/:symbol" element={<GeneDashboardPage />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}
