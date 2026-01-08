import { NavLink, Route, Routes } from 'react-router-dom';
import OverviewPage from './pages/OverviewPage';
import EntryPage from './pages/EntryPage';
import QuizPage from './pages/QuizPage';
import './App.css';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          IG Japanese Quizzer
        </NavLink>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'link active' : 'link')}>
            Overview
          </NavLink>
          <NavLink to="/quiz?mode=all" className={({ isActive }) => (isActive ? 'link active' : 'link')}>
            Random Quiz
          </NavLink>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/entry/:idEncoded" element={<EntryPage />} />
          <Route path="/quiz" element={<QuizPage />} />
        </Routes>
      </main>
    </div>
  );
}
