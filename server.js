// ============================================================
// SECURE ONLINE EXAM SYSTEM — Full Backend Server
// Express + MongoDB + Socket.io + JWT + Anti-Cheat
// ============================================================
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// ============================================================
// CONFIG
// ============================================================
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-exam-system';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-2026';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:3000').split(',');
const DEFAULT_TAB_SWITCH_LIMIT = parseInt(process.env.DEFAULT_TAB_SWITCH_LIMIT) || 3;
const SNAPSHOT_INTERVAL = parseInt(process.env.SNAPSHOT_INTERVAL_SECONDS) || 30;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests' } });
app.use('/api/', limiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many auth attempts' } });

// Static files for uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// Multer for snapshot uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(uploadDir, 'snapshots');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ============================================================
// SOCKET.IO
// ============================================================
const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'], credentials: true }
});

// Track connected users
const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('register', ({ userId, role }) => {
        connectedUsers.set(socket.id, { userId, role, socketId: socket.id });
        if (role === 'instructor' || role === 'admin') {
            socket.join('instructors');
        }
    });

    socket.on('join-exam', ({ attemptId, examId }) => {
        socket.join(`exam-${examId}`);
        socket.join(`attempt-${attemptId}`);
    });

    socket.on('student-activity', (data) => {
        // Broadcast to instructors monitoring this exam
        io.to('instructors').emit('student-activity', data);
        io.to(`exam-${data.examId}`).emit('activity-update', data);
    });

    socket.on('violation', (data) => {
        io.to('instructors').emit('violation-alert', data);
    });

    socket.on('disconnect', () => {
        connectedUsers.delete(socket.id);
    });
});

// ============================================================
// MONGODB CONNECTION (with in-memory fallback)
// ============================================================
async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
        console.log('✅ MongoDB connected:', MONGODB_URI);
    } catch (err) {
        console.log('⚠️  MongoDB not available at', MONGODB_URI);
        console.log('🔄 Starting in-memory MongoDB for development...');
        try {
            const { MongoMemoryServer } = require('mongodb-memory-server');
            const mongod = await MongoMemoryServer.create();
            const memUri = mongod.getUri();
            await mongoose.connect(memUri);
            console.log('✅ In-memory MongoDB connected:', memUri);
            console.log('   ⚠️  Data will be lost on restart. Install MongoDB for persistence.');
        } catch (memErr) {
            console.error('❌ Failed to start in-memory MongoDB:', memErr.message);
            console.error('   Install MongoDB or set MONGODB_URI in .env to a MongoDB Atlas URI');
            process.exit(1);
        }
    }
}
connectDB();

// ============================================================
// MONGOOSE MODELS
// ============================================================

// --- User ---
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['student', 'instructor', 'admin'], default: 'student' },
    createdAt: { type: Date, default: Date.now }
});

// email index already created by unique: true above
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});
userSchema.methods.comparePassword = function (candidate) {
    return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);

// --- Exam ---
const questionSchema = new mongoose.Schema({
    type: { type: String, enum: ['multiple_choice', 'true_false', 'short_answer'], required: true },
    questionText: { type: String, required: true },
    options: [String],
    correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true },
    marks: { type: Number, default: 1 },
    explanation: String,
});

const examSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    description: String,
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    duration: { type: Number, required: true }, // minutes
    totalMarks: { type: Number, required: true },
    passingMarks: { type: Number, required: true },
    startTime: { type: Date },
    endTime: { type: Date },
    questions: [questionSchema],
    antiCheatSettings: {
        webcamRequired: { type: Boolean, default: true },
        tabSwitchLimit: { type: Number, default: DEFAULT_TAB_SWITCH_LIMIT },
        screenshotDetection: { type: Boolean, default: true },
        fullScreenRequired: { type: Boolean, default: true },
        copyPasteBlocked: { type: Boolean, default: true },
        devToolsBlocked: { type: Boolean, default: true },
    },
    isPublished: { type: Boolean, default: false },
    allowMultipleAttempts: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

examSchema.index({ instructor: 1 });
examSchema.index({ isPublished: 1 });

const Exam = mongoose.model('Exam', examSchema);

// --- Exam Attempt ---
const answerSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    answer: mongoose.Schema.Types.Mixed,
    isCorrect: Boolean,
    marksAwarded: { type: Number, default: 0 },
    timeSpent: Number, // seconds on this question
});

const violationSchema = new mongoose.Schema({
    type: { type: String, required: true }, // tab_switch, copy_paste, fullscreen_exit, right_click, devtools, screenshot
    description: String,
    timestamp: { type: Date, default: Date.now },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
});

const attemptSchema = new mongoose.Schema({
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    timeSpent: Number, // total seconds
    answers: [answerSchema],
    score: { type: Number, default: 0 },
    totalMarks: Number,
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    violations: [violationSchema],
    tabSwitches: { type: Number, default: 0 },
    webcamSnapshots: [{ url: String, timestamp: { type: Date, default: Date.now } }],
    status: { type: String, enum: ['in_progress', 'submitted', 'auto_submitted', 'flagged', 'cancelled'], default: 'in_progress' },
    flagged: { type: Boolean, default: false },
    flagReason: String,
});

attemptSchema.index({ exam: 1, student: 1 });
attemptSchema.index({ status: 1 });

const ExamAttempt = mongoose.model('ExamAttempt', attemptSchema);

// --- Activity Log ---
const activityLogSchema = new mongoose.Schema({
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamAttempt', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    activities: [{
        type: { type: String }, // question_view, answer_change, focus_change, mouse_event
        data: mongoose.Schema.Types.Mixed,
        timestamp: { type: Date, default: Date.now }
    }]
});

activityLogSchema.index({ attemptId: 1 });
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function authMiddleware(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token is invalid or expired' });
    }
}

function roleMiddleware(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Insufficient role.' });
        }
        next();
    };
}

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) return res.status(400).json({ error: 'Email already registered' });

        const user = new User({ name, email: email.toLowerCase(), password, role: role || 'student' });
        await user.save();

        const token = jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// EXAM ROUTES
// ============================================================
// Create exam (instructor/admin only)
app.post('/api/exams', authMiddleware, roleMiddleware('instructor', 'admin'), async (req, res) => {
    try {
        const { title, subject, description, duration, totalMarks, passingMarks, startTime, endTime, questions, antiCheatSettings, isPublished } = req.body;

        if (!title || !subject || !duration || !totalMarks || !passingMarks) {
            return res.status(400).json({ error: 'Title, subject, duration, totalMarks, and passingMarks are required' });
        }
        if (!questions || questions.length === 0) {
            return res.status(400).json({ error: 'At least one question is required' });
        }

        const exam = new Exam({
            title, subject, description, duration, totalMarks, passingMarks,
            startTime, endTime, questions, antiCheatSettings,
            instructor: req.user.id,
            isPublished: isPublished || false,
        });
        await exam.save();
        res.status(201).json(exam);
    } catch (err) {
        console.error('Create exam error:', err);
        res.status(500).json({ error: 'Error creating exam' });
    }
});

// Get all exams
app.get('/api/exams', authMiddleware, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'student') {
            query.isPublished = true;
        } else if (req.user.role === 'instructor') {
            query.instructor = req.user.id;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const exams = await Exam.find(query)
            .select('-questions.correctAnswer')
            .populate('instructor', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Exam.countDocuments(query);
        res.json({ exams, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: 'Error fetching exams' });
    }
});

// Get single exam
app.get('/api/exams/:id', authMiddleware, async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id).populate('instructor', 'name email');
        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        // Students shouldn't see correct answers
        if (req.user.role === 'student') {
            const sanitized = exam.toObject();
            sanitized.questions = sanitized.questions.map(q => ({
                ...q, correctAnswer: undefined, explanation: undefined
            }));
            return res.json(sanitized);
        }
        res.json(exam);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching exam' });
    }
});

// Update exam
app.put('/api/exams/:id', authMiddleware, roleMiddleware('instructor', 'admin'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        if (exam.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const updates = req.body;
        Object.keys(updates).forEach(key => { exam[key] = updates[key]; });
        await exam.save();
        res.json(exam);
    } catch (err) {
        res.status(500).json({ error: 'Error updating exam' });
    }
});

// Delete exam
app.delete('/api/exams/:id', authMiddleware, roleMiddleware('instructor', 'admin'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        if (exam.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }
        await Exam.findByIdAndDelete(req.params.id);
        await ExamAttempt.deleteMany({ exam: req.params.id });
        res.json({ message: 'Exam deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting exam' });
    }
});

// ============================================================
// EXAM ATTEMPT ROUTES
// ============================================================

// Start exam attempt
app.post('/api/exams/:id/start', authMiddleware, roleMiddleware('student'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        if (!exam.isPublished) return res.status(400).json({ error: 'Exam is not published' });

        // Check time window
        const now = new Date();
        if (exam.startTime && now < exam.startTime) return res.status(400).json({ error: 'Exam has not started yet' });
        if (exam.endTime && now > exam.endTime) return res.status(400).json({ error: 'Exam has ended' });

        // Check existing attempt
        if (!exam.allowMultipleAttempts) {
            const existing = await ExamAttempt.findOne({ exam: exam._id, student: req.user.id, status: { $ne: 'cancelled' } });
            if (existing) {
                if (existing.status === 'in_progress') {
                    // Return in-progress attempt with sanitized exam data
                    const sanitizedExam = exam.toObject();
                    sanitizedExam.questions = sanitizedExam.questions.map(q => ({
                        _id: q._id, type: q.type, questionText: q.questionText,
                        options: q.options, marks: q.marks,
                    }));
                    return res.json({ attempt: existing, exam: sanitizedExam });
                }
                return res.status(400).json({ error: 'You have already attempted this exam' });
            }
        }

        const attempt = new ExamAttempt({
            exam: exam._id,
            student: req.user.id,
            totalMarks: exam.totalMarks,
            status: 'in_progress',
        });
        await attempt.save();

        // Create activity log
        const log = new ActivityLog({
            attemptId: attempt._id,
            student: req.user.id,
            exam: exam._id,
            activities: [{ type: 'exam_start', data: {}, timestamp: new Date() }],
        });
        await log.save();

        // Notify instructors via WebSocket
        io.to('instructors').emit('exam-started', {
            attemptId: attempt._id,
            examId: exam._id,
            examTitle: exam.title,
            studentId: req.user.id,
            studentName: req.user.name,
            startedAt: attempt.startedAt,
        });

        // Return attempt with exam questions (without answers)
        const sanitizedExam = exam.toObject();
        sanitizedExam.questions = sanitizedExam.questions.map(q => ({
            _id: q._id, type: q.type, questionText: q.questionText,
            options: q.options, marks: q.marks,
        }));

        res.status(201).json({ attempt, exam: sanitizedExam });
    } catch (err) {
        console.error('Start exam error:', err);
        res.status(500).json({ error: 'Error starting exam' });
    }
});

// Save answer
app.post('/api/attempts/:id/answer', authMiddleware, async (req, res) => {
    try {
        const { questionId, answer } = req.body;
        const attempt = await ExamAttempt.findById(req.params.id);
        if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
        if (attempt.student.toString() !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
        if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Exam already submitted' });

        // Update or add answer
        const existingIdx = attempt.answers.findIndex(a => a.questionId.toString() === questionId);
        if (existingIdx >= 0) {
            attempt.answers[existingIdx].answer = answer;
        } else {
            attempt.answers.push({ questionId, answer });
        }
        await attempt.save();

        // Log activity
        await ActivityLog.updateOne(
            { attemptId: attempt._id },
            { $push: { activities: { type: 'answer_saved', data: { questionId }, timestamp: new Date() } } }
        );

        res.json({ message: 'Answer saved' });
    } catch (err) {
        res.status(500).json({ error: 'Error saving answer' });
    }
});

// Submit exam + AUTO-GRADE
app.post('/api/attempts/:id/submit', authMiddleware, async (req, res) => {
    try {
        const attempt = await ExamAttempt.findById(req.params.id);
        if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
        if (attempt.student.toString() !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
        if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Already submitted' });

        const exam = await Exam.findById(attempt.exam);
        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        // === AUTO-GRADING ===
        let totalScore = 0;
        for (const ans of attempt.answers) {
            const question = exam.questions.id(ans.questionId);
            if (!question) continue;

            if (question.type === 'multiple_choice' || question.type === 'true_false') {
                const isCorrect = String(ans.answer).toLowerCase().trim() === String(question.correctAnswer).toLowerCase().trim();
                ans.isCorrect = isCorrect;
                ans.marksAwarded = isCorrect ? question.marks : 0;
                totalScore += ans.marksAwarded;
            } else if (question.type === 'short_answer') {
                // For short answer, basic keyword matching (real apps would use AI)
                const correct = String(question.correctAnswer).toLowerCase().trim();
                const student = String(ans.answer || '').toLowerCase().trim();
                const isCorrect = student === correct || correct.split(' ').every(w => student.includes(w));
                ans.isCorrect = isCorrect;
                ans.marksAwarded = isCorrect ? question.marks : 0;
                totalScore += ans.marksAwarded;
            }
        }

        attempt.score = totalScore;
        attempt.percentage = exam.totalMarks > 0 ? Math.round((totalScore / exam.totalMarks) * 100) : 0;
        attempt.passed = totalScore >= exam.passingMarks;
        attempt.submittedAt = new Date();
        attempt.timeSpent = Math.round((attempt.submittedAt - attempt.startedAt) / 1000);
        attempt.status = req.body.autoSubmit ? 'auto_submitted' : 'submitted';

        // Flag if violations exceed limit
        const tabLimit = exam.antiCheatSettings?.tabSwitchLimit || DEFAULT_TAB_SWITCH_LIMIT;
        if (attempt.tabSwitches >= tabLimit || attempt.violations.length >= tabLimit) {
            attempt.flagged = true;
            attempt.flagReason = `Exceeded violation limit: ${attempt.violations.length} violations, ${attempt.tabSwitches} tab switches`;
        }

        await attempt.save();

        // Log submission
        await ActivityLog.updateOne(
            { attemptId: attempt._id },
            { $push: { activities: { type: 'exam_submitted', data: { score: totalScore, percentage: attempt.percentage }, timestamp: new Date() } } }
        );

        // Notify instructors
        io.to('instructors').emit('exam-submitted', {
            attemptId: attempt._id,
            examId: exam._id,
            examTitle: exam.title,
            studentName: req.user.name,
            score: totalScore,
            percentage: attempt.percentage,
            passed: attempt.passed,
            flagged: attempt.flagged,
            violations: attempt.violations.length,
        });

        res.json({
            message: 'Exam submitted and graded',
            score: totalScore,
            totalMarks: exam.totalMarks,
            percentage: attempt.percentage,
            passed: attempt.passed,
            flagged: attempt.flagged,
        });
    } catch (err) {
        console.error('Submit error:', err);
        res.status(500).json({ error: 'Error submitting exam' });
    }
});

// Log violation
app.post('/api/attempts/:id/violation', authMiddleware, async (req, res) => {
    try {
        const { type, description, severity } = req.body;
        const attempt = await ExamAttempt.findById(req.params.id);
        if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
        if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Exam not in progress' });

        const violation = { type, description, severity: severity || 'medium', timestamp: new Date() };
        attempt.violations.push(violation);

        if (type === 'tab_switch') attempt.tabSwitches += 1;

        // Check if should auto-flag
        const exam = await Exam.findById(attempt.exam);
        const tabLimit = exam?.antiCheatSettings?.tabSwitchLimit || DEFAULT_TAB_SWITCH_LIMIT;
        if (attempt.violations.length >= tabLimit * 2) {
            attempt.flagged = true;
            attempt.flagReason = `Auto-flagged: ${attempt.violations.length} violations`;
        }

        await attempt.save();

        // Real-time alert to instructors
        io.to('instructors').emit('violation-alert', {
            attemptId: attempt._id,
            examId: attempt.exam,
            studentId: req.user.id,
            studentName: req.user.name,
            violation,
            totalViolations: attempt.violations.length,
            tabSwitches: attempt.tabSwitches,
        });

        res.json({
            message: 'Violation logged',
            totalViolations: attempt.violations.length,
            tabSwitches: attempt.tabSwitches,
            flagged: attempt.flagged,
        });
    } catch (err) {
        res.status(500).json({ error: 'Error logging violation' });
    }
});

// Save webcam snapshot
app.post('/api/attempts/:id/snapshot', authMiddleware, async (req, res) => {
    try {
        const attempt = await ExamAttempt.findById(req.params.id);
        if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

        let snapshotUrl = '';
        if (req.file) {
            snapshotUrl = `/uploads/snapshots/${req.file.filename}`;
        } else if (req.body.imageData) {
            // Base64 image data
            const base64 = req.body.imageData.replace(/^data:image\/\w+;base64,/, '');
            const filename = `${Date.now()}-${attempt._id}.png`;
            const filepath = path.join(uploadDir, 'snapshots', filename);
            fs.writeFileSync(filepath, Buffer.from(base64, 'base64'));
            snapshotUrl = `/uploads/snapshots/${filename}`;
        }

        if (snapshotUrl) {
            attempt.webcamSnapshots.push({ url: snapshotUrl, timestamp: new Date() });
            await attempt.save();
        }

        res.json({ message: 'Snapshot saved', url: snapshotUrl });
    } catch (err) {
        res.status(500).json({ error: 'Error saving snapshot' });
    }
});

// Get attempt details
app.get('/api/attempts/:id', authMiddleware, async (req, res) => {
    try {
        const attempt = await ExamAttempt.findById(req.params.id)
            .populate('exam', 'title subject duration totalMarks passingMarks questions antiCheatSettings')
            .populate('student', 'name email');

        if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

        // Students can only see their own attempts
        if (req.user.role === 'student' && attempt.student._id.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json(attempt);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching attempt' });
    }
});

// Get all attempts for an exam (instructor)
app.get('/api/exams/:id/attempts', authMiddleware, roleMiddleware('instructor', 'admin'), async (req, res) => {
    try {
        const attempts = await ExamAttempt.find({ exam: req.params.id })
            .populate('student', 'name email')
            .sort({ startedAt: -1 });
        res.json(attempts);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching attempts' });
    }
});

// Get student's own attempts
app.get('/api/my-attempts', authMiddleware, async (req, res) => {
    try {
        const attempts = await ExamAttempt.find({ student: req.user.id })
            .populate('exam', 'title subject duration totalMarks passingMarks')
            .sort({ startedAt: -1 });
        res.json(attempts);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching attempts' });
    }
});

// ============================================================
// DASHBOARD STATS
// ============================================================
app.get('/api/dashboard/instructor', authMiddleware, roleMiddleware('instructor', 'admin'), async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? {} : { instructor: req.user.id };
        const totalExams = await Exam.countDocuments(query);
        const publishedExams = await Exam.countDocuments({ ...query, isPublished: true });

        const examIds = (await Exam.find(query).select('_id')).map(e => e._id);
        const totalAttempts = await ExamAttempt.countDocuments({ exam: { $in: examIds } });
        const flaggedAttempts = await ExamAttempt.countDocuments({ exam: { $in: examIds }, flagged: true });
        const completedAttempts = await ExamAttempt.countDocuments({ exam: { $in: examIds }, status: { $in: ['submitted', 'auto_submitted'] } });
        const activeAttempts = await ExamAttempt.countDocuments({ exam: { $in: examIds }, status: 'in_progress' });

        // Average score
        const avgResult = await ExamAttempt.aggregate([
            { $match: { exam: { $in: examIds }, status: { $in: ['submitted', 'auto_submitted'] } } },
            { $group: { _id: null, avgScore: { $avg: '$percentage' } } }
        ]);
        const avgScore = avgResult.length > 0 ? Math.round(avgResult[0].avgScore) : 0;

        // Recent violations
        const recentViolations = await ExamAttempt.find({ exam: { $in: examIds }, 'violations.0': { $exists: true } })
            .populate('student', 'name email')
            .populate('exam', 'title')
            .sort({ 'violations.timestamp': -1 })
            .limit(10)
            .select('student exam violations tabSwitches flagged status');

        // Active attempts for live monitoring
        const activeAttemptsList = await ExamAttempt.find({ exam: { $in: examIds }, status: 'in_progress' })
            .populate('student', 'name email')
            .populate('exam', 'title duration')
            .select('student exam startedAt violations tabSwitches webcamSnapshots');

        res.json({
            stats: { totalExams, publishedExams, totalAttempts, completedAttempts, activeAttempts, flaggedAttempts, avgScore },
            recentViolations,
            activeAttempts: activeAttemptsList,
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Error fetching dashboard stats' });
    }
});

app.get('/api/dashboard/student', authMiddleware, async (req, res) => {
    try {
        const attempts = await ExamAttempt.find({ student: req.user.id })
            .populate('exam', 'title subject totalMarks passingMarks');

        const completed = attempts.filter(a => ['submitted', 'auto_submitted'].includes(a.status));
        const avgScore = completed.length > 0 ? Math.round(completed.reduce((s, a) => s + a.percentage, 0) / completed.length) : 0;

        const availableExams = await Exam.find({ isPublished: true })
            .select('title subject duration totalMarks startTime endTime')
            .sort({ createdAt: -1 });

        res.json({
            stats: {
                totalAttempts: attempts.length,
                completed: completed.length,
                avgScore,
                passed: completed.filter(a => a.passed).length,
                failed: completed.filter(a => !a.passed).length,
            },
            recentAttempts: attempts.slice(0, 5),
            availableExams,
        });
    } catch (err) {
        res.status(500).json({ error: 'Error fetching student dashboard' });
    }
});

// ============================================================
// ACTIVITY LOG ROUTES
// ============================================================
app.post('/api/activity-log/:attemptId', authMiddleware, async (req, res) => {
    try {
        const { activities } = req.body;
        await ActivityLog.updateOne(
            { attemptId: req.params.attemptId },
            { $push: { activities: { $each: activities } } }
        );
        res.json({ message: 'Activities logged' });
    } catch (err) {
        res.status(500).json({ error: 'Error logging activities' });
    }
});

app.get('/api/activity-log/:attemptId', authMiddleware, roleMiddleware('instructor', 'admin'), async (req, res) => {
    try {
        const log = await ActivityLog.findOne({ attemptId: req.params.attemptId })
            .populate('student', 'name email');
        res.json(log || { activities: [] });
    } catch (err) {
        res.status(500).json({ error: 'Error fetching activity log' });
    }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime(),
    });
});

// ============================================================
// SERVE FRONTEND IN PRODUCTION
// ============================================================
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client', 'dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
    });
}

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// START SERVER
// ============================================================
server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║  🔒 Secure Exam System Server                       ║
║  Port: ${PORT}                                         ║
║  MongoDB: ${MONGODB_URI.substring(0, 40)}...       ║
║  WebSocket: ✅ Enabled                               ║
║  Anti-Cheat: ✅ Active                               ║
╚══════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
