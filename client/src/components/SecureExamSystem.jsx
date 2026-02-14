// ============================================================
// SecureExamSystem.jsx — Student Interface with Anti-Cheat Engine
// Complete exam taking system with webcam, tab detection, etc.
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App';
import {
    Shield, Clock, AlertTriangle, Camera, CameraOff, Eye, EyeOff,
    ChevronLeft, ChevronRight, Flag, Send, CheckCircle, XCircle,
    BookOpen, Timer, BarChart3, LogOut, Home, Monitor, Play
} from 'lucide-react';

const API = '/api';

// ============================================================
// Header
// ============================================================
function StudentHeader() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    return (
        <header className="header">
            <div className="header-brand">
                <Shield size={22} />
                <span>SecureExam</span>
            </div>
            <div className="header-actions">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {user?.name}
                </span>
                <span className="badge badge-primary">{user?.role}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>
                    <LogOut size={16} /> Sign Out
                </button>
            </div>
        </header>
    );
}

// ============================================================
// Exam List (Student Dashboard)
// ============================================================
function ExamList() {
    const { apiFetch } = useAuth();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [examData, dashData] = await Promise.all([
                apiFetch('/exams'),
                apiFetch('/dashboard/student')
            ]);
            setExams(examData.exams || []);
            setAttempts(dashData.recentAttempts || []);
            setStats(dashData.stats);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading exams...</p></div>;

    return (
        <div className="page">
            <h1 className="page-title">Student Dashboard</h1>
            <p className="page-subtitle">Your available exams and results</p>

            {/* Stats */}
            {stats && (
                <div className="grid grid-4" style={{ marginBottom: 24 }}>
                    {[
                        { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'var(--success)' },
                        { label: 'Avg Score', value: `${stats.avgScore}%`, icon: BarChart3, color: 'var(--accent)' },
                        { label: 'Passed', value: stats.passed, icon: CheckCircle, color: 'var(--info)' },
                        { label: 'Failed', value: stats.failed, icon: XCircle, color: 'var(--danger)' },
                    ].map((s, i) => (
                        <div key={i} className="stat-card glass">
                            <div className="stat-icon" style={{ background: `${s.color}15`, color: s.color }}>
                                <s.icon size={22} />
                            </div>
                            <div>
                                <span className="stat-value">{s.value}</span>
                                <span className="stat-label">{s.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Available Exams */}
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>
                <BookOpen size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Available Exams
            </h2>

            {exams.length === 0 ? (
                <div className="empty-state glass">
                    <BookOpen size={40} />
                    <p>No exams available right now.</p>
                </div>
            ) : (
                <div className="grid grid-3">
                    {exams.map(exam => {
                        const attempted = attempts.find(a => a.exam?._id === exam._id || a.exam === exam._id);
                        return (
                            <div key={exam._id} className="glass exam-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                                    <span className="badge badge-primary">{exam.subject}</span>
                                    {attempted && (
                                        <span className={`badge ${attempted.status === 'submitted' || attempted.status === 'auto_submitted' ? 'badge-success' : 'badge-warning'}`}>
                                            {attempted.status === 'in_progress' ? 'In Progress' : `${attempted.percentage}%`}
                                        </span>
                                    )}
                                </div>
                                <h3>{exam.title}</h3>
                                <p>{exam.description || 'No description'}</p>
                                <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    <span><Clock size={13} /> {exam.duration} min</span>
                                    <span><BarChart3 size={13} /> {exam.totalMarks} marks</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                    {exam.antiCheatSettings?.webcamRequired && <span className="badge badge-danger"><Camera size={10} /> Webcam</span>}
                                    {exam.antiCheatSettings?.fullScreenRequired && <span className="badge badge-warning"><Monitor size={10} /> Fullscreen</span>}
                                </div>
                                <button
                                    className="btn btn-primary" style={{ width: '100%', marginTop: 14 }}
                                    onClick={() => navigate(`/student/exam/${exam._id}`)}
                                    disabled={attempted && !['in_progress'].includes(attempted.status) && !exam.allowMultipleAttempts}
                                >
                                    {attempted?.status === 'in_progress' ? <>Resume <ChevronRight size={14} /></> :
                                        attempted ? 'Already Completed' :
                                            <><Play size={14} /> Start Exam</>}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Recent Attempts */}
            {attempts.length > 0 && (
                <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>Recent Results</h2>
                    <div className="glass" style={{ overflow: 'hidden' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Exam</th>
                                    <th>Score</th>
                                    <th>Percentage</th>
                                    <th>Status</th>
                                    <th>Violations</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attempts.map(a => (
                                    <tr key={a._id}>
                                        <td><strong>{a.exam?.title || 'Unknown'}</strong></td>
                                        <td>{a.score}/{a.totalMarks}</td>
                                        <td>{a.percentage}%</td>
                                        <td>
                                            <span className={`badge ${a.passed ? 'badge-success' : a.status === 'in_progress' ? 'badge-warning' : 'badge-danger'}`}>
                                                {a.passed ? 'Passed' : a.status === 'in_progress' ? 'In Progress' : 'Failed'}
                                            </span>
                                        </td>
                                        <td>
                                            {a.violations?.length > 0 ? (
                                                <span className="badge badge-danger">{a.violations.length} <AlertTriangle size={10} /></span>
                                            ) : '—'}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)' }}>
                                            {a.startedAt ? new Date(a.startedAt).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
// SECURE EXAM TAKING INTERFACE (Anti-Cheat Engine)
// ============================================================
function TakeExam({ examId }) {
    const { apiFetch, user, token, socket } = useAuth();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const timerRef = useRef(null);
    const snapshotRef = useRef(null);

    // ===== REFS to avoid stale closures in event handlers =====
    const attemptRef = useRef(null);
    const submittedRef = useRef(false);
    const tokenRef = useRef(token);
    const socketRef = useRef(socket);
    const cancelledRef = useRef(false);
    const listenersRef = useRef([]); // track all listeners for cleanup

    // Keep refs in sync with state/props
    useEffect(() => { tokenRef.current = token; }, [token]);
    useEffect(() => { socketRef.current = socket; }, [socket]);

    // Exam state
    const [exam, setExam] = useState(null);
    const [attempt, setAttempt] = useState(null);
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState({});
    const [flagged, setFlagged] = useState(new Set());
    const [timeLeft, setTimeLeft] = useState(0);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Anti-cheat state
    const [violations, setViolations] = useState([]);
    const [tabSwitches, setTabSwitches] = useState(0);
    const [webcamActive, setWebcamActive] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [cancelled, setCancelled] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [showWarning, setShowWarning] = useState('');

    const maxViolations = exam?.antiCheatSettings?.tabSwitchLimit || 3;

    // ====== CANCEL EXAM (uses refs — safe from closures) ======
    const doCancelExam = (reason) => {
        if (cancelledRef.current || submittedRef.current) return;
        cancelledRef.current = true;
        submittedRef.current = true;
        setCancelReason(reason || 'Exam cancelled due to violation');
        setCancelled(true);
        setSubmitted(true);
        doCleanup();
        if (document.fullscreenElement) document.exitFullscreen?.();
    };

    // ====== LOG VIOLATION (uses refs — always reads latest attempt) ======
    const doLogViolation = async (type, description, severity = 'medium') => {
        const att = attemptRef.current;
        if (!att || submittedRef.current || cancelledRef.current) return;

        console.log(`🚨 VIOLATION: ${type} — ${description}`);
        setViolations(prev => [...prev, { type, description, severity, timestamp: new Date() }]);

        if (type === 'tab_switch' || type === 'window_blur') {
            setTabSwitches(prev => prev + 1);
        }

        // ===== INSTANT CANCEL RULES =====
        if (type === 'tab_switch' || type === 'window_blur') {
            doCancelExam('Tab switching detected — exam cancelled');
        }
        if (type === 'screenshot') {
            doCancelExam('Screenshot detected — exam cancelled');
        }

        // Flash warning
        setShowWarning(description);
        setTimeout(() => setShowWarning(''), 3000);

        // Report to server
        try {
            await fetch(`${API}/attempts/${att._id}/violation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
                body: JSON.stringify({ type, description, severity: 'critical' })
            });

            if (socketRef.current) {
                socketRef.current.emit('violation', {
                    attemptId: att._id, examId, studentName: user.name,
                    violation: { type, description, severity: 'critical' }
                });
            }
        } catch (err) {
            console.error('Log violation error:', err);
        }
    };

    // ====== SETUP ANTI-CHEAT (registers plain handlers — no stale closures) ======
    const setupAntiCheat = (settings) => {
        const listen = (target, event, handler) => {
            target.addEventListener(event, handler);
            listenersRef.current.push({ target, event, handler });
        };

        // Tab visibility change → INSTANT CANCEL
        listen(document, 'visibilitychange', () => {
            if (document.hidden && !submittedRef.current) {
                doLogViolation('tab_switch', 'Student switched to another tab', 'high');
            }
        });

        // Window blur → INSTANT CANCEL
        listen(window, 'blur', () => {
            if (!submittedRef.current) {
                doLogViolation('window_blur', 'Window lost focus', 'high');
            }
        });

        // Fullscreen exit
        listen(document, 'fullscreenchange', () => {
            if (!document.fullscreenElement && !submittedRef.current) {
                setIsFullscreen(false);
                doLogViolation('fullscreen_exit', 'Student exited fullscreen mode', 'medium');
            }
        });

        // Keyboard shortcuts
        listen(document, 'keydown', (e) => {
            if (submittedRef.current) return;
            // PrintScreen → INSTANT CANCEL
            if (e.key === 'PrintScreen') { e.preventDefault(); doLogViolation('screenshot', 'PrintScreen key detected', 'high'); return; }
            // Mac screenshot shortcuts → INSTANT CANCEL
            if (e.metaKey && e.shiftKey && ['3', '4'].includes(e.key)) { e.preventDefault(); doLogViolation('screenshot', 'Mac screenshot shortcut detected', 'high'); return; }
            // F12 / DevTools
            if (e.key === 'F12') { e.preventDefault(); doLogViolation('devtools', 'F12 key pressed (DevTools attempt)', 'high'); return; }
            if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) { e.preventDefault(); doLogViolation('devtools', 'DevTools shortcut detected', 'high'); return; }
            // Copy/Paste/Cut/Select-All/Print
            if (e.ctrlKey && !e.shiftKey && ['c', 'v', 'x', 'a', 'p'].includes(e.key.toLowerCase())) { e.preventDefault(); doLogViolation('copy_paste', `Ctrl+${e.key.toUpperCase()} blocked`, 'medium'); return; }
            // Alt+Tab
            if (e.altKey && e.key === 'Tab') { e.preventDefault(); doLogViolation('tab_switch', 'Alt+Tab attempted', 'high'); return; }
        });

        // Right-click
        if (settings?.copyPasteBlocked !== false) {
            listen(document, 'contextmenu', (e) => { e.preventDefault(); doLogViolation('right_click', 'Right-click attempted', 'low'); });
            listen(document, 'copy', (e) => { e.preventDefault(); doLogViolation('copy_paste', 'Copy attempted', 'medium'); });
            listen(document, 'paste', (e) => { e.preventDefault(); doLogViolation('copy_paste', 'Paste attempted', 'medium'); });
            listen(document, 'cut', (e) => { e.preventDefault(); doLogViolation('copy_paste', 'Cut attempted', 'medium'); });
        }

        // Window resize
        listen(window, 'resize', () => {
            doLogViolation('resize', 'Window resized (possible screen sharing)', 'low');
        });
    };

    // ====== CLEANUP (removes all listeners) ======
    const doCleanup = () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        if (snapshotRef.current) clearInterval(snapshotRef.current);
        // Remove all registered listeners
        listenersRef.current.forEach(({ target, event, handler }) => {
            target.removeEventListener(event, handler);
        });
        listenersRef.current = [];
    };

    // ====== START EXAM ======
    useEffect(() => {
        startExam();
        return () => { doCleanup(); };
    }, []);

    const startExam = async () => {
        try {
            // ========== CAMERA GATE ==========
            let cameraStream = null;
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
                streamRef.current = cameraStream;
                setWebcamActive(true);
            } catch (camErr) {
                setError('Camera access is REQUIRED to start this exam. Please allow camera access and try again.');
                setLoading(false);
                return;
            }

            const data = await apiFetch(`/exams/${examId}/start`, { method: 'POST' });
            setExam(data.exam);
            setAttempt(data.attempt);
            // ===== SET REFS IMMEDIATELY (before handlers fire) =====
            attemptRef.current = data.attempt;
            setTimeLeft(data.exam.duration * 60);

            // Attach camera feed
            if (videoRef.current && cameraStream) {
                videoRef.current.srcObject = cameraStream;
            }
            snapshotRef.current = setInterval(() => captureSnapshot(), 30000);

            // Restore existing answers
            if (data.attempt.answers) {
                const existing = {};
                data.attempt.answers.forEach(a => { existing[a.questionId] = a.answer; });
                setAnswers(existing);
            }

            // Register with socket
            if (socket) {
                socket.emit('join-exam', { attemptId: data.attempt._id, examId });
            }

            // Fullscreen
            if (data.exam.antiCheatSettings?.fullScreenRequired) enterFullscreen();

            // ===== SETUP ANTI-CHEAT (after refs are set) =====
            setupAntiCheat(data.exam.antiCheatSettings);

            setLoading(false);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    // ====== TIMER ======
    useEffect(() => {
        if (timeLeft <= 0 || submitted || !attempt) return;
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    autoSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [attempt, submitted]);

    // ====== WEBCAM ======
    // Camera is gated in startExam() — exam won't start without it

    const captureSnapshot = async () => {
        if (!videoRef.current || !attemptRef.current) return;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 240;
            canvas.getContext('2d').drawImage(videoRef.current, 0, 0, 320, 240);
            const imageData = canvas.toDataURL('image/jpeg', 0.5);

            await fetch(`${API}/attempts/${attemptRef.current._id}/snapshot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
                body: JSON.stringify({ imageData })
            });
        } catch (err) {
            console.error('Snapshot error:', err);
        }
    };

    // ====== FULLSCREEN ======
    const enterFullscreen = () => {
        try {
            document.documentElement.requestFullscreen?.() || document.documentElement.webkitRequestFullscreen?.();
            setIsFullscreen(true);
        } catch (err) {
            console.error('Fullscreen error:', err);
        }
    };

    // ====== ANSWER HANDLING ======
    const saveAnswer = async (questionId, answer) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
        if (attemptRef.current) {
            try {
                await apiFetch(`/attempts/${attemptRef.current._id}/answer`, {
                    method: 'POST',
                    body: JSON.stringify({ questionId, answer })
                });
            } catch (err) {
                console.error('Save answer error:', err);
            }
        }
    };

    // ====== SUBMIT ======
    const submitExam = async () => {
        if (!attemptRef.current || submittedRef.current) return;
        if (!window.confirm('Are you sure you want to submit? You cannot undo this.')) return;
        await doSubmit(false);
    };

    const autoSubmit = async () => { await doSubmit(true); };

    const doSubmit = async (isAuto) => {
        if (!attemptRef.current) return;
        try {
            const data = await apiFetch(`/attempts/${attemptRef.current._id}/submit`, {
                method: 'POST',
                body: JSON.stringify({ autoSubmit: isAuto })
            });
            submittedRef.current = true;
            setSubmitted(true);
            setResult(data);
            doCleanup();
            if (document.fullscreenElement) document.exitFullscreen?.();
        } catch (err) {
            console.error('Submit error:', err);
        }
    };

    // ====== FORMAT TIME ======
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // ====== RENDER STATES ======
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
                <Shield size={40} style={{ animation: 'pulse 1.5s infinite' }} />
                <p>Setting up secure exam environment...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
                <XCircle size={48} color="var(--danger)" />
                <h2>Cannot Start Exam</h2>
                <p style={{ color: 'var(--text-muted)' }}>{error}</p>
                <button className="btn btn-primary" onClick={() => navigate('/student')}>
                    <Home size={16} /> Back to Dashboard
                </button>
            </div>
        );
    }

    // Cancelled screen
    if (cancelled) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <XCircle size={40} color="var(--danger)" />
                </div>
                <h1 style={{ color: 'var(--danger)' }}>🚫 Exam Cancelled</h1>
                <p style={{ color: 'var(--text-secondary)', maxWidth: 400, textAlign: 'center' }}>
                    {cancelReason || 'Your exam has been automatically cancelled due to a security violation.'}
                    <br /><br />
                    <strong>This has been reported to your instructor.</strong>
                </p>
                <div className="glass" style={{ padding: 20, maxWidth: 400, width: '100%' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>Violations: <strong style={{ color: 'var(--danger)' }}>{violations.length}</strong></p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tab Switches: <strong style={{ color: 'var(--danger)' }}>{tabSwitches}</strong></p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/student')}>
                    <Home size={16} /> Back to Dashboard
                </button>
            </div>
        );
    }

    // Result screen
    if (submitted && result) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, padding: 24 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: result.passed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {result.passed ? <CheckCircle size={40} color="var(--success)" /> : <XCircle size={40} color="var(--danger)" />}
                </div>
                <h1>{result.passed ? 'Congratulations! 🎉' : 'Exam Completed'}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    {result.passed ? 'You passed the exam!' : 'Better luck next time.'}
                </p>
                <div className="glass" style={{ padding: 28, maxWidth: 400, width: '100%', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 800, background: 'linear-gradient(90deg, var(--accent), var(--info))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>
                        {result.percentage}%
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Score: {result.score} / {result.totalMarks}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
                        <span className={`badge ${result.passed ? 'badge-success' : 'badge-danger'}`}>
                            {result.passed ? 'PASSED' : 'FAILED'}
                        </span>
                        {result.flagged && <span className="badge badge-warning">⚠️ Flagged</span>}
                    </div>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/student')}>
                    <Home size={16} /> Back to Dashboard
                </button>
            </div>
        );
    }

    // ====== EXAM INTERFACE ======
    const questions = exam?.questions || [];
    const q = questions[currentQ];
    const progress = Object.keys(answers).length;

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Top Bar */}
            <div className="header" style={{ padding: '10px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Shield size={20} color="var(--accent)" />
                    <strong style={{ fontSize: '0.9rem' }}>{exam?.title}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Violations indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                        <AlertTriangle size={14} color={violations.length > 0 ? 'var(--danger)' : 'var(--text-muted)'} />
                        <span style={{ color: violations.length > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                            {violations.length}/{maxViolations * 2}
                        </span>
                    </div>

                    {/* Timer */}
                    <div className={`timer ${timeLeft < 60 ? 'timer-danger' : timeLeft < 300 ? 'timer-warning' : 'timer-normal'}`}>
                        <Timer size={16} />
                        {formatTime(timeLeft)}
                    </div>

                    <button className="btn btn-danger btn-sm" onClick={submitExam}>
                        <Send size={14} /> Submit
                    </button>
                </div>
            </div>

            {/* Warning Banner */}
            {showWarning && (
                <div className="violation-bar fade-in">
                    <AlertTriangle size={18} color="var(--danger)" />
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ Violation: {showWarning}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {violations.length}/{maxViolations * 2} total violations
                    </span>
                </div>
            )}

            {/* Main Content */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Sidebar */}
                <div style={{ width: 260, padding: 16, borderRight: '1px solid var(--border)', overflowY: 'auto', flexShrink: 0 }}>
                    {/* Webcam */}
                    <div className="webcam-container" style={{ marginBottom: 16 }}>
                        <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', display: webcamActive ? 'block' : 'none' }} />
                        {!webcamActive && (
                            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                <CameraOff size={24} style={{ marginBottom: 4 }} /><br />Camera Off
                            </div>
                        )}
                        <div className={`webcam-overlay ${webcamActive ? 'webcam-live' : 'webcam-off'}`}>
                            {webcamActive ? <><Camera size={10} /> LIVE</> : <><CameraOff size={10} /> OFF</>}
                        </div>
                    </div>

                    {/* Progress */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                            <span>Progress</span>
                            <span>{progress}/{questions.length}</span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${(progress / questions.length) * 100}%` }} />
                        </div>
                    </div>

                    {/* Question Navigator */}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Questions</div>
                    <div className="q-nav">
                        {questions.map((_, i) => (
                            <button
                                key={i}
                                className={`q-nav-btn ${i === currentQ ? 'current' : ''} ${answers[questions[i]._id] ? 'answered' : ''} ${flagged.has(i) ? 'flagged' : ''}`}
                                onClick={() => setCurrentQ(i)}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>

                    {/* Tab switch warning */}
                    {tabSwitches > 0 && (
                        <div style={{ marginTop: 16, padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.78rem' }}>
                            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                ⚠️ Tab Switches: {tabSwitches}/{maxViolations}
                            </span>
                            <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: '0.72rem' }}>
                                {tabSwitches >= maxViolations - 1 ? 'Last warning! Next switch will cancel exam.' : 'Avoid switching tabs.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Question Area */}
                <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
                    {q && (
                        <div className="fade-in" key={currentQ}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <div>
                                    <span className="badge badge-primary" style={{ marginRight: 8 }}>
                                        Q{currentQ + 1} of {questions.length}
                                    </span>
                                    <span className="badge badge-info">{q.type.replace('_', ' ')}</span>
                                    <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', marginLeft: 8 }}>
                                        {q.marks} mark{q.marks > 1 ? 's' : ''}
                                    </span>
                                </div>
                                <button
                                    className={`btn btn-sm ${flagged.has(currentQ) ? 'btn-warning' : 'btn-ghost'}`}
                                    onClick={() => setFlagged(prev => { const s = new Set(prev); flagged.has(currentQ) ? s.delete(currentQ) : s.add(currentQ); return s; })}
                                >
                                    <Flag size={14} /> {flagged.has(currentQ) ? 'Flagged' : 'Flag'}
                                </button>
                            </div>

                            <div className="glass question-card">
                                <p className="question-text">{q.questionText}</p>

                                {(q.type === 'multiple_choice') && (
                                    <div>
                                        {q.options.map((opt, i) => (
                                            <button
                                                key={i}
                                                className={`option-btn ${answers[q._id] === opt ? 'selected' : ''}`}
                                                onClick={() => saveAnswer(q._id, opt)}
                                            >
                                                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                                                <span>{opt}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {q.type === 'true_false' && (
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        {['True', 'False'].map(val => (
                                            <button
                                                key={val}
                                                className={`option-btn ${answers[q._id] === val ? 'selected' : ''}`}
                                                style={{ flex: 1, justifyContent: 'center' }}
                                                onClick={() => saveAnswer(q._id, val)}
                                            >
                                                {val === 'True' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                                <span style={{ fontWeight: 600 }}>{val}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {q.type === 'short_answer' && (
                                    <textarea
                                        className="textarea"
                                        rows={4}
                                        placeholder="Type your answer here..."
                                        value={answers[q._id] || ''}
                                        onChange={e => saveAnswer(q._id, e.target.value)}
                                    />
                                )}
                            </div>

                            {/* Navigation */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                                <button className="btn btn-secondary" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>
                                    <ChevronLeft size={16} /> Previous
                                </button>
                                {currentQ < questions.length - 1 ? (
                                    <button className="btn btn-primary" onClick={() => setCurrentQ(currentQ + 1)}>
                                        Next <ChevronRight size={16} />
                                    </button>
                                ) : (
                                    <button className="btn btn-success" onClick={submitExam}>
                                        <Send size={16} /> Submit Exam
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Exam Wrapper (reads examId from URL)
// ============================================================
function ExamWrapper() {
    const { id } = useParams();
    if (!id) return <div>Invalid exam ID</div>;
    return <TakeExam examId={id} />;
}

// ============================================================
// Main Student Router
// ============================================================
export default function SecureExamSystem() {
    return (
        <div>
            <Routes>
                <Route path="/" element={<><StudentHeader /><ExamList /></>} />
                <Route path="/exam/:id" element={<ExamWrapper />} />
            </Routes>
        </div>
    );
}
