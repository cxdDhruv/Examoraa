// ============================================================
// App.jsx — Main Application with Routing & Auth Context
// ============================================================
import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import SecureExamSystem from './components/SecureExamSystem';
import AdminDashboard from './components/AdminDashboard';
import {
    Shield, LogIn, UserPlus, Mail, Lock, User, ChevronRight,
    BookOpen, GraduationCap, ShieldCheck
} from 'lucide-react';

const API = '/api';
const SOCKET_URL = window.location.origin;

// ============================================================
// Auth Context
// ============================================================
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (token) {
            fetchUser();
            connectSocket();
        } else {
            setLoading(false);
        }
        return () => { if (socket) socket.disconnect(); };
    }, []);

    const connectSocket = () => {
        const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
        setSocket(s);
        return s;
    };

    const fetchUser = async () => {
        try {
            const res = await fetch(`${API}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
                // Register socket
                if (socket) socket.emit('register', { userId: data._id, role: data.role });
            } else {
                logout();
            }
        } catch (err) {
            console.error('Auth check failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        const s = connectSocket();
        s.emit('register', { userId: data.user.id, role: data.user.role });
        return data.user;
    };

    const register = async (name, email, password, role) => {
        const res = await fetch(`${API}/auth/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        const s = connectSocket();
        s.emit('register', { userId: data.user.id, role: data.user.role });
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        if (socket) socket.disconnect();
        setSocket(null);
    };

    const apiFetch = async (url, options = {}) => {
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API}${url}`, { ...options, headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout, loading, socket, apiFetch }}>
            {children}
        </AuthContext.Provider>
    );
}

// ============================================================
// Login Page
// ============================================================
function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(email, password);
            navigate(user.role === 'student' ? '/student' : '/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card glass">
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Shield size={40} color="var(--accent)" />
                </div>
                <h1>Welcome Back</h1>
                <p>Sign in to your secure exam account</p>

                {error && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: 16, border: '1px solid rgba(239,68,68,0.2)' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label><Mail size={13} /> Email</label>
                        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                    </div>
                    <div className="form-group">
                        <label><Lock size={13} /> Password</label>
                        <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                    </div>
                    <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                        {loading ? 'Signing in...' : <>Sign In <ChevronRight size={16} /></>}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Don't have an account?{' '}
                    <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/register')}>
                        Create one
                    </span>
                </p>
            </div>
        </div>
    );
}

// ============================================================
// Register Page
// ============================================================
function RegisterPage() {
    const { register: doRegister } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await doRegister(form.name, form.email, form.password, form.role);
            navigate(user.role === 'student' ? '/student' : '/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const roles = [
        { value: 'student', label: 'Student', icon: GraduationCap, desc: 'Take exams' },
        { value: 'instructor', label: 'Instructor', icon: BookOpen, desc: 'Create & monitor exams' },
        { value: 'admin', label: 'Admin', icon: ShieldCheck, desc: 'Full system access' },
    ];

    return (
        <div className="auth-page">
            <div className="auth-card glass">
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Shield size={40} color="var(--accent)" />
                </div>
                <h1>Create Account</h1>
                <p>Join the secure examination platform</p>

                {error && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: 16, border: '1px solid rgba(239,68,68,0.2)' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label><User size={13} /> Full Name</label>
                        <input className="input" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" required />
                    </div>
                    <div className="form-group">
                        <label><Mail size={13} /> Email</label>
                        <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
                    </div>
                    <div className="form-group">
                        <label><Lock size={13} /> Password</label>
                        <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" required minLength={6} />
                    </div>

                    <div className="form-group">
                        <label>Select Role</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {roles.map(r => (
                                <button key={r.value} type="button" onClick={() => setForm({ ...form, role: r.value })}
                                    style={{
                                        flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                                        background: form.role === r.value ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${form.role === r.value ? 'var(--accent)' : 'var(--border)'}`,
                                        color: form.role === r.value ? 'var(--accent)' : 'var(--text-muted)',
                                        textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit'
                                    }}
                                >
                                    <r.icon size={18} style={{ display: 'block', margin: '0 auto 4px' }} />
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                        {loading ? 'Creating...' : <>Create Account <ChevronRight size={16} /></>}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Already have an account?{' '}
                    <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/login')}>
                        Sign in
                    </span>
                </p>
            </div>
        </div>
    );
}

// ============================================================
// Protected Route
// ============================================================
function ProtectedRoute({ children, roles }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Shield size={32} style={{ animation: 'pulse 1.5s infinite' }} />
                    <p style={{ marginTop: 8 }}>Loading...</p>
                </div>
            </div>
        );
    }
    if (!user) return <Navigate to="/login" />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
    return children;
}

// ============================================================
// Landing Page
// ============================================================
function LandingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    if (user) {
        return <Navigate to={user.role === 'student' ? '/student' : '/dashboard'} />;
    }

    const features = [
        { icon: '🔒', title: 'Anti-Cheat Engine', desc: 'Tab switching, copy-paste, fullscreen, webcam, devtools — all monitored' },
        { icon: '📷', title: 'Webcam Proctoring', desc: 'Periodic snapshots with live feed during exam' },
        { icon: '⚡', title: 'Auto-Grading', desc: 'Instant scoring for MCQ and True/False questions' },
        { icon: '📊', title: 'Live Monitoring', desc: 'Real-time WebSocket updates for instructors' },
        { icon: '🛡️', title: 'Violation Tracking', desc: 'Every suspicious action logged with timestamps' },
        { icon: '🎯', title: 'Configurable Rules', desc: 'Per-exam anti-cheat settings and thresholds' },
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 20% 20%, rgba(129,140,248,0.08), transparent 50%), radial-gradient(circle at 80% 80%, rgba(34,211,238,0.06), transparent 50%), var(--bg-primary)' }}>
            {/* Hero */}
            <div style={{ textAlign: 'center', padding: '80px 24px 60px' }} className="fade-in">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <Shield size={48} color="var(--accent)" />
                    <span style={{ fontSize: '2rem', fontWeight: 800 }}>SecureExam</span>
                </div>
                <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>
                    Anti-Cheat Online<br />
                    <span style={{ background: 'linear-gradient(90deg, var(--accent), var(--info))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Examination System
                    </span>
                </h1>
                <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6 }}>
                    Full-stack secure examination platform with real-time proctoring, webcam monitoring, violation tracking, and auto-grading.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
                        Get Started <ChevronRight size={18} />
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={() => navigate('/login')}>
                        Sign In
                    </button>
                </div>
            </div>

            {/* Features */}
            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 80px' }}>
                <div className="grid grid-3">
                    {features.map((f, i) => (
                        <div key={i} className="glass exam-card fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// App
// ============================================================
export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/student/*" element={
                        <ProtectedRoute roles={['student']}>
                            <SecureExamSystem />
                        </ProtectedRoute>
                    } />
                    <Route path="/dashboard/*" element={
                        <ProtectedRoute roles={['instructor', 'admin']}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
