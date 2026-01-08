import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import OverviewPage from './pages/OverviewPage';
import EntryPage from './pages/EntryPage';
import QuizPage from './pages/QuizPage';
import RandomEntryRedirect from './pages/RandomEntryRedirect';
import './App.css';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const startRandomQuiz = () => {
    navigate(`/quiz?mode=all&nonce=${Date.now()}`);
  };
  const startRandomReel = () => {
    navigate(`/entry/random?nonce=${Date.now()}`);
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
            <NavLink
              to="/quiz?mode=all"
              className={({ isActive }) => (isActive ? 'link active' : 'link')}
              onClick={(e) => {
                e.preventDefault();
                startRandomQuiz();
              }}
            >
              New Random Quiz
            </NavLink>
            <NavLink
              to="/entry/random"
              className={({ isActive }) =>
                isActive || location.pathname.startsWith('/entry') ? 'link active' : 'link'
              }
              onClick={(e) => {
                e.preventDefault();
                startRandomReel();
              }}
            >
              Random Reel
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/entry/random" element={<RandomEntryRedirect />} />
          <Route path="/entry/:idEncoded" element={<EntryPage />} />
          <Route path="/quiz" element={<QuizPage />} />
        </Routes>
      </main>
    </div>
  );
}
