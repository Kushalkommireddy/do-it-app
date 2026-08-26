'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import TodoApp from './TodoApp';
import ExpenseApp from './ExpenseApp';

export default function Page() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [theme, setTheme] = useState('light');
  const [view, setView] = useState('chooser'); // chooser | todo | expense

  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState({ text: '', ok: false });
  const [busy, setBusy] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('doit-theme') : null;
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    document.body.className = 'theme-' + theme;
    if (typeof window !== 'undefined') localStorage.setItem('doit-theme', theme);
  }, [theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setCheckingSession(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        // Fires even if the person clicked the emailed link directly instead
        // of typing the code — force them through "choose new password"
        // no matter how they got a valid recovery session.
        setRecovering(true);
        setAuthMode('recover3');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmitAuth() {
    setMsg({ text: '', ok: false });
    if (!email || !password) { setMsg({ text: 'Please fill in all fields.', ok: false }); return; }
    setBusy(true);
    if (authMode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg({ text: error.message, ok: false });
      else setMsg({ text: 'Account created — signing you in…', ok: true });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ text: error.message, ok: false });
    }
    setBusy(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setView('chooser');
    setRecovering(false);
    setAuthMode('signin');
  }

  async function handleSendCode() {
    setMsg({ text: '', ok: false });
    if (!recoverEmail) { setMsg({ text: 'Enter your email.', ok: false }); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(recoverEmail);
    setBusy(false);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setAuthMode('recover2');
  }

  async function handleVerifyCode() {
    setMsg({ text: '', ok: false });
    if (!otp.trim()) { setMsg({ text: 'Enter the code from your email.', ok: false }); return; }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: recoverEmail, token: otp.trim(), type: 'recovery' });
    setBusy(false);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setMsg({ text: 'Verified!', ok: true });
    setAuthMode('recover3');
  }

  async function handleResetPassword() {
    setMsg({ text: '', ok: false });
    if (!newPass || newPass.length < 6) { setMsg({ text: 'Password must be at least 6 characters.', ok: false }); return; }
    if (newPass !== newPass2) { setMsg({ text: 'Passwords do not match.', ok: false }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setBusy(false);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setMsg({ text: 'Password updated. Signing you in…', ok: true });
    setTimeout(() => setRecovering(false), 1200);
  }

  if (checkingSession) return <div style={{ minHeight: '100vh' }} />;

  // ================= LOGGED OUT (or mid password-recovery) =================
  if (!session || recovering) {
    return (
      <div className="screen" id="loginScreen">
        <div className="login-card">
          <div className="brand-mark">
            <div className="brand-square"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></div>
            <div className="wordmark">Do it!</div>
          </div>

          {(authMode === 'signin' || authMode === 'register') && (
            <>
              <h1 className="login-title">{authMode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
              <p className="login-sub">Write it down, check it off, get it done.</p>
              <div className="tabbar">
                <button className={authMode === 'signin' ? 'active' : ''} onClick={() => { setAuthMode('signin'); setMsg({ text: '', ok: false }); }}>Sign in</button>
                <button className={authMode === 'register' ? 'active' : ''} onClick={() => { setAuthMode('register'); setMsg({ text: '', ok: false }); }}>Create account</button>
              </div>
              <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
              <div className="field"><label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmitAuth()} placeholder="••••••••" />
              </div>
              {authMode === 'signin' && (
                <div className="forgot-row"><button className="link-btn" onClick={() => { setAuthMode('recover1'); setMsg({ text: '', ok: false }); setRecoverEmail(''); setRecovering(true); }}>Forgot password?</button></div>
              )}
              <button className="btn-primary" disabled={busy} onClick={handleSubmitAuth}>{authMode === 'signin' ? 'Sign in' : 'Create account'}</button>
              <div className={'login-msg' + (msg.ok ? ' ok' : '')}>{msg.text}</div>
            </>
          )}

          {authMode === 'recover1' && (
            <>
              <button className="back-link" onClick={() => { setAuthMode('signin'); setRecovering(false); }}>← Back to sign in</button>
              <h1 className="login-title">Reset your password</h1>
              <p className="login-sub">Enter the email on your account. We'll email you a 6-digit code.</p>
              <div className="field"><label>Email</label><input type="email" value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} placeholder="you@example.com" /></div>
              <button className="btn-primary" disabled={busy} onClick={handleSendCode}>Send verification code</button>
              <div className={'login-msg' + (msg.ok ? ' ok' : '')}>{msg.text}</div>
            </>
          )}

          {authMode === 'recover2' && (
            <>
              <button className="back-link" onClick={() => setAuthMode('recover1')}>← Back</button>
              <h1 className="login-title">Enter your code</h1>
              <p className="login-sub">Check {recoverEmail} for your verification code.</p>
              <input
                style={{ width: '100%', textAlign: 'center', letterSpacing: '6px', fontSize: 20, fontFamily: 'var(--display)', fontWeight: 700, background: 'var(--bg-3)', border: '1.5px solid transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '12px' }}
                value={otp}
                onChange={(e) => setOtp(e.target.value.trim())}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                placeholder="Paste or type the code from the email"
              />
              <button className="btn-primary" disabled={busy} style={{ marginTop: 14 }} onClick={handleVerifyCode}>Verify code</button>
              <div className={'login-msg' + (msg.ok ? ' ok' : '')}>{msg.text}</div>
            </>
          )}

          {authMode === 'recover3' && (
            <>
              <h1 className="login-title">Choose a new password</h1>
              <p className="login-sub">You're verified — set a new password to finish.</p>
              <div className="field"><label>New password</label><input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="••••••••" /></div>
              <div className="field"><label>Confirm new password</label><input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} placeholder="••••••••" /></div>
              <button className="btn-primary" disabled={busy} onClick={handleResetPassword}>Update password</button>
              <div className={'login-msg' + (msg.ok ? ' ok' : '')}>{msg.text}</div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ================= LOGGED IN: CHOOSER =================
  if (view === 'chooser') {
    return (
      <div className="chooser-wrap">
        <div className="topbar">
          <div className="topbar-left">
            <div className="brand-mark" style={{ marginBottom: 0 }}>
              <div className="brand-square"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></div>
              <div className="wordmark">Do it!</div>
            </div>
          </div>
          <div className="topbar-right">
            <span className="user-chip">{session.user.email}</span>
            <select className="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">Light</option>
              <option value="aurora">Aurora</option>
              <option value="hero">Hero Squad</option>
            </select>
            <button className="icon-btn" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
        <div className="chooser-main">
          <h1 className="chooser-title">What are we doing today?</h1>
          <p className="chooser-sub">Pick a workspace to jump in.</p>
          <div className="chooser-cards">
            <div className="chooser-card" onClick={() => setView('todo')}>
              <div className="chooser-icon" style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent2))' }}>
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h3>Do it!</h3>
              <p>Tasks, checklists, due dates, and a calendar to keep it all straight.</p>
            </div>
            <div className="chooser-card" onClick={() => setView('expense')}>
              <div className="chooser-icon" style={{ background: 'linear-gradient(135deg,#FF6B6B,#FFB84C)' }}>
                <svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
              </div>
              <h3>Expense Tracker</h3>
              <p>Log spending by category and see where your money goes.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= LOGGED IN: TODO =================
  if (view === 'todo') {
    return <TodoApp session={session} theme={theme} setTheme={setTheme} onSignOut={handleSignOut} onSwitchApp={() => setView('chooser')} />;
  }

  // ================= LOGGED IN: EXPENSE TRACKER =================
  return <ExpenseApp session={session} theme={theme} setTheme={setTheme} onSignOut={handleSignOut} onSwitchApp={() => setView('chooser')} />;
}
