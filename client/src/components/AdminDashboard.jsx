// ============================================================
// AdminDashboard.jsx — Instructor & Admin Interface
// Exam CRUD, Live Monitoring, Results, WebSocket Integration
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App';
import {
    Shield, Plus, Edit3, Trash2, Eye, Users, BarChart3, AlertTriangle,
    Clock, CheckCircle, XCircle, Camera, LogOut, Home, BookOpen,
    Monitor, Activity, ChevronRight, Flag, Save, X, TrendingUp,
    FileText, Send, Play, Pause, RefreshCw, Search
} from 'lucide-react';

// ============================================================
// Dashboard Header
// ============================================================
function DashHeader() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    return (
        <header className="header">
            <div className="header-brand">
                <Shield size={22} />
                <span>SecureExam</span>
                <span className="badge badge-warning" style={{ marginLeft: 4 }}>
                    {user?.role === 'admin' ? 'Admin' : 'Instructor'}
                </span>
            </div>
            <div className="header-actions">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user?.name}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>
                    <LogOut size={16} /> Sign Out
                </button>
            </div>
        </header>
    );
}

// ============================================================
// Instructor Overview
// ============================================================
function InstructorOverview() {
    const { apiFetch, socket } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [violations, setViolations] = useState([]);
    const [activeAttempts, setActiveAttempts] = useState([]);
    const [liveAlerts, setLiveAlerts] = useState([]);
    const [tab, setTab] = useState('overview');

    useEffect(() => {
        loadDashboard();
    }, []);

    // WebSocket listeners for live monitoring
    useEffect(() => {
        if (!socket) return;

        socket.on('violation-alert', (data) => {
            setLiveAlerts(prev => [{ ...data, timestamp: new Date() }, ...prev].slice(0, 50));
            // Update active attempts with new violation
            setActiveAttempts(prev => prev.map(a =>
                a._id === data.attemptId ? { ...a, violations: [...(a.violations || []), data.violation], tabSwitches: data.tabSwitches } : a
            ));
        });

        socket.on('exam-started', (data) => {
            setLiveAlerts(prev => [{ type: 'info', description: `${data.studentName} started "${data.examTitle}"`, timestamp: new Date() }, ...prev].slice(0, 50));
            loadDashboard();
        });

        socket.on('exam-submitted', (data) => {
            setLiveAlerts(prev => [{
                type: data.flagged ? 'warning' : 'success',
                description: `${data.studentName} submitted "${data.examTitle}" — ${data.percentage}% ${data.flagged ? '⚠️ FLAGGED' : ''}`,
                timestamp: new Date()
            }, ...prev].slice(0, 50));
            loadDashboard();
        });

        return () => {
            socket.off('violation-alert');
            socket.off('exam-started');
            socket.off('exam-submitted');
        };
    }, [socket]);

    const loadDashboard = async () => {
        try {
            const data = await apiFetch('/dashboard/instructor');
            setStats(data.stats);
            setViolations(data.recentViolations || []);
            setActiveAttempts(data.activeAttempts || []);
        } catch (err) {
            console.error('Dashboard load error:', err);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'live', label: `Live Monitor (${activeAttempts.length})`, icon: Monitor },
        { id: 'alerts', label: `Alerts (${liveAlerts.length})`, icon: AlertTriangle },
    ];

    return (
        <div className="page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 className="page-title">Instructor Dashboard</h1>
                    <p className="page-subtitle">Manage exams and monitor students in real-time</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={loadDashboard}><RefreshCw size={14} /> Refresh</button>
                    <button className="btn btn-primary" onClick={() => navigate('/dashboard/create-exam')}>
                        <Plus size={16} /> Create Exam
                    </button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-4" style={{ marginBottom: 24 }}>
                    {[
                        { label: 'Total Exams', value: stats.totalExams, icon: BookOpen, color: 'var(--accent)' },
                        { label: 'Active Now', value: stats.activeAttempts, icon: Play, color: 'var(--success)' },
                        { label: 'Flagged', value: stats.flaggedAttempts, icon: Flag, color: 'var(--danger)' },
                        { label: 'Avg Score', value: `${stats.avgScore}%`, icon: TrendingUp, color: 'var(--info)' },
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

            {/* Tabs */}
            <div className="tabs">
                {tabs.map(t => (
                    <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                        <t.icon size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {tab === 'overview' && (
                <div>
                    <div className="grid grid-2" style={{ marginBottom: 20 }}>
                        <div className="glass" style={{ padding: 20 }}>
                            <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Quick Actions</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <button className="btn btn-primary btn-sm" style={{ justifyContent: 'start' }} onClick={() => navigate('/dashboard/create-exam')}>
                                    <Plus size={14} /> Create New Exam
                                </button>
                                <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'start' }} onClick={() => navigate('/dashboard/exams')}>
                                    <BookOpen size={14} /> Manage Exams
                                </button>
                                <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'start' }} onClick={() => setTab('live')}>
                                    <Monitor size={14} /> Live Monitoring
                                </button>
                            </div>
                        </div>
                        <div className="glass" style={{ padding: 20 }}>
                            <h3 style={{ marginBottom: 16, fontWeight: 700 }}>System Status</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Total Attempts</span>
                                    <strong>{stats?.totalAttempts || 0}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Completed</span>
                                    <strong>{stats?.completedAttempts || 0}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Published Exams</span>
                                    <strong>{stats?.publishedExams || 0}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Flagged Attempts</span>
                                    <strong style={{ color: 'var(--danger)' }}>{stats?.flaggedAttempts || 0}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Violations */}
                    {violations.length > 0 && (
                        <div className="glass" style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontWeight: 700 }}>🚨 Recent Violations</h3>
                                <span className="badge badge-danger">{violations.length} flagged</span>
                            </div>
                            <table className="data-table">
                                <thead>
                                    <tr><th>Student</th><th>Exam</th><th>Violations</th><th>Tab Switches</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {violations.slice(0, 10).map(v => (
                                        <tr key={v._id}>
                                            <td><strong>{v.student?.name || 'Unknown'}</strong></td>
                                            <td>{v.exam?.title || 'Unknown'}</td>
                                            <td><span className="badge badge-danger">{v.violations?.length || 0}</span></td>
                                            <td>{v.tabSwitches}</td>
                                            <td>
                                                {v.flagged ? <span className="badge badge-danger">⚠️ Flagged</span> :
                                                    <span className="badge badge-success">Clean</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Live Monitor Tab */}
            {tab === 'live' && (
                <div>
                    {activeAttempts.length === 0 ? (
                        <div className="empty-state glass">
                            <Monitor size={40} />
                            <p>No active exams right now</p>
                        </div>
                    ) : (
                        <div className="grid grid-2">
                            {activeAttempts.map(a => {
                                const elapsed = Math.round((Date.now() - new Date(a.startedAt).getTime()) / 60000);
                                const remaining = (a.exam?.duration || 0) - elapsed;
                                return (
                                    <div key={a._id} className={`glass monitor-card ${a.violations?.length > 0 ? 'violation' : 'active'}`}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                                            <div>
                                                <strong>{a.student?.name || 'Student'}</strong>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.exam?.title}</p>
                                            </div>
                                            <span className={`badge ${remaining < 5 ? 'badge-danger' : 'badge-info'}`}>
                                                <Clock size={10} /> {remaining > 0 ? `${remaining}m left` : 'Over time'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                            <span>Violations: <strong style={{ color: a.violations?.length > 0 ? 'var(--danger)' : 'inherit' }}>{a.violations?.length || 0}</strong></span>
                                            <span>Tab Switches: <strong style={{ color: a.tabSwitches > 0 ? 'var(--warning)' : 'inherit' }}>{a.tabSwitches || 0}</strong></span>
                                            <span>Snapshots: {a.webcamSnapshots?.length || 0}</span>
                                        </div>
                                        {/* Latest violations */}
                                        {a.violations?.slice(-3).map((v, i) => (
                                            <div key={i} style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--danger)', padding: '4px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: 4 }}>
                                                ⚠️ {v.type}: {v.description}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Alerts Tab */}
            {tab === 'alerts' && (
                <div className="glass" style={{ overflow: 'hidden' }}>
                    {liveAlerts.length === 0 ? (
                        <div className="empty-state">
                            <Activity size={40} />
                            <p>No live alerts yet — they'll appear here in real-time</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            {liveAlerts.map((alert, i) => (
                                <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem' }}>
                                    {alert.violation ? (
                                        <AlertTriangle size={16} color="var(--danger)" />
                                    ) : alert.type === 'success' ? (
                                        <CheckCircle size={16} color="var(--success)" />
                                    ) : (
                                        <Activity size={16} color="var(--info)" />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        {alert.violation ? (
                                            <span><strong>{alert.studentName}</strong> — {alert.violation.type}: {alert.violation.description}</span>
                                        ) : (
                                            <span>{alert.description}</span>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================
// Exam List (Manage)
// ============================================================
function ExamManage() {
    const { apiFetch } = useAuth();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadExams(); }, []);

    const loadExams = async () => {
        try {
            const data = await apiFetch('/exams');
            setExams(data.exams || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const deleteExam = async (id) => {
        if (!window.confirm('Delete this exam and all its attempts?')) return;
        try {
            await apiFetch(`/exams/${id}`, { method: 'DELETE' });
            setExams(prev => prev.filter(e => e._id !== id));
        } catch (err) {
            alert(err.message);
        }
    };

    const togglePublish = async (exam) => {
        try {
            await apiFetch(`/exams/${exam._id}`, {
                method: 'PUT',
                body: JSON.stringify({ isPublished: !exam.isPublished })
            });
            loadExams();
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;

    return (
        <div className="page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 className="page-title">Manage Exams</h1>
                    <p className="page-subtitle">{exams.length} exam{exams.length !== 1 ? 's' : ''} total</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard/create-exam')}>
                    <Plus size={16} /> Create Exam
                </button>
            </div>

            {exams.length === 0 ? (
                <div className="empty-state glass">
                    <BookOpen size={40} />
                    <p>No exams created yet. Create your first exam!</p>
                </div>
            ) : (
                <div className="glass" style={{ overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Subject</th>
                                <th>Questions</th>
                                <th>Duration</th>
                                <th>Marks</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exams.map(exam => (
                                <tr key={exam._id}>
                                    <td><strong>{exam.title}</strong></td>
                                    <td><span className="badge badge-primary">{exam.subject}</span></td>
                                    <td>{exam.questions?.length || 0}</td>
                                    <td>{exam.duration} min</td>
                                    <td>{exam.totalMarks}</td>
                                    <td>
                                        <span className={`badge ${exam.isPublished ? 'badge-success' : 'badge-warning'}`}>
                                            {exam.isPublished ? 'Published' : 'Draft'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/dashboard/attempts/${exam._id}`)}>
                                                <Eye size={13} />
                                            </button>
                                            <button className={`btn btn-sm ${exam.isPublished ? 'btn-warning' : 'btn-success'}`} onClick={() => togglePublish(exam)}>
                                                {exam.isPublished ? <Pause size={13} /> : <Play size={13} />}
                                            </button>
                                            <button className="btn btn-sm btn-danger" onClick={() => deleteExam(exam._id)}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Create Exam
// ============================================================
function CreateExam() {
    const { apiFetch } = useAuth();
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        title: '', subject: '', description: '', duration: 60,
        totalMarks: 100, passingMarks: 40, isPublished: false,
        antiCheatSettings: {
            webcamRequired: true, tabSwitchLimit: 3,
            screenshotDetection: true, fullScreenRequired: true,
            copyPasteBlocked: true, devToolsBlocked: true,
        },
        questions: [{ type: 'multiple_choice', questionText: '', options: ['', '', '', ''], correctAnswer: '', marks: 1 }]
    });

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
    const updateAntiCheat = (field, value) => setForm(prev => ({
        ...prev, antiCheatSettings: { ...prev.antiCheatSettings, [field]: value }
    }));

    const addQuestion = () => {
        setForm(prev => ({
            ...prev,
            questions: [...prev.questions, { type: 'multiple_choice', questionText: '', options: ['', '', '', ''], correctAnswer: '', marks: 1 }]
        }));
    };

    const removeQuestion = (idx) => {
        setForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }));
    };

    const updateQuestion = (idx, field, value) => {
        setForm(prev => {
            const questions = [...prev.questions];
            questions[idx] = { ...questions[idx], [field]: value };
            return { ...prev, questions };
        });
    };

    const updateOption = (qIdx, oIdx, value) => {
        setForm(prev => {
            const questions = [...prev.questions];
            const options = [...questions[qIdx].options];
            options[oIdx] = value;
            questions[qIdx] = { ...questions[qIdx], options };
            return { ...prev, questions };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Calculate total marks from questions
            const totalMarks = form.questions.reduce((s, q) => s + (Number(q.marks) || 1), 0);
            await apiFetch('/exams', {
                method: 'POST',
                body: JSON.stringify({ ...form, totalMarks })
            });
            navigate('/dashboard/exams');
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>← Back</button>
                <h1 className="page-title" style={{ marginBottom: 0 }}>Create Exam</h1>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Basic Info */}
                <div className="glass" style={{ padding: 24, marginBottom: 20 }}>
                    <h3 style={{ marginBottom: 16, fontWeight: 700 }}>📋 Basic Information</h3>
                    <div className="grid grid-2">
                        <div className="form-group">
                            <label>Exam Title *</label>
                            <input className="input" value={form.title} onChange={e => updateField('title', e.target.value)} required placeholder="e.g. Physics Mid-Term 2026" />
                        </div>
                        <div className="form-group">
                            <label>Subject *</label>
                            <input className="input" value={form.subject} onChange={e => updateField('subject', e.target.value)} required placeholder="e.g. Physics" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea className="textarea" value={form.description} onChange={e => updateField('description', e.target.value)} rows={2} placeholder="Brief description..." />
                    </div>
                    <div className="grid grid-3">
                        <div className="form-group">
                            <label>Duration (min)</label>
                            <input className="input" type="number" min="1" value={form.duration} onChange={e => updateField('duration', Number(e.target.value))} />
                        </div>
                        <div className="form-group">
                            <label>Passing Marks</label>
                            <input className="input" type="number" min="0" value={form.passingMarks} onChange={e => updateField('passingMarks', Number(e.target.value))} />
                        </div>
                        <div className="form-group">
                            <label>Publish Now?</label>
                            <button type="button" className={`btn btn-sm ${form.isPublished ? 'btn-success' : 'btn-secondary'}`} style={{ width: '100%' }}
                                onClick={() => updateField('isPublished', !form.isPublished)}>
                                {form.isPublished ? '✅ Published' : '📝 Draft'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Anti-Cheat Settings */}
                <div className="glass" style={{ padding: 24, marginBottom: 20 }}>
                    <h3 style={{ marginBottom: 16, fontWeight: 700 }}>🔒 Anti-Cheat Settings</h3>
                    <div className="grid grid-3" style={{ gap: 12 }}>
                        {[
                            { key: 'webcamRequired', label: '📷 Webcam Required' },
                            { key: 'fullScreenRequired', label: '🖥️ Fullscreen Required' },
                            { key: 'copyPasteBlocked', label: '📋 Block Copy/Paste' },
                            { key: 'screenshotDetection', label: '📸 Screenshot Detection' },
                            { key: 'devToolsBlocked', label: '🔧 Block DevTools' },
                        ].map(s => (
                            <button key={s.key} type="button"
                                className={`btn btn-sm ${form.antiCheatSettings[s.key] ? 'btn-success' : 'btn-secondary'}`}
                                style={{ justifyContent: 'start' }}
                                onClick={() => updateAntiCheat(s.key, !form.antiCheatSettings[s.key])}
                            >
                                {s.label}: {form.antiCheatSettings[s.key] ? 'ON' : 'OFF'}
                            </button>
                        ))}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label>Tab Switch Limit</label>
                            <input className="input" type="number" min="1" max="20" value={form.antiCheatSettings.tabSwitchLimit}
                                onChange={e => updateAntiCheat('tabSwitchLimit', Number(e.target.value))} />
                        </div>
                    </div>
                </div>

                {/* Questions */}
                <div className="glass" style={{ padding: 24, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 700 }}>📝 Questions ({form.questions.length})</h3>
                        <button type="button" className="btn btn-primary btn-sm" onClick={addQuestion}><Plus size={14} /> Add Question</button>
                    </div>

                    {form.questions.map((q, qi) => (
                        <div key={qi} style={{ padding: 20, marginBottom: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <span className="badge badge-primary">Q{qi + 1}</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <select className="select" style={{ width: 160 }} value={q.type} onChange={e => updateQuestion(qi, 'type', e.target.value)}>
                                        <option value="multiple_choice">Multiple Choice</option>
                                        <option value="true_false">True/False</option>
                                        <option value="short_answer">Short Answer</option>
                                    </select>
                                    <input className="input" type="number" min="1" style={{ width: 60 }} value={q.marks} onChange={e => updateQuestion(qi, 'marks', Number(e.target.value))} title="Marks" />
                                    {form.questions.length > 1 && (
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeQuestion(qi)}><X size={12} /></button>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Question Text *</label>
                                <textarea className="textarea" rows={2} value={q.questionText} onChange={e => updateQuestion(qi, 'questionText', e.target.value)} required placeholder="Enter your question..." />
                            </div>

                            {q.type === 'multiple_choice' && (
                                <>
                                    <div className="grid grid-2" style={{ gap: 8, marginBottom: 12 }}>
                                        {(q.options || ['', '', '', '']).map((opt, oi) => (
                                            <div key={oi} className="form-group" style={{ margin: 0 }}>
                                                <label>Option {String.fromCharCode(65 + oi)}</label>
                                                <input className="input" value={opt} onChange={e => updateOption(qi, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="form-group">
                                        <label>Correct Answer *</label>
                                        <select className="select" value={q.correctAnswer} onChange={e => updateQuestion(qi, 'correctAnswer', e.target.value)} required>
                                            <option value="">Select correct option...</option>
                                            {(q.options || []).filter(o => o).map((opt, i) => (
                                                <option key={i} value={opt}>{String.fromCharCode(65 + i)}: {opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            {q.type === 'true_false' && (
                                <div className="form-group">
                                    <label>Correct Answer *</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {['True', 'False'].map(v => (
                                            <button key={v} type="button"
                                                className={`btn btn-sm ${q.correctAnswer === v ? 'btn-success' : 'btn-secondary'}`}
                                                onClick={() => updateQuestion(qi, 'correctAnswer', v)}>
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {q.type === 'short_answer' && (
                                <div className="form-group">
                                    <label>Expected Answer *</label>
                                    <input className="input" value={q.correctAnswer} onChange={e => updateQuestion(qi, 'correctAnswer', e.target.value)} required placeholder="Keywords or exact answer" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                        {saving ? 'Saving...' : <><Save size={16} /> Save Exam</>}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ============================================================
// View Attempts for Exam
// ============================================================
function ViewAttempts() {
    const { apiFetch } = useAuth();
    const navigate = useNavigate();
    const { examId } = useParams();
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadAttempts(); }, []);

    const loadAttempts = async () => {
        try {
            const data = await apiFetch(`/exams/${examId}/attempts`);
            setAttempts(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading attempts...</p></div>;

    return (
        <div className="page">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard/exams')}>← Back</button>
                <h1 className="page-title" style={{ marginBottom: 0 }}>Exam Attempts</h1>
                <span className="badge badge-primary">{attempts.length} total</span>
            </div>

            {attempts.length === 0 ? (
                <div className="empty-state glass">
                    <Users size={40} />
                    <p>No attempts yet for this exam</p>
                </div>
            ) : (
                <div className="glass" style={{ overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Status</th>
                                <th>Violations</th>
                                <th>Tab Switches</th>
                                <th>Snapshots</th>
                                <th>Time Spent</th>
                                <th>Flagged</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attempts.map(a => (
                                <tr key={a._id} style={{ background: a.flagged ? 'rgba(239,68,68,0.04)' : undefined }}>
                                    <td>
                                        <strong>{a.student?.name || 'Unknown'}</strong>
                                        <br /><span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.student?.email}</span>
                                    </td>
                                    <td>{a.score}/{a.totalMarks}</td>
                                    <td><strong>{a.percentage}%</strong></td>
                                    <td>
                                        <span className={`badge ${a.passed ? 'badge-success' : a.status === 'in_progress' ? 'badge-warning' : 'badge-danger'}`}>
                                            {a.status === 'in_progress' ? 'In Progress' : a.passed ? 'Passed' : 'Failed'}
                                        </span>
                                    </td>
                                    <td>
                                        {a.violations?.length > 0 ? (
                                            <span className="badge badge-danger">{a.violations.length} <AlertTriangle size={10} /></span>
                                        ) : <span style={{ color: 'var(--text-muted)' }}>0</span>}
                                    </td>
                                    <td style={{ color: a.tabSwitches > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                                        {a.tabSwitches}
                                    </td>
                                    <td>{a.webcamSnapshots?.length || 0}</td>
                                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {a.timeSpent ? `${Math.round(a.timeSpent / 60)}m` : '—'}
                                    </td>
                                    <td>
                                        {a.flagged ? (
                                            <span className="badge badge-danger">⚠️ {a.flagReason?.substring(0, 30)}</span>
                                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Main Admin Router
// ============================================================
export default function AdminDashboard() {
    return (
        <div>
            <DashHeader />
            <Routes>
                <Route path="/" element={<InstructorOverview />} />
                <Route path="/exams" element={<ExamManage />} />
                <Route path="/create-exam" element={<CreateExam />} />
                <Route path="/attempts/:examId" element={<ViewAttempts />} />
            </Routes>
        </div>
    );
}
