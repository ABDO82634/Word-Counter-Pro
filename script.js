// ========== Word Counter Pro - LocalStorage Version ==========
// بيشتغل من غير سيرفر ولا قاعدة بيانات

let currentUser = null;

// تسجيل مستخدم جديد
function register(username, password) {
    let users = JSON.parse(localStorage.getItem('users') || '[]');

    if (users.find(u => u.username === username)) {
        return { error: 'اسم المستخدم موجود بالفعل' };
    }

    if (username.length < 3) {
        return { error: 'اسم المستخدم لازم 3 حروف على الأقل' };
    }

    if (password.length < 4) {
        return { error: 'كلمة المرور لازم 4 حروف على الأقل' };
    }

    const newUser = {
        username: username,
        password: btoa(password),
        stats: { texts: 0, words: 0, chars: 0, ai_tasks: 0 },
        history: [],
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    return { success: true };
}

// تسجيل دخول
function login(username, password) {
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.username === username && atob(u.password) === password);

    if (!user) {
        return { error: 'اسم المستخدم أو كلمة المرور غلط' };
    }

    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    return { success: true, user: currentUser };
}

// تحليل النص
function analyzeText(text, mode = 'normal') {
    if (!currentUser) {
        return { error: 'سجل دخول أولاً' };
    }

    if (!text || text.trim() === '') {
        return { error: 'أدخل نصاً للتحليل' };
    }

    // الحسابات
    const words = text.trim().split(/\s+/).length;
    const chars = text.length;
    const sentences = (text.match(/[.!?؟]+/g) || []).length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    const readingTime = Math.ceil(words / 200);
    const letters = (text.match(/[a-zA-Z]/g) || []).length;
    const numbers = (text.match(/[0-9]/g) || []).length;

    // تحديث الإحصائيات
    currentUser.stats.texts++;
    currentUser.stats.words += words;
    currentUser.stats.chars += chars;
    if (mode === 'ai') currentUser.stats.ai_tasks++;

    // إضافة للسجل
    currentUser.history.unshift({
        words: words,
        chars: chars,
        sentences: sentences,
        paragraphs: paragraphs,
        readingTime: readingTime,
        mode: mode,
        preview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        date: new Date().toISOString()
    });

    // خلي آخر 20 عملية بس
    if (currentUser.history.length > 20) {
        currentUser.history.pop();
    }

    // حفظ في localStorage
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    const index = users.findIndex(u => u.username === currentUser.username);
    if (index !== -1) {
        users[index] = currentUser;
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }

    // حساب المستوى
    const totalWords = currentUser.stats.words;
    let level = '🥉 برونزي';
    let nextLevel = 500;
    let progress = Math.min(100, (totalWords / 500) * 100);

    if (totalWords >= 10000) { level = '🏆 أسطوري'; nextLevel = null; progress = 100; }
    else if (totalWords >= 5000) { level = '💎 ماسي'; nextLevel = 10000; progress = (totalWords / 10000) * 100; }
    else if (totalWords >= 2000) { level = '🥇 ذهبي'; nextLevel = 5000; progress = (totalWords / 5000) * 100; }
    else if (totalWords >= 500) { level = '🥈 فضّي'; nextLevel = 2000; progress = (totalWords / 2000) * 100; }

    return {
        success: true,
        analysis: {
            words, chars, sentences, paragraphs, letters, numbers,
            readingTime: readingTime + ' دقائق',
            mode: mode === 'ai' ? '🤖 AI Pro' : '📝 عادي'
        },
        stats: currentUser.stats,
        level: { name: level, nextLevel: nextLevel, progress: progress },
        history: currentUser.history.slice(0, 5)
    };
}

// تسجيل خروج
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    return { success: true };
}

// استعادة الجلسة عند تحميل الصفحة
function loadSession() {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
        currentUser = JSON.parse(saved);
        return currentUser;
    }
    return null;
}

// جلب الإحصائيات العامة (لصفحة الرئيسية)
function getPublicStats() {
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    const totalWords = users.reduce((sum, u) => sum + (u.stats?.words || 0), 0);
    const totalUsers = users.length;

    return { totalWords, totalUsers };
}

// تصدير دوال للاستخدام العالمي
window.WordCounter = {
    register,
    login,
    analyzeText,
    logout,
    loadSession,
    getPublicStats
};