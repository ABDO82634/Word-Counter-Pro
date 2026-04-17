require('dotenv').config();
const express = require("express");
const fs = require("fs").promises;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const USERS_FILE = path.join(__dirname, "users.json");
const SECRET_KEY = process.env.JWT_SECRET || "ULTRA_CORE_2026_MASTER_KEY";

// ========== 🔥 الحماية القاتلة ==========
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static("public"));

// ========== 🚦 حماية السيرفر من الزحام ==========
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "🐌 شوي شوي! استنى شوية قبل ما ترجع" }
});
app.use("/api/", limiter);

// ========== 💾 قاعدة البيانات ==========
async function getUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, "utf-8");
        return JSON.parse(data || "[]");
    } catch (e) {
        return [];
    }
}

async function saveUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

// ========== 🔑 ميدلوير التحقق ==========
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "❌ أنت مش مسجل دخول" });

    const token = authHeader.split(" ")[1];
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "⏰ الجلسة خلصت! سجل دخول تاني" });
        req.user = user;
        next();
    });
};

// ========== 📝 دوال مساعدة ==========
function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function countChars(text) {
    if (!text) return 0;
    return text.length;
}

function countSentences(text) {
    if (!text) return 0;
    return (text.match(/[.!?]+/g) || []).length;
}

function estimateReadingTime(words) {
    const wpm = 200;
    const minutes = Math.ceil(words / wpm);
    return minutes < 1 ? '< 1 دقيقة' : minutes === 1 ? 'دقيقة واحدة' : `${minutes} دقائق`;
}

// ========== 👤 مسارات التسجيل والدخول ==========
app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;

    // التحقق من المدخلات
    if (!username || username.length < 3) {
        return res.status(400).json({ error: "👤 اسم المستخدم لازم يكون 3 حروف على الأقل" });
    }
    if (!password || password.length < 4) {
        return res.status(400).json({ error: "🔒 كلمة المرور لازم تكون 4 حروف على الأقل" });
    }

    const users = await getUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: "⚠️ اسم المستخدم موجود بالفعل" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        stats: {
            texts: 0,
            words: 0,
            chars: 0,
            sentences: 0,
            ai_tasks: 0,
            last_active: new Date().toISOString(),
            readingTime: 0
        },
        history: []
    };
    users.push(newUser);
    await saveUsers(users);

    res.json({
        success: true,
        message: "🎉 تم التسجيل بنجاح! دلوقتي تقدر تسجل دخول"
    });
});

app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;

    const users = await getUsers();
    const user = users.find(u => u.username === username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "❌ اسم المستخدم أو كلمة المرور غلط" });
    }

    const token = jwt.sign(
        { id: user.id, name: user.username },
        SECRET_KEY,
        { expiresIn: '7d' }
    );

    // تحديث آخر نشاط
    user.stats.last_active = new Date().toISOString();
    await saveUsers(users);

    res.json({
        token,
        user: {
            name: user.username,
            stats: user.stats,
            joined: user.createdAt
        }
    });
});

// ========== 📊 مسار جلب الإحصائيات ==========
app.get("/api/user/stats", authenticate, async (req, res) => {
    const users = await getUsers();
    const user = users.find(u => u.id === req.user.id);

    if (!user) return res.status(404).json({ error: "المستخدم مش موجود" });

    res.json({
        stats: user.stats,
        history: user.history.slice(-10).reverse() // آخر 10 عمليات
    });
});

// ========== 🚀 المسار الأساسي لمعالجة النصوص ==========
app.post("/api/core/process", authenticate, async (req, res) => {
    const { text, mode = 'normal' } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "📝 من فضلك أدخل نص أولاً" });
    }

    if (text.length > 100000) {
        return res.status(400).json({ error: "📏 النص كبير جداً! الحد الأقصى 100,000 حرف" });
    }

    const users = await getUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex === -1) return res.status(404).json({ error: "مستخدم مش موجود" });

    // حساب كل حاجة
    const words = countWords(text);
    const chars = countChars(text);
    const sentences = countSentences(text);
    const readingTime = estimateReadingTime(words);
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    const letters = (text.match(/[a-zA-Z]/g) || []).length;
    const numbers = (text.match(/[0-9]/g) || []).length;
    const spaces = (text.match(/\s/g) || []).length;

    // تحديث الإحصائيات
    users[userIndex].stats.texts++;
    users[userIndex].stats.words += words;
    users[userIndex].stats.chars += chars;
    users[userIndex].stats.sentences += sentences;
    if (mode === 'ai') users[userIndex].stats.ai_tasks++;
    users[userIndex].stats.last_active = new Date().toISOString();

    // حفظ في السجل
    users[userIndex].history.unshift({
        id: Date.now(),
        words,
        chars,
        sentences,
        paragraphs,
        mode,
        readingTime,
        timestamp: new Date().toISOString(),
        preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });

    // خلي آخر 50 عملية بس
    if (users[userIndex].history.length > 50) {
        users[userIndex].history = users[userIndex].history.slice(0, 50);
    }

    await saveUsers(users);

    // حساب المستوى بناءً على الكلمات
    const totalWords = users[userIndex].stats.words;
    let level = "🥉 برونزي";
    let nextLevel = 1000;
    if (totalWords >= 10000) { level = "🏆 أسطوري"; nextLevel = null; }
    else if (totalWords >= 5000) { level = "💎 ماسي"; nextLevel = 10000; }
    else if (totalWords >= 2000) { level = "🥈 فضّي"; nextLevel = 5000; }
    else if (totalWords >= 500) { level = "🥇 ذهبي"; nextLevel = 2000; }
    else { nextLevel = 500; }

    res.json({
        success: true,
        analysis: {
            words,
            chars,
            sentences,
            paragraphs,
            letters,
            numbers,
            spaces,
            readingTime,
            mode: mode === 'ai' ? '🤖 AI Enhanced' : '📝 Normal'
        },
        stats: users[userIndex].stats,
        level: { current: level, nextLevel, progress: Math.min(100, Math.floor((totalWords / nextLevel) * 100)) },
        history: users[userIndex].history.slice(0, 5)
    });
});

// ========== 🗑️ مسح السجل ==========
app.delete("/api/user/history", authenticate, async (req, res) => {
    const users = await getUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex === -1) return res.status(404).json({ error: "مستخدم مش موجود" });

    users[userIndex].history = [];
    await saveUsers(users);

    res.json({ success: true, message: "🧹 تم مسح السجل بالكامل" });
});

// ========== 📈 لوحة التحكم (Admin فقط) ==========
app.get("/api/admin/stats", authenticate, async (req, res) => {
    const users = await getUsers();
    const currentUser = users.find(u => u.id === req.user.id);

    // أول مستخدم مسجل هو الأدمن
    const isAdmin = users[0]?.id === req.user.id;

    if (!isAdmin) {
        return res.status(403).json({ error: "🚫 أنت مش أدمن يا معلم" });
    }

    const totalUsers = users.length;
    const totalWords = users.reduce((sum, u) => sum + u.stats.words, 0);
    const totalTexts = users.reduce((sum, u) => sum + u.stats.texts, 0);
    const topUsers = [...users].sort((a, b) => b.stats.words - a.stats.words).slice(0, 5);

    res.json({
        totalUsers,
        totalWords,
        totalTexts,
        topUsers: topUsers.map(u => ({ username: u.username, words: u.stats.words })),
        activeToday: users.filter(u => {
            const lastActive = new Date(u.stats.last_active);
            const today = new Date();
            return lastActive.toDateString() === today.toDateString();
        }).length
    });
});

// ========== 🌐 جلب إحصائيات عامة (بدون تسجيل) ==========
app.get("/api/public/stats", async (req, res) => {
    const users = await getUsers();
    const totalWords = users.reduce((sum, u) => sum + u.stats.words, 0);
    const totalUsers = users.length;

    res.json({
        totalWordsProcessed: totalWords,
        totalUsers: totalUsers,
        message: "🚀 Word Counter Pro - عد الكلمات باحترافية"
    });
});

const PORT = 3000;
// ========== 🏁 تشغيل السيرفر ==========
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🔥 WORD COUNTER PRO - THE BEAST IS ALIVE 🔥           ║
║                                                          ║
║   📡 Server running on: http://localhost:${PORT}         ║
║   🚀 Status: READY FOR BATTLE                           ║
║   💰 Ready to make money                                ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
});

