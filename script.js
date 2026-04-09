// --- API KEYS CONFIGURATION ---
        const SAMBANOVA_KEY = 'e4c01b89-c576-4237-9efe-e40c4cb6420c'; 
        const GROQ_KEY = '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'; 
        
        const CONFIG = {
            samba: {
                name: 'Llama 3.1',
                key: SAMBANOVA_KEY,
                url: 'https://api.sambanova.ai/v1/chat/completions',
                modelId: 'Meta-Llama-3.1-8B-Instruct',
                color: 'blue'
            },
            groq: {
                name: 'Llama Scout',
                key: GROQ_KEY,
                url: 'https://api.groq.com/openai/v1/chat/completions',
                modelId: 'llama-3.3-70b-versatile',
                color: 'orange'
            },
            creator: 'JAYANT CHAUDHARY',
            activeModel: 'samba'
        };

        // --- STATE ---
        let sessions = JSON.parse(localStorage.getItem('skymind_sessions_v10')) || [];
        let messages = [];
        let currentChatId = null;
        let isTyping = false;
        let chatToDeleteId = null;
        let codeBlockCounter = 0; // Unique ID counter for code blocks

        // --- DOM ---
        const dom = {
            chat: document.getElementById('chat-container'),
            input: document.getElementById('user-input'),
            sendBtn: document.getElementById('send-btn'),
            welcome: document.getElementById('welcome-screen'),
            history: document.getElementById('history-list'),
            modelBadge: document.getElementById('model-badge'),
            modelName: document.getElementById('current-model-name'),
            statusInd: document.getElementById('status-indicator'),
            contextMenu: document.getElementById('context-menu'),
            aboutScreen: document.getElementById('about-screen'),
            aboutContent: document.getElementById('about-content')
        };

        // --- AUTO-SCROLL OBSERVER ---
        const chatObserver = new MutationObserver(() => {
            scrollToBottom();
        });
        chatObserver.observe(dom.chat, { childList: true, subtree: true, characterData: true });

        // --- BULLETPROOF COPY FUNCTION ---
        function copyCode(blockId, btn) {
            const codeEl = document.getElementById(blockId);
            if (!codeEl) return;
            
            // Get raw text
            const code = codeEl.textContent || codeEl.innerText;
            
            // UI Update handler
            const originalHtml = btn.innerHTML;
            const showSuccess = () => {
                btn.innerHTML = '<i class="fa-solid fa-check text-green-400"></i> Copied!';
                setTimeout(() => btn.innerHTML = originalHtml, 2000);
            };

            // Mobile fallback function
            const fallbackCopyText = (text) => {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                
                // Keep it visible but off-screen (prevents WebViews from blocking the copy command)
                textArea.style.position = "absolute";
                textArea.style.left = "-99999px";
                textArea.style.top = "-99999px";
                // Prevent iOS zoom
                textArea.style.fontSize = "16px";
                
                document.body.appendChild(textArea);
                
                // Mobile-specific selection requirements
                textArea.focus();
                textArea.select();
                textArea.setSelectionRange(0, 999999);

                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        showSuccess();
                    } else {
                        console.error('Fallback command returned false');
                    }
                } catch (err) {
                    console.error('Fallback copy failed', err);
                }

                document.body.removeChild(textArea);
            };

            // Attempt Modern API first, then fallback
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(code)
                    .then(showSuccess)
                    .catch(err => {
                        console.log('Clipboard API failed, trying fallback...', err);
                        fallbackCopyText(code);
                    });
            } else {
                // If in an APK/WebView (not secure context), run fallback immediately
                fallbackCopyText(code);
            }
        }

        // --- MARKED.JS CONFIGURATION ---
        const renderer = new marked.Renderer();
        
        renderer.code = function(tokenOrCode, langArg) {
            codeBlockCounter++;
            const blockId = 'skymind-code-' + codeBlockCounter;

            const code = typeof tokenOrCode === 'object' ? tokenOrCode.text : tokenOrCode;
            const language = typeof tokenOrCode === 'object' ? tokenOrCode.lang : langArg;
            
            const validLang = !!(language && hljs.getLanguage(language));
            const highlighted = validLang ? hljs.highlight(code, { language }).value : escapeHtml(code);
            const langLabel = language || 'plaintext';
            
            // Button directly calls the ID
            const buttonsHtml = `
                <button onclick="copyCode('${blockId}', this)" class="text-slate-400 hover:text-white transition-colors text-xs flex items-center gap-1">
                    <i class="fa-regular fa-copy"></i> Copy
                </button>
            `;

            return `
                <div class="code-block-wrapper">
                    <div class="code-header">
                        <span class="text-xs text-slate-400 font-mono uppercase">${langLabel}</span>
                        <div class="flex gap-4">
                            ${buttonsHtml}
                        </div>
                    </div>
                    <pre><code id="${blockId}" class="hljs language-${langLabel}">${highlighted}</code></pre>
                </div>
            `;
        };

        marked.setOptions({ renderer: renderer, breaks: true });

        // --- INITIALIZATION ---
        document.addEventListener('DOMContentLoaded', () => {
            renderHistory();
            startNewChat();
            updateModelUI();
        });

        // --- ABOUT US MODAL LOGIC ---
        function showAbout() {
            // Close sidebar if on mobile so it doesn't overlap weirdly
            if (window.innerWidth < 768) {
                document.getElementById('sidebar').classList.add('-translate-x-full');
                document.getElementById('sidebar-overlay').classList.add('hidden');
                document.getElementById('sidebar-overlay').classList.remove('opacity-0');
            }
            
            dom.aboutScreen.classList.remove('hidden');
            
            // Small delay to ensure display: block is applied before animating opacity/scale
            requestAnimationFrame(() => {
                dom.aboutScreen.classList.remove('opacity-0');
                dom.aboutContent.classList.remove('scale-95');
                dom.aboutContent.classList.add('scale-100');
            });
        }

        function hideAbout() {
            dom.aboutScreen.classList.add('opacity-0');
            dom.aboutContent.classList.remove('scale-100');
            dom.aboutContent.classList.add('scale-95');
            
            // Wait for transition to finish before hiding display
            setTimeout(() => {
                dom.aboutScreen.classList.add('hidden');
            }, 300);
        }

        // --- MODEL MANAGEMENT ---
        function cycleModel() {
            CONFIG.activeModel = CONFIG.activeModel === 'samba' ? 'groq' : 'samba';
            updateModelUI();
        }

        function updateModelUI() {
            const isSamba = CONFIG.activeModel === 'samba';
            const color = isSamba ? CONFIG.samba.color : CONFIG.groq.color;
            const name = isSamba ? CONFIG.samba.name.toUpperCase() : CONFIG.groq.name.toUpperCase();
            
            dom.modelBadge.className = `flex items-center gap-2 px-2 py-1 rounded-lg bg-${color}-500/10 hover:bg-${color}-500/20 border border-${color}-500/20 transition-all cursor-pointer`;
            
            const dotColor = isSamba ? '#60a5fa' : '#fb923c'; 
            const dotShadow = isSamba ? '0 0 8px rgba(96,165,250,0.8)' : '0 0 8px rgba(251,146,60,0.8)';
            
            dom.modelBadge.querySelector('div').style.backgroundColor = dotColor;
            dom.modelBadge.querySelector('div').style.boxShadow = dotShadow;
            
            dom.modelName.className = `text-[10px] font-bold text-${color}-300 tracking-wide uppercase`;
            dom.modelName.innerText = name;
            dom.modelBadge.querySelector('i').className = `fa-solid fa-chevron-down text-[10px] opacity-50 text-${color}-300`;
        }

        async function switchModelAndRetry(userText, failedModelName) {
            dom.statusInd.classList.remove('hidden');
            dom.statusInd.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-yellow-500"></i> ${failedModelName} failed. Auto-switching...`;
            
            CONFIG.activeModel = CONFIG.activeModel === 'samba' ? 'groq' : 'samba';
            updateModelUI();

            await new Promise(r => setTimeout(r, 1500));
            
            dom.statusInd.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> Retrying with ${CONFIG.activeModel === 'samba' ? CONFIG.samba.name : CONFIG.groq.name}...`;
            
            await generateResponse(userText, true); 
            
            dom.statusInd.classList.add('hidden');
        }

        // --- CHAT LOGIC ---
        function startNewChat() {
            currentChatId = Date.now().toString();
            messages = [
                { role: "system", content: `You are Skymind, created by ${CONFIG.creator}. Use LaTeX ($...$) for math.` }
            ];
            dom.chat.innerHTML = '';
            dom.chat.appendChild(dom.welcome);
            dom.welcome.style.display = 'flex';
            dom.input.value = '';
            autoResize(dom.input);
            renderHistory();
        }

        async function sendMessage() {
            if (isTyping) return;
            const text = dom.input.value.trim();
            if (!text) return;

            dom.input.value = '';
            autoResize(dom.input);
            dom.welcome.style.display = 'none';
            dom.sendBtn.disabled = true;
            isTyping = true;

            appendMessageToUI('user', text);
            messages.push({ role: "user", content: text });
            saveSession(text);

            await generateResponse(text, false);
        }

        async function generateResponse(userText, isRetry) {
            const responseId = 'msg-' + Date.now();
            const messageContentDiv = appendMessageToUI('assistant', '', responseId);
            
            try {
                let text = "";
                const modelConfig = CONFIG.activeModel === 'samba' ? CONFIG.samba : CONFIG.groq;
                text = await callAPI(modelConfig, messages);

                await typeWriterEffect(messageContentDiv, text);
                messages.push({ role: "assistant", content: text });
                saveSession(userText);

            } catch (error) {
                console.error(error);
                messageContentDiv.innerHTML = `<span class="text-red-400 text-xs"><i class="fa-solid fa-circle-exclamation"></i> Error: ${error.message}</span>`;
                if (!isRetry) await switchModelAndRetry(userText, CONFIG.activeModel === 'samba' ? CONFIG.samba.name : CONFIG.groq.name);
            } finally {
                if (!isRetry) {
                    dom.sendBtn.disabled = false;
                    isTyping = false;
                    dom.input.focus();
                }
            }
        }

        async function callAPI(modelConfig, msgs) {
            const response = await fetch(modelConfig.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${modelConfig.key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelConfig.modelId,
                    messages: msgs,
                    temperature: 0.7,
                    max_tokens: 8192
                })
            });
            
            if (!response.ok) {
                const err = await response.json().catch(()=>({}));
                throw new Error(err.error?.message || response.statusText);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
        }

        // --- UI HELPERS ---
        function appendMessageToUI(role, content, id = null) {
            const isUser = role === 'user';
            const isSystem = role === 'system';
            const div = document.createElement('div');
            div.className = `w-full flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`;
            
            if (isSystem) {
                div.innerHTML = `<div class="w-full text-center"><span class="bg-red-500/10 text-red-400 text-[10px] px-3 py-1 rounded-full border border-red-500/20">${content}</span></div>`;
                dom.chat.appendChild(div);
                scrollToBottom();
                return;
            }

            const contentId = id || `msg-${Date.now()}`;
            const avatar = isUser ? 
                `<div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 order-2 ml-3"><i class="fa-solid fa-user text-xs"></i></div>` :
                `<div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0 mr-3"><i class="fa-solid fa-bolt text-xs text-white"></i></div>`;

            div.innerHTML = `
                ${!isUser ? avatar : ''}
                <div class="flex flex-col max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end order-1' : 'items-start'}">
                    <span class="text-[9px] text-slate-500 mb-1 px-1 uppercase tracking-wider">${isUser ? 'You' : 'Skymind'}</span>
                    <div class="${isUser ? 'user-msg text-white' : 'ai-msg text-slate-200'} p-4 shadow-lg prose prose-invert prose-sm max-w-none break-words w-full group relative">
                        <div id="${contentId}">${isUser ? escapeHtml(content) : ''}</div>
                    </div>
                </div>
                ${isUser ? avatar : ''}
            `;

            dom.chat.appendChild(div);
            scrollToBottom();
            return document.getElementById(contentId);
        }

        async function typeWriterEffect(element, text) {
            const words = text.split(/(\s+)/);
            let currentHTML = '';
            const prevCursor = document.querySelector('.cursor');
            if(prevCursor) prevCursor.remove();

            for (let i = 0; i < words.length; i++) {
                currentHTML += words[i];
                if (i % 5 === 0) {
                    element.innerHTML = marked.parse(currentHTML) + '<span class="cursor"></span>';
                    renderMathInElement(element, {delimiters: [{left: '$$', right: '$$', display: true},{left: '$', right: '$', display: false}]});
                }
                await new Promise(r => setTimeout(r, 2));
            }
            element.innerHTML = marked.parse(text);
            renderMathInElement(element, {delimiters: [{left: '$$', right: '$$', display: true},{left: '$', right: '$', display: false}]});
        }

        // --- UTILS ---
        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('-translate-x-full');
            document.getElementById('sidebar-overlay').classList.toggle('hidden');
            setTimeout(() => document.getElementById('sidebar-overlay').classList.toggle('opacity-0'), 10);
        }
        function toggleSidebarIfMobile() { if (window.innerWidth < 768) toggleSidebar(); }
        function scrollToBottom() { dom.chat.scrollTop = dom.chat.scrollHeight; }
        function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
        function handleEnter(e) { if(e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); sendMessage(); } }
        
        function escapeHtml(t) { 
            if (typeof t !== 'string') return '';
            return t.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]); 
        }
        
        // --- HISTORY & CONTEXT MENU ---
        function renderHistory() {
            dom.history.innerHTML = '';
            sessions.forEach(chat => {
                const btn = document.createElement('div'); 
                const isActive = chat.id === currentChatId;
                btn.className = `w-full text-left p-3 rounded-lg mb-1 flex items-center gap-3 transition-all cursor-pointer ${isActive ? 'bg-white/10' : 'hover:bg-white/5'} text-slate-400 hover:text-white`;
                
                btn.innerHTML = `<i class="fa-regular fa-message text-xs"></i><span class="text-sm truncate flex-1 pointer-events-none">${chat.title}</span>`;
                
                let pressTimer;
                btn.addEventListener('click', () => loadChat(chat.id));
                btn.addEventListener('touchstart', (e) => { pressTimer = setTimeout(() => showContextMenu(e, chat.id), 600); });
                btn.addEventListener('touchend', () => clearTimeout(pressTimer));
                btn.addEventListener('touchmove', () => clearTimeout(pressTimer));
                btn.addEventListener('contextmenu', (e) => { e.preventDefault(); showContextMenu(e, chat.id); });

                dom.history.appendChild(btn);
            });
        }

        function showContextMenu(e, chatId) {
            chatToDeleteId = chatId;
            let x = e.clientX; let y = e.clientY;
            if (e.touches && e.touches[0]) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
            dom.contextMenu.style.left = `${x}px`;
            dom.contextMenu.style.top = `${y}px`;
            dom.contextMenu.style.display = 'block';
            if (navigator.vibrate) navigator.vibrate(50);
        }

        function hideContextMenu() { dom.contextMenu.style.display = 'none'; }

        function deleteSelectedChat() {
            if (!chatToDeleteId) return;
            sessions = sessions.filter(s => s.id !== chatToDeleteId);
            localStorage.setItem('skymind_sessions_v10', JSON.stringify(sessions));
            localStorage.removeItem(`skymind_chat_v10_${chatToDeleteId}`);
            if (chatToDeleteId === currentChatId) startNewChat();
            else renderHistory();
            hideContextMenu();
        }

        function saveSession(text) {
            const existing = sessions.findIndex(s => s.id === currentChatId);
            const entry = { id: currentChatId, title: text.substring(0,30)+'...', time: new Date() };
            if(existing > -1) sessions.splice(existing, 1);
            sessions.unshift(entry);
            localStorage.setItem('skymind_sessions_v10', JSON.stringify(sessions));
            localStorage.setItem(`skymind_chat_v10_${currentChatId}`, JSON.stringify(messages));
            renderHistory();
        }

        function loadChat(id) {
            const data = localStorage.getItem(`skymind_chat_v10_${id}`);
            if(!data) return startNewChat();
            currentChatId = id;
            messages = JSON.parse(data);
            dom.chat.innerHTML = '';
            dom.welcome.style.display = 'none';
            messages.slice(1).forEach(m => {
                const div = appendMessageToUI(m.role, m.content);
                div.innerHTML = marked.parse(m.content);
                renderMathInElement(div, {delimiters: [{left: '$$', right: '$$', display: true},{left: '$', right: '$', display: false}]});
            });
            toggleSidebarIfMobile();
        }
