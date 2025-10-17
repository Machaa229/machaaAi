// main.js
const sendButton = document.getElementById("sendButton");
const chatInput = document.getElementById('chatInput');
const chatbox = document.getElementById('chatbox');
const userEmailEl = document.getElementById("userEmail");
const emailText = document.getElementById("emailText");
const newChatButton = document.getElementById("newChatButton");
const profileMenu = document.getElementById("profileMenu");
const changePasswordItem = document.getElementById("changePasswordItem");
const logoutItem = document.getElementById("logoutItem");
const changePasswordModal = document.getElementById("changePasswordModal");
const cancelPasswordChange = document.getElementById("cancelPasswordChange");
const savePassword = document.getElementById("savePassword");
const chatHistoryList = document.getElementById("chatHistoryList");
const emptyState = document.getElementById("emptyState");
const renameChatModal = document.getElementById("renameChatModal");
const newChatTitle = document.getElementById("newChatTitle");
const cancelRename = document.getElementById("cancelRename");
const saveRename = document.getElementById("saveRename");
const deleteChatModal = document.getElementById("deleteChatModal");
const cancelDelete = document.getElementById("cancelDelete");
const confirmDelete = document.getElementById("confirmDelete");

// Firebase API anahtarı
const firebaseApiKey = "AIzaSyDIMp5cJ81ycmvuscBz07IQLowBv7fWO8U";

// Kullanıcı bilgisi localStorage'dan alınacak
const userEmail = localStorage.getItem("activeUser");

// Eğer giriş yapılmamışsa login.html'e yönlendir
if (!userEmail) {
    window.location.href = "login.html";
}

emailText.textContent = userEmail;

// Tüm sohbetlerin listesi
const chatSessionsKey = "chatSessions_" + userEmail;
let chatSessions = JSON.parse(localStorage.getItem(chatSessionsKey) || "[]");

// Aktif sohbet
let activeChatId = localStorage.getItem("activeChatId_" + userEmail) || null;
let activeChatHistory = [];
let chatToRename = null;
let chatToDelete = null;

// Geçmiş sohbetleri yükle
loadChatSessions();

// Aktif sohbet varsa yükle
if (activeChatId) {
    loadChat(activeChatId);
} else {
    emptyState.style.display = 'block';
}

// Profil menüsünü göster/gizle
userEmailEl.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu.style.display = profileMenu.style.display === 'block' ? 'none' : 'block';
});

// Dışarı tıklayınca menüyü kapat
document.addEventListener('click', () => {
    profileMenu.style.display = 'none';
});

// Yeni sohbet butonu
newChatButton.addEventListener('click', () => {
    createNewChat();
});

// Şifre değiştirme modalını aç
changePasswordItem.addEventListener('click', () => {
    changePasswordModal.style.display = 'flex';
    profileMenu.style.display = 'none';
});

// Şifre değiştirme modalını kapat
cancelPasswordChange.addEventListener('click', () => {
    changePasswordModal.style.display = 'none';
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
});

// Şifre değiştirme işlemi
savePassword.addEventListener('click', async () => {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Lütfen tüm alanları doldurun.');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('Yeni şifreler eşleşmiyor.');
        return;
    }

    if (newPassword.length < 6) {
        alert('Yeni şifre en az 6 karakter olmalıdır.');
        return;
    }

    try {
        // Firebase şifre değiştirme işlemi
        const user = firebase.auth().currentUser;
        if (user) {
            const credential = firebase.auth.EmailAuthProvider.credential(
                user.email, 
                currentPassword
            );
            
            await user.reauthenticateWithCredential(credential);
            await user.updatePassword(newPassword);
            
            alert('Şifre başarıyla değiştirildi.');
            changePasswordModal.style.display = 'none';
            
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            alert('Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.');
        }
    } catch (error) {
        console.error('Şifre değiştirme hatası:', error);
        if (error.code === 'auth/wrong-password') {
            alert('Mevcut şifre yanlış.');
        } else if (error.code === 'auth/requires-recent-login') {
            alert('Bu işlem için son zamanlarda tekrar giriş yapmanız gerekiyor. Lütfen çıkış yapıp tekrar giriş yapın.');
        } else {
            alert('Şifre değiştirilirken bir hata oluştu: ' + error.message);
        }
    }
});

// Çıkış yap
logoutItem.addEventListener('click', () => {
    if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
        localStorage.removeItem("activeUser");
        window.location.href = "login.html";
    }
});

// Yeniden adlandırma modalını kapat
cancelRename.addEventListener('click', () => {
    renameChatModal.style.display = 'none';
    newChatTitle.value = '';
    chatToRename = null;
});

// Yeniden adlandırma işlemi
saveRename.addEventListener('click', () => {
    const newTitle = newChatTitle.value.trim();
    if (!newTitle) {
        alert('Lütfen bir başlık girin.');
        return;
    }

    if (chatToRename) {
        const chatIndex = chatSessions.findIndex(c => c.id === chatToRename);
        if (chatIndex !== -1) {
            chatSessions[chatIndex].title = newTitle;
            localStorage.setItem(chatSessionsKey, JSON.stringify(chatSessions));
            loadChatSessions();
        }
    }

    renameChatModal.style.display = 'none';
    newChatTitle.value = '';
    chatToRename = null;
});

// Silme modalını kapat
cancelDelete.addEventListener('click', () => {
    deleteChatModal.style.display = 'none';
    chatToDelete = null;
});

// Silme işlemi
confirmDelete.addEventListener('click', () => {
    if (chatToDelete) {
        chatSessions = chatSessions.filter(chat => chat.id !== chatToDelete);
        localStorage.setItem(chatSessionsKey, JSON.stringify(chatSessions));
        
        if (activeChatId === chatToDelete) {
            activeChatId = null;
            localStorage.removeItem("activeChatId_" + userEmail);
            chatbox.innerHTML = '';
            emptyState.style.display = 'block';
        }
        
        loadChatSessions();
    }
    deleteChatModal.style.display = 'none';
    chatToDelete = null;
});

// Yeni sohbet oluştur
function createNewChat() {
    const chatId = 'chat_' + Date.now();
    const newChat = {
        id: chatId,
        title: 'Yeni Sohbet',
        lastMessage: 'Henüz mesaj yok',
        timestamp: Date.now(),
        messages: []
    };
    
    chatSessions.unshift(newChat);
    localStorage.setItem(chatSessionsKey, JSON.stringify(chatSessions));
    
    setActiveChat(chatId);
    loadChatSessions();
    
    emptyState.style.display = 'none';
    chatInput.focus();
}

// Sohbeti sil
function deleteChat(chatId) {
    chatToDelete = chatId;
    deleteChatModal.style.display = 'flex';
}

// Sohbeti yeniden adlandır
function renameChat(chatId) {
    const chat = chatSessions.find(c => c.id === chatId);
    if (chat) {
        chatToRename = chatId;
        newChatTitle.value = chat.title;
        renameChatModal.style.display = 'flex';
    }
}

// Geçmiş sohbetleri yükle
function loadChatSessions() {
    chatHistoryList.innerHTML = '';
    
    if (chatSessions.length === 0) {
        chatHistoryList.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">forum</span>
                <p>Henüz sohbet yok</p>
            </div>
        `;
        return;
    }
    
    chatSessions.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-history-item ${chat.id === activeChatId ? 'active' : ''}`;
        chatItem.innerHTML = `
            <div class="chat-history-item-header">
                <div class="chat-history-item-title">${chat.title}</div>
                <div class="chat-item-actions">
                    <button class="chat-item-btn rename-btn" title="Yeniden Adlandır">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="chat-item-btn delete-btn" title="Sil">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            </div>
            <div class="chat-history-item-preview">${chat.lastMessage}</div>
        `;
        
        chatItem.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-item-actions')) {
                setActiveChat(chat.id);
            }
        });
        
        // Yeniden adlandır butonu
        const renameBtn = chatItem.querySelector('.rename-btn');
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renameChat(chat.id);
        });
        
        // Sil butonu
        const deleteBtn = chatItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });
        
        chatHistoryList.appendChild(chatItem);
    });
}

// Aktif sohbeti ayarla
function setActiveChat(chatId) {
    activeChatId = chatId;
    localStorage.setItem("activeChatId_" + userEmail, chatId);
    loadChatSessions();
    loadChat(chatId);
}

// Sohbeti yükle
function loadChat(chatId) {
    const chat = chatSessions.find(c => c.id === chatId);
    if (!chat) return;
    
    activeChatHistory = chat.messages;
    chatbox.innerHTML = '';
    emptyState.style.display = 'none';
    
    activeChatHistory.forEach(item => {
        displayMessage(item.text, item.isUser, false);
    });
    
    chatInput.focus();
}

// Sohbeti güncelle
function updateChatSession(message, isUser) {
    const chatIndex = chatSessions.findIndex(c => c.id === activeChatId);
    if (chatIndex === -1) return;
    
    const chat = chatSessions[chatIndex];
    chat.messages.push({ text: message, isUser: isUser });
    chat.lastMessage = message.length > 50 ? message.substring(0, 50) + '...' : message;
    chat.timestamp = Date.now();
    
    // İlk mesajsa başlık oluştur
    if (chat.messages.length === 1 && !isUser) {
        chat.title = message.length > 30 ? message.substring(0, 30) + '...' : message;
    }
    
    localStorage.setItem(chatSessionsKey, JSON.stringify(chatSessions));
    loadChatSessions();
}

// Dil tespiti için basit fonksiyon
function detectLanguage(code) {
    const patterns = {
        javascript: /\b(function|const|let|var|=>|console\.log)\b/,
        python: /\b(def|class|import|from|print)\b/,
        html: /<\/?[a-z][\s\S]*>/i,
        css: /[.#]?[a-z][^{]*{/,
        java: /\b(public|class|static|void|System\.out\.print)\b/,
        php: /<\?php|\$[a-z_]/i,
        cpp: /\b(int|main|cout|#include)\b/,
        c: /\b(int|main|printf|#include)\b/,
        sql: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE)\b/i
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
        if (pattern.test(code)) {
            return lang;
        }
    }
    return 'text';
}

// HTML önizleme fonksiyonu - Yeni pencere aç
function previewHtml(codeContent) {
    const popup = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    popup.document.write(codeContent);
    popup.document.close();
}

async function displayMessage(message, isUser, saveToHistory = true) {
    if (saveToHistory && activeChatId) {
        updateChatSession(message, isUser);
    }
    
    const msgElem = document.createElement('div');
    msgElem.className = `chat-message ${isUser ? 'user-message' : 'assistant-message'}`;

    // Kod bloğu kontrolü
    if(!isUser && message.includes("```")) {
        // Kod bloklarını ayır
        const codeBlocks = message.split("```");
        let processedMessage = '';
        
        for (let i = 0; i < codeBlocks.length; i++) {
            if (i % 2 === 0) {
                // Normal metin
                processedMessage += codeBlocks[i];
            } else {
                // Kod bloğu
                const codeContent = codeBlocks[i].trim();
                const language = detectLanguage(codeContent);
                
                const codeContainer = document.createElement('div');
                codeContainer.className = 'code-container';
                
                const codeHeader = document.createElement('div');
                codeHeader.className = 'code-header';
                
                // Sol taraf: HTML için önizleme butonu ve dil etiketi
                const leftContainer = document.createElement('div');
                leftContainer.style.display = 'flex';
                leftContainer.style.gap = '5px';
                leftContainer.style.alignItems = 'center';
                
                // HTML ise sol üstte önizleme butonu
                if (language === 'html') {
                    const previewButton = document.createElement('button');
                    previewButton.className = 'preview-html';
                    previewButton.textContent = 'Önizleme';
                    leftContainer.appendChild(previewButton);
                }
                
                // Dil etiketi
                const langTag = document.createElement('span');
                langTag.className = 'language-tag';
                langTag.textContent = language.toUpperCase();
                leftContainer.appendChild(langTag);
                
                codeHeader.appendChild(leftContainer);
                
                const codeBlock = document.createElement('pre');
                codeBlock.className = 'code-block';
                
                const codeElement = document.createElement('code');
                codeElement.className = `language-${language}`;
                codeElement.textContent = codeContent;
                
                codeBlock.appendChild(codeElement);
                codeContainer.appendChild(codeHeader);
                codeContainer.appendChild(codeBlock);
                
                // Geçici bir div oluşturup kod bloğunu ekleyelim
                const tempDiv = document.createElement('div');
                tempDiv.appendChild(codeContainer);
                processedMessage += tempDiv.innerHTML;
            }
        }
        
        msgElem.innerHTML = processedMessage;
        
        // Syntax highlighting uygula
        setTimeout(() => {
            msgElem.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }, 0);

        // Event listener'ları yeniden ekle
        setTimeout(() => {
            // Önizleme butonları için
            msgElem.querySelectorAll('.preview-html').forEach((previewBtn) => {
                previewBtn.addEventListener('click', () => {
                    const codeContainer = previewBtn.closest('.code-container');
                    const codeElement = codeContainer.querySelector('.code-block pre code');
                    const codeToPreview = codeElement.textContent || codeElement.innerText;
                    previewHtml(codeToPreview);
                });
            });
        }, 100);
        
    } else {
        msgElem.textContent = message;
    }

    chatbox.appendChild(msgElem);
    chatbox.scrollTop = chatbox.scrollHeight;
    emptyState.style.display = 'none';
}

async function callApi(apiUrl, prompt) {
    chatInput.value = "Machaa Ai yazıyor...";
    chatInput.disabled = true;
    sendButton.disabled = true;
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt})
    });

    chatInput.value = "";
    chatInput.disabled = false;
    sendButton.disabled = false;
    chatInput.focus();
    return response.json();
}

chatInput.focus();

sendButton.addEventListener('click', async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    // Aktif sohbet yoksa yeni oluştur
    if (!activeChatId) {
        createNewChat();
    }

    displayMessage(message, true);
    chatInput.value = '';

    const apiUrl = message.startsWith('/image') ? 
        'https://backend.buildpicoapps.com/aero/run/image-generation-api?pk=v1-Z0FBQUFBQm5HUEtMSjJkakVjcF9IQ0M0VFhRQ0FmSnNDSHNYTlJSblE0UXo1Q3RBcjFPcl9YYy1OZUhteDZWekxHdWRLM1M1alNZTkJMWEhNOWd4S1NPSDBTWC12M0U2UGc9PQ==' : 
        'https://backend.buildpicoapps.com/aero/run/llm-api?pk=v1-Z0FBQUFBQm5HUEtMSjJkakVjcF9IQ0M0VFhRQ0FmSnNDSHNYTlJSblE0UXo1Q3RBcjFPcl9YYy1OZUhteDZWekxHdWRLM1M1alNZTkJMWEhNOWd4S1NPSDBTWC12M0U2UGc9PQ==';

    try {
        const data = await callApi(apiUrl, message);
        if (data.status === 'success') {
            displayMessage(data.text, false);
        } else {
            displayMessage('Bir hata oluştu. Lütfen tekrar deneyin.', false);
        } 
    } catch (error) {
        console.error('Error:', error);
        displayMessage('Bir hata oluştu. Lütfen tekrar deneyin.', false);
    } 
});

chatInput.addEventListener("keypress", (e)=>{
    if(e.key === "Enter" && !e.shiftKey){
        e.preventDefault();
        sendButton.click();
    }
});

// Firebase yapılandırması
const firebaseConfig = {
    apiKey: "AIzaSyDIMp5cJ81ycmvuscBz07IQLowBv7fWO8U",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};

// Firebase'i başlat
firebase.initializeApp(firebaseConfig);