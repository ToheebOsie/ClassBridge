import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Route, Routes } from 'react-router-dom';
import { Gallery } from './pages/Gallery.jsx';
import { Landing } from './pages/Landing.jsx';
import { RoleHome } from './pages/RoleHome.jsx';
import { SetPassword } from './pages/SetPassword.jsx';
import { SignIn } from './pages/SignIn.jsx';

/**
 * Pages:
 *  /                       school front page
 *  /:role/sign-in          a sign-in page for each role
 *  /:role                  that role's home (needs sign-in)
 *  /set-password           parent chooses a password (invitation or reset link)
 *  /gallery                the component gallery (design reference)
 */
export function App() {
  const accent = useSelector((s) => s.ui.accent);
  useEffect(() => {
    document.documentElement.style.setProperty('--school-accent', accent);
  }, [accent]);
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/:role/sign-in" element={<SignIn />} />
      <Route path="/:role" element={<RoleHome />} />
    </Routes>
  );
}
