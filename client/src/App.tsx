import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import OverviewPage from './pages/OverviewPage';
import EntryPage from './pages/EntryPage';
import QuizPage from './pages/QuizPage';
import './App.css';

export default function App() {
  const navigate = useNavigate();
  const startRandomQuiz = () => {
    navigate(`/quiz?mode=all&nonce=${Date.now()}`);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink to="/" className="brand">
            IG Japanese Quizzer
          </NavLink>
          <nav>
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'link active' : 'link')}>
              Overview
            </NavLink>
            <button className="link nav-link-btn" onClick={startRandomQuiz}>
              New Random Quiz
            </button>
          </nav>
        </div>
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
