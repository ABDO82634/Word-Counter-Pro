// ========== المتغيرات العامة ==========
let currentMode = 'normal';
let currentUser = null;

// ========== دوال مساعدة ==========
function getToken() {
    return localStorage.getItem('token');
}

function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

function setAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    currentUser = user;
}

function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
}

function isAuthenticated() {
    return !!getToken();
}

// ========== إظهار رسالة خطأ ==========
function showError(elementId, message) {
    const errorDiv = document.getElementById(elementId);
    if (errorDiv) {
        errorDiv.innerText = message;
        setTimeout(() => errorDiv.innerText = '', 3000);
    }
}

// ========== تسجيل الدخول ==========
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok) {
                setAuth(data.token, data.user);
                window.location.href = 'dashboard.html';
            } else {
                showError('errorMsg', data.error || 'فشل تسجيل الدخول');
            }
        } catch (err) {
            showError('errorMsg', 'خطأ في الاتصال بالسيرفر');
        }
    });
}

// ========== التسجيل ==========
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            showError('errorMsg', 'كلمة المرور غير متطابقة');
            return;
        }

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok) {
                alert('✅ تم التسجيل بنجاح! سجل دخول الآن');
                window.location.href = 'login.html';
            } else {
                showError('errorMsg', data.error || 'فشل التسجيل');
            }
        } catch (err) {
            showError('errorMsg', 'خطأ في الاتصال بالسيرفر');
        }
    });
}

// ========== لوحة التحكم ==========
if (window.location.pathname.includes('dashboard.html')) {
    // التحقق من تسجيل الدخول
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }

    // جلب الإحصائيات
    async function loadStats() {
        try {
            const res = await fetch('/api/user/stats', {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });

            if (!res.ok) {
                if (res.status === 403) {
                    clearAuth();
                    window.location.href = 'login.html';
                }
                return;
            }

            const data = await res.json();

            document.getElementById('totalTexts').innerText = data.stats.texts || 0;
            document.getElementById('totalWords').innerText = (data.stats.words || 0).toLocaleString();
            document.getElementById('totalChars').innerText = (data.stats.chars || 0).toLocaleString();
            document.getElementById('aiTasks').innerText = data.stats.ai_tasks || 0;

            // مستوى التقدم
            const totalWords = data.stats.words || 0;
            let level = '🥉 برونزي';
            let nextLevel = 500;
            let progress = Math.min(100, (totalWords / 500) * 100);

            if (totalWords >= 10000) { level = '🏆 أسطوري'; nextLevel = null; progress = 100; }
            else if (totalWords >= 5000) { level = '💎 ماسي'; nextLevel = 10000; progress = (totalWords / 10000) * 100; }
            else if (totalWords >= 2000) { level = '🥈 فضّي'; nextLevel = 5000; progress = (totalWords / 5000) * 100; }
            else if (totalWords >= 500) { level = '🥇 ذهبي'; nextLevel = 2000; progress = (totalWords / 2000) * 100; }

            document.getElementById('levelName').innerText = level;
            document.getElementById('levelFill').style.width = `${progress}%`;
            document.getElementById('levelProgress').innerText = `${Math.floor(progress)}%`;

            if (nextLevel) {
                document.getElementById('nextLevelText').innerText = `تحتاج ${nextLevel - totalWords} كلمة للوصول للمستوى التالي`;
            } else {
                document.getElementById('nextLevelText').innerText = '🎉 أنت أسطورة! حافظ على مستواك';
            }

            // عرض السجل
            if (data.history && data.history.length > 0) {
                const historyList = document.getElementById('historyList');
                historyList.innerHTML = '';
                data.history.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML = `
                        <span>📝 ${item.words} كلمة</span>
                        <span>⏱️ ${item.readingTime || 'غير محدد'}</span>
                        <span>📅 ${new Date(item.timestamp).toLocaleString('ar-EG')}</span>
                    `;
                    historyList.appendChild(div);
                });
            }
        } catch (err) {
            console.error(err);
        }
    }

    // تحليل النص
    async function analyzeText() {
        const text = document.getElementById('textInput').value;

        if (!text.trim()) {
            alert('📝 من فضلك أدخل نصاً للتحليل');
            return;
        }

        const analyzeBtn = document.getElementById('analyzeBtn');
        analyzeBtn.innerText = '⏳ جاري التحليل...';
        analyzeBtn.disabled = true;

        try {
            const res = await fetch('/api/core/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ text, mode: currentMode })
            });

            const data = await res.json();

            if (res.ok) {
                // عرض النتائج
                document.getElementById('resultsSection').style.display = 'block';
                document.getElementById('resultWords').innerText = data.analysis.words || 0;
                document.getElementById('resultChars').innerText = data.analysis.chars || 0;
                document.getElementById('resultSentences').innerText = data.analysis.sentences || 0;
                document.getElementById('resultParagraphs').innerText = data.analysis.paragraphs || 0;
                document.getElementById('resultReadingTime').innerText = data.analysis.readingTime || '0';
                document.getElementById('resultMode').innerText = data.analysis.mode || currentMode;

                // تحديث الإحصائيات
                loadStats();
            } else {
                alert(data.error || 'حدث خطأ');
            }
        } catch (err) {
            alert('خطأ في الاتصال بالسيرفر');
        } finally {
            analyzeBtn.innerText = '🔍 تحليل النص';
            analyzeBtn.disabled = false;
        }
    }

    // مسح النص
    function clearText() {
        document.getElementById('textInput').value = '';
        document.getElementById('resultsSection').style.display = 'none';
    }

    // مسح السجل
    async function clearHistory() {
        if (confirm('هل أنت متأكد من مسح كل السجل؟')) {
            try {
                const res = await fetch('/api/user/history', {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });

                if (res.ok) {
                    loadStats();
                    alert('✅ تم مسح السجل');
                }
            } catch (err) {
                alert('خطأ في مسح السجل');
            }
        }
    }

    // تسجيل الخروج
    function logout() {
        clearAuth();
        window.location.href = 'index.html';
    }

    // تبديل الوضع
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
        });
    });

    // إضافة المستمعين
    document.getElementById('analyzeBtn')?.addEventListener('click', analyzeText);
    document.getElementById('clearBtn')?.addEventListener('click', clearText);
    document.getElementById('clearHistoryBtn')?.addEventListener('click', clearHistory);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);

    // تحميل البيانات
    loadStats();
}