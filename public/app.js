/* ═══════════════════════════════════════════════════
   SynapseAI — Main Application Logic
   Neural Intelligence Chat Interface
   ═══════════════════════════════════════════════════ */

class SynapseAI {
  constructor() {
    // State
    this.currentSessionId = null;
    this.sessions = new Map();
    this.isGenerating = false;
    this.abortController = null;
    this.recognition = null;
    this.isRecording = false;
    this.attachedPdfText = null;  // PDF text for chat
    this.attachedPdfName = null;  // PDF file name for chat
    this.mcqPdfText = null;       // PDF text for MCQ
    this.mcqPdfName = null;       // PDF file name for MCQ

    // DOM Elements
    this.elements = {
      sidebar: document.getElementById('sidebar'),
      menuToggle: document.getElementById('menuToggle'),
      newChatBtn: document.getElementById('newChatBtn'),
      searchInput: document.getElementById('searchInput'),
      chatList: document.getElementById('chatList'),
      themeToggle: document.getElementById('themeToggle'),
      exportBtn: document.getElementById('exportBtn'),
      clearAllBtn: document.getElementById('clearAllBtn'),
      topBarTitle: document.getElementById('topBarTitle'),
      chatArea: document.getElementById('chatArea'),
      welcomeScreen: document.getElementById('welcomeScreen'),
      messagesContainer: document.getElementById('messagesContainer'),
      scrollBottomBtn: document.getElementById('scrollBottomBtn'),
      messageInput: document.getElementById('messageInput'),
      sendBtn: document.getElementById('sendBtn'),
      stopBtn: document.getElementById('stopBtn'),
      voiceBtn: document.getElementById('voiceBtn'),
      toastContainer: document.getElementById('toastContainer'),
      confirmModal: document.getElementById('confirmModal'),
      confirmTitle: document.getElementById('confirmTitle'),
      confirmMessage: document.getElementById('confirmMessage'),
      confirmCancel: document.getElementById('confirmCancel'),
      confirmOk: document.getElementById('confirmOk'),
      particles: document.getElementById('particles'),
      // Study Plan
      studyPlanBtn: document.getElementById('studyPlanBtn'),
      studyPlanModal: document.getElementById('studyPlanModal'),
      studyPlanForm: document.getElementById('studyPlanForm'),
      spClose: document.getElementById('spClose'),
      spExamDate: document.getElementById('spExamDate'),
      spHours: document.getElementById('spHours'),
      spSubjects: document.getElementById('spSubjects'),
      spWeak: document.getElementById('spWeak'),
      spGoal: document.getElementById('spGoal'),
      spLevel: document.getElementById('spLevel'),
      spSubmit: document.getElementById('spSubmit'),
      // MCQ
      mcqBtn: document.getElementById('mcqBtn'),
      mcqModal: document.getElementById('mcqModal'),
      mcqForm: document.getElementById('mcqForm'),
      mcqClose: document.getElementById('mcqClose'),
      mcqTopic: document.getElementById('mcqTopic'),
      mcqCount: document.getElementById('mcqCount'),
      mcqDifficulty: document.getElementById('mcqDifficulty'),
      mcqContext: document.getElementById('mcqContext'),
      // PDF Chat
      pdfFileInput: document.getElementById('pdfFileInput'),
      pdfAttachBtn: document.getElementById('pdfAttachBtn'),
      pdfAttachmentBar: document.getElementById('pdfAttachmentBar'),
      pdfFileName: document.getElementById('pdfFileName'),
      pdfPageCount: document.getElementById('pdfPageCount'),
      pdfRemoveBtn: document.getElementById('pdfRemoveBtn'),
      // MCQ PDF
      mcqPdfDrop: document.getElementById('mcqPdfDrop'),
      mcqPdfInput: document.getElementById('mcqPdfInput'),
      mcqPdfDropContent: document.getElementById('mcqPdfDropContent'),
      mcqPdfAttached: document.getElementById('mcqPdfAttached'),
      mcqPdfName: document.getElementById('mcqPdfName'),
      mcqPdfRemove: document.getElementById('mcqPdfRemove'),
    };

    // Initialize
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupMarkdown();
    this.setupParticles();
    this.loadTheme();
    this.loadSessions();
    this.setupVoiceRecognition();
    this.setupKeyboardShortcuts();
    this.autoResizeTextarea();
  }

  /* ── Event Listeners ── */
  setupEventListeners() {
    // Sidebar
    this.elements.menuToggle.addEventListener('click', () => this.toggleSidebar());
    this.elements.newChatBtn.addEventListener('click', () => this.newChat());
    this.elements.searchInput.addEventListener('input', (e) => this.filterChats(e.target.value));
    
    // Theme
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    
    // Export
    this.elements.exportBtn.addEventListener('click', () => this.exportChat());
    
    // Clear all
    this.elements.clearAllBtn.addEventListener('click', () => {
      this.showConfirm('Clear All Conversations', 'This will permanently delete all conversations. This action cannot be undone.', () => {
        this.clearAllSessions();
      });
    });

    // Send message
    this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
    this.elements.stopBtn.addEventListener('click', () => this.stopGeneration());

    // Input
    this.elements.messageInput.addEventListener('input', () => {
      this.autoResizeTextarea();
      this.updateSendButton();
    });

    this.elements.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Scroll
    this.elements.chatArea.addEventListener('scroll', () => {
      this.updateScrollButton();
    });

    this.elements.scrollBottomBtn.addEventListener('click', () => {
      this.scrollToBottom();
    });

    // Suggestion cards
    document.querySelectorAll('.suggestion-card').forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.dataset.prompt;
        this.elements.messageInput.value = prompt;
        this.autoResizeTextarea();
        this.updateSendButton();
        this.sendMessage();
      });
    });

    // Voice
    this.elements.voiceBtn.addEventListener('click', () => this.toggleVoice());

    // Modal
    this.elements.confirmCancel.addEventListener('click', () => this.hideConfirm());

    // Study Plan
    this.elements.studyPlanBtn.addEventListener('click', () => this.openStudyPlan());
    this.elements.spClose.addEventListener('click', () => this.closeStudyPlan());
    this.elements.studyPlanModal.addEventListener('click', (e) => {
      if (e.target === this.elements.studyPlanModal) this.closeStudyPlan();
    });
    this.elements.studyPlanForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.generateStudyPlan();
    });
    // Level pills
    this.elements.spLevel.querySelectorAll('.sp-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.elements.spLevel.querySelectorAll('.sp-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      });
    });
    // Set min date to today
    this.elements.spExamDate.min = new Date().toISOString().split('T')[0];

    // MCQ Generator
    this.elements.mcqBtn.addEventListener('click', () => this.openMCQ());
    this.elements.mcqClose.addEventListener('click', () => this.closeMCQ());
    this.elements.mcqModal.addEventListener('click', (e) => {
      if (e.target === this.elements.mcqModal) this.closeMCQ();
    });
    this.elements.mcqForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.generateMCQ();
    });
    this.elements.mcqDifficulty.querySelectorAll('.sp-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.elements.mcqDifficulty.querySelectorAll('.sp-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      });
    });

    // PDF attach (chat)
    this.elements.pdfAttachBtn.addEventListener('click', () => this.elements.pdfFileInput.click());
    this.elements.pdfFileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) this.handleChatPdfUpload(e.target.files[0]);
    });
    this.elements.pdfRemoveBtn.addEventListener('click', () => this.removeChatPdf());

    // MCQ PDF
    this.elements.mcqPdfDrop.addEventListener('click', () => this.elements.mcqPdfInput.click());
    this.elements.mcqPdfInput.addEventListener('change', (e) => {
      if (e.target.files[0]) this.handleMcqPdfUpload(e.target.files[0]);
    });
    this.elements.mcqPdfRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeMcqPdf();
    });
    // Drag & drop for MCQ PDF
    this.elements.mcqPdfDrop.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.mcqPdfDrop.classList.add('dragover');
    });
    this.elements.mcqPdfDrop.addEventListener('dragleave', () => {
      this.elements.mcqPdfDrop.classList.remove('dragover');
    });
    this.elements.mcqPdfDrop.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.mcqPdfDrop.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') this.handleMcqPdfUpload(file);
      else this.showToast('Only PDF files are supported', 'error');
    });

    // Responsive sidebar
    if (window.innerWidth <= 768) {
      this.elements.sidebar.classList.add('collapsed');
    }
  }

  /* ── Keyboard Shortcuts ── */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        this.toggleSidebar();
      }
      // Ctrl/Cmd + Shift + N: New chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        this.newChat();
      }
      // Escape: Stop generation or close modal
      if (e.key === 'Escape') {
        if (this.isGenerating) this.stopGeneration();
        this.hideConfirm();
      }
      // Focus input with /
      if (e.key === '/' && document.activeElement !== this.elements.messageInput) {
        e.preventDefault();
        this.elements.messageInput.focus();
      }
    });
  }

  /* ── Markdown Setup ── */
  setupMarkdown() {
    const renderer = new marked.Renderer();

    // Custom code block rendering
    renderer.code = function(obj) {
      const text = typeof obj === 'string' ? obj : (obj.text || '');
      const lang = typeof obj === 'string' ? '' : (obj.lang || '');
      const langLabel = lang || 'code';
      let highlighted;
      try {
        if (lang && hljs.getLanguage(lang)) {
          highlighted = hljs.highlight(text, { language: lang }).value;
        } else {
          highlighted = hljs.highlightAuto(text).value;
        }
      } catch {
        highlighted = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      return `<div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang">${langLabel}</span>
          <button class="code-copy-btn" onclick="window.synapseAI.copyCode(this)" data-code="${encodeURIComponent(text)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
        <pre><code class="hljs ${lang ? `language-${lang}` : ''}">${highlighted}</code></pre>
      </div>`;
    };

    marked.setOptions({
      renderer,
      gfm: true,
      breaks: true,
    });
  }

  /* ── Particles ── */
  setupParticles() {
    const container = this.elements.particles;
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = (100 + Math.random() * 20) + '%';
      particle.style.animationDelay = Math.random() * 8 + 's';
      particle.style.animationDuration = (6 + Math.random() * 6) + 's';
      particle.style.width = (2 + Math.random() * 3) + 'px';
      particle.style.height = particle.style.width;
      const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#a78bfa'];
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      container.appendChild(particle);
    }
  }

  /* ── Theme ── */
  loadTheme() {
    const saved = localStorage.getItem('synapse-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateCodeTheme(saved);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('synapse-theme', next);
    this.updateCodeTheme(next);
    this.showToast(`Switched to ${next} mode`, 'info');
  }

  updateCodeTheme(theme) {
    const link = document.getElementById('hljs-theme');
    link.href = theme === 'dark'
      ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
      : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
  }

  /* ── Sidebar ── */
  toggleSidebar() {
    this.elements.sidebar.classList.toggle('collapsed');
  }

  /* ── Sessions Management ── */
  loadSessions() {
    try {
      const saved = localStorage.getItem('synapse-sessions');
      if (saved) {
        const data = JSON.parse(saved);
        data.forEach(s => this.sessions.set(s.sessionId, s));
      }
    } catch {
      // ignore
    }
    this.renderChatList();
  }

  saveSessions() {
    const data = Array.from(this.sessions.values());
    localStorage.setItem('synapse-sessions', JSON.stringify(data));
  }

  newChat() {
    this.currentSessionId = null;
    this.elements.welcomeScreen.classList.remove('hidden');
    this.elements.messagesContainer.classList.remove('active');
    this.elements.messagesContainer.innerHTML = '';
    this.elements.topBarTitle.querySelector('span').textContent = 'New Conversation';
    this.elements.messageInput.value = '';
    this.autoResizeTextarea();
    this.updateSendButton();
    this.elements.messageInput.focus();
    this.renderChatList();
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      this.elements.sidebar.classList.add('collapsed');
    }
  }

  async loadSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.currentSessionId = sessionId;
    this.elements.welcomeScreen.classList.add('hidden');
    this.elements.messagesContainer.classList.add('active');
    this.elements.messagesContainer.innerHTML = '';
    this.elements.topBarTitle.querySelector('span').textContent = session.title || 'Conversation';

    // Render messages
    if (session.messages) {
      session.messages.forEach(msg => {
        this.appendMessage(msg.role, msg.content, false);
      });
    }

    this.scrollToBottom();
    this.renderChatList();

    if (window.innerWidth <= 768) {
      this.elements.sidebar.classList.add('collapsed');
    }
  }

  clearAllSessions() {
    this.sessions.clear();
    this.saveSessions();
    this.newChat();
    this.showToast('All conversations cleared', 'success');

    // Also clear server sessions
    fetch('/api/sessions').then(r => r.json()).then(sessions => {
      sessions.forEach(s => fetch(`/api/sessions/${s.sessionId}`, { method: 'DELETE' }));
    }).catch(() => {});
  }

  filterChats(query) {
    const items = this.elements.chatList.querySelectorAll('.chat-list-item');
    const q = query.toLowerCase();
    items.forEach(item => {
      const title = item.querySelector('.chat-title')?.textContent?.toLowerCase() || '';
      item.style.display = title.includes(q) ? '' : 'none';
    });
  }

  renderChatList() {
    const container = this.elements.chatList;
    container.innerHTML = '';

    if (this.sessions.size === 0) {
      container.innerHTML = `
        <div class="chat-list-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>No conversations yet</span>
          <span style="font-size: 0.75rem; color: var(--text-muted)">Start a new chat to begin</span>
        </div>`;
      return;
    }

    const sorted = Array.from(this.sessions.entries())
      .sort((a, b) => new Date(b[1].lastMessage || 0) - new Date(a[1].lastMessage || 0));

    sorted.forEach(([id, session]) => {
      const item = document.createElement('div');
      item.className = 'chat-list-item' + (id === this.currentSessionId ? ' active' : '');
      
      const lastMsg = session.messages?.length 
        ? session.messages[session.messages.length - 1].content.substring(0, 60)
        : 'Empty conversation';

      item.innerHTML = `
        <div class="chat-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <div class="chat-info">
          <div class="chat-title">${this.escapeHtml(session.title || 'Untitled')}</div>
          <div class="chat-preview">${this.escapeHtml(lastMsg)}</div>
        </div>
        <button class="chat-delete" title="Delete conversation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>`;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.chat-delete')) return;
        this.loadSession(id);
      });

      item.querySelector('.chat-delete').addEventListener('click', () => {
        this.showConfirm('Delete Conversation', 'Are you sure you want to delete this conversation?', () => {
          this.sessions.delete(id);
          this.saveSessions();
          fetch(`/api/sessions/${id}`, { method: 'DELETE' }).catch(() => {});
          if (this.currentSessionId === id) this.newChat();
          else this.renderChatList();
          this.showToast('Conversation deleted', 'success');
        });
      });

      container.appendChild(item);
    });
  }

  /* ── Chat Logic ── */
  async sendMessage() {
    const message = this.elements.messageInput.value.trim();
    if (!message || this.isGenerating) return;

    // Hide welcome, show messages
    this.elements.welcomeScreen.classList.add('hidden');
    this.elements.messagesContainer.classList.add('active');

    // Generate session ID if needed
    if (!this.currentSessionId) {
      this.currentSessionId = this.generateId();
    }

    // Clear input
    this.elements.messageInput.value = '';
    this.autoResizeTextarea();
    this.updateSendButton();

    // Build actual message (with PDF context if attached)
    let actualMessage = message;
    let displayMessage = message;
    if (this.attachedPdfText) {
      displayMessage = `${message}\n📎 ${this.attachedPdfName}`;
      actualMessage = `[The user has attached a PDF document named "${this.attachedPdfName}". Here is the extracted text from the PDF:\n\n---BEGIN PDF CONTENT---\n${this.attachedPdfText.substring(0, 30000)}\n---END PDF CONTENT---\n\nNow, based on the above PDF content, answer the user's question:]\n\n${message}`;
      this.removeChatPdf();
    }

    // Append user message
    this.appendMessage('user', displayMessage);
    this.saveMessageToSession('user', displayMessage);

    // Show typing indicator
    const typingEl = this.showTypingIndicator();

    // Toggle buttons
    this.isGenerating = true;
    this.elements.sendBtn.classList.add('hidden');
    this.elements.stopBtn.classList.remove('hidden');

    try {
      this.abortController = new AbortController();

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: actualMessage, 
          sessionId: this.currentSessionId 
        }),
        signal: this.abortController.signal,
      });

      // Remove typing indicator
      typingEl.remove();

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.details || err.error || 'Failed to get response');
      }

      // Create AI message element for streaming
      const aiMsgEl = this.createMessageElement('assistant', '');
      this.elements.messagesContainer.appendChild(aiMsgEl);
      const contentEl = aiMsgEl.querySelector('.message-content');
      
      // Add streaming cursor
      contentEl.innerHTML = '<span class="streaming-cursor"></span>';

      // ── Typewriter queue: buffer incoming chunks, reveal gradually ──
      let fullResponse = '';
      let displayedLength = 0;
      let typewriterRunning = false;
      let streamDone = false;
      const CHARS_PER_TICK = 3;      // characters revealed per frame
      const TICK_INTERVAL = 18;      // ms between reveals

      const revealNext = () => {
        if (displayedLength >= fullResponse.length) {
          typewriterRunning = false;
          if (streamDone) {
            // Final render with full markdown
            contentEl.innerHTML = this.renderMarkdown(fullResponse);
            this.saveMessageToSession('assistant', fullResponse);
          }
          return;
        }
        typewriterRunning = true;
        displayedLength = Math.min(displayedLength + CHARS_PER_TICK, fullResponse.length);
        const visibleText = fullResponse.slice(0, displayedLength);
        contentEl.innerHTML = this.renderMarkdown(visibleText) + '<span class="streaming-cursor"></span>';
        this.scrollToBottom();
        setTimeout(revealNext, TICK_INTERVAL);
      };

      const pushChunk = (text) => {
        fullResponse += text;
        if (!typewriterRunning) revealNext();
      };

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'session') {
                if (data.title) {
                  this.updateSessionTitle(data.title);
                }
              } else if (data.type === 'chunk') {
                pushChunk(data.content);
              } else if (data.type === 'done') {
                streamDone = true;
                if (!typewriterRunning) {
                  contentEl.innerHTML = this.renderMarkdown(fullResponse);
                  this.saveMessageToSession('assistant', fullResponse);
                }
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (parseErr) {
              if (parseErr.message !== 'Unexpected end of JSON input') {
                console.warn('Parse error:', parseErr);
              }
            }
          }
        }
      }

      // Wait for typewriter to finish after stream ends
      streamDone = true;
      if (typewriterRunning) {
        await new Promise(resolve => {
          const check = () => {
            if (!typewriterRunning) return resolve();
            setTimeout(check, 50);
          };
          check();
        });
      }
      // Ensure final render
      if (fullResponse) {
        contentEl.innerHTML = this.renderMarkdown(fullResponse);
      }

    } catch (error) {
      typingEl?.remove();
      if (error.name === 'AbortError') {
        this.showToast('Generation stopped', 'info');
      } else {
        console.error('Error:', error);
        this.appendMessage('assistant', `**Error:** ${error.message}\n\nPlease try again.`);
        this.showToast('Failed to get response', 'error');
      }
    } finally {
      this.isGenerating = false;
      this.abortController = null;
      this.elements.sendBtn.classList.remove('hidden');
      this.elements.stopBtn.classList.add('hidden');
      this.scrollToBottom();
    }
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /* ── Message Rendering ── */
  appendMessage(role, content, animate = true) {
    const el = this.createMessageElement(role, content, animate);
    this.elements.messagesContainer.appendChild(el);
    this.scrollToBottom();
  }

  createMessageElement(role, content, animate = true) {
    const div = document.createElement('div');
    div.className = `message message-${role}`;
    if (!animate) div.style.animation = 'none';

    const isUser = role === 'user';
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isUser) {
      div.innerHTML = `
        <div class="user-bubble">${this.escapeHtml(content)}</div>
        <span class="user-time">${timeStr}</span>`;
    } else {
      div.innerHTML = `
        <div class="message-header">
          <div class="message-avatar message-avatar-ai">
            <div class="ai-avatar-anim"><svg class="ai-orb" viewBox="0 0 36 36"><circle cx="18" cy="18" r="6" fill="url(#aiOrbGrad)" class="ai-orb-core"/><circle cx="18" cy="18" r="11" fill="none" stroke="url(#aiOrbGrad)" stroke-width="1.2" class="ai-orb-ring1" opacity="0.5"/><circle cx="18" cy="18" r="16" fill="none" stroke="url(#aiOrbGrad)" stroke-width="0.8" class="ai-orb-ring2" opacity="0.25"/><defs><linearGradient id="aiOrbGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#c084fc"/></linearGradient></defs></svg></div>
          </div>
          <span class="message-name">SynapseAI</span>
          <span class="message-time">${timeStr}</span>
        </div>
        <div class="message-content">${this.renderMarkdown(content)}</div>
        <div class="message-actions">
          <button class="msg-action-btn" onclick="window.synapseAI.copyMessage(this, ${JSON.stringify(content).replace(/"/g, '&quot;')})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>`;
    }

    return div;
  }

  showTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message message-assistant';
    div.id = 'typing-indicator';
    div.innerHTML = `
      <div class="message-header">
        <div class="message-avatar message-avatar-ai">
          <div class="ai-avatar-anim"><svg class="ai-orb" viewBox="0 0 36 36"><circle cx="18" cy="18" r="6" fill="url(#aiOrbGrad)" class="ai-orb-core"/><circle cx="18" cy="18" r="11" fill="none" stroke="url(#aiOrbGrad)" stroke-width="1.2" class="ai-orb-ring1" opacity="0.5"/><circle cx="18" cy="18" r="16" fill="none" stroke="url(#aiOrbGrad)" stroke-width="0.8" class="ai-orb-ring2" opacity="0.25"/><defs><linearGradient id="aiOrbGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#c084fc"/></linearGradient></defs></svg></div>
        </div>
        <span class="message-name">SynapseAI</span>
      </div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>`;
    this.elements.messagesContainer.appendChild(div);
    this.scrollToBottom();
    return div;
  }

  /* ── Session Data ── */
  saveMessageToSession(role, content) {
    if (!this.currentSessionId) return;

    let session = this.sessions.get(this.currentSessionId);
    if (!session) {
      session = {
        sessionId: this.currentSessionId,
        title: null,
        messages: [],
        createdAt: new Date().toISOString(),
        lastMessage: new Date().toISOString(),
      };
      this.sessions.set(this.currentSessionId, session);
    }

    session.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
    session.lastMessage = new Date().toISOString();

    this.saveSessions();
    this.renderChatList();
  }

  updateSessionTitle(title) {
    if (!this.currentSessionId) return;
    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.title = title;
      this.saveSessions();
      this.renderChatList();
    }
    this.elements.topBarTitle.querySelector('span').textContent = title;
  }

  /* ── Markdown Rendering ── */
  renderMarkdown(text) {
    try {
      const html = marked.parse(text);
      return DOMPurify.sanitize(html, {
        ADD_TAGS: ['svg', 'path', 'line', 'rect', 'circle', 'polyline', 'polygon'],
        ADD_ATTR: ['viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points', 'onclick', 'data-code', 'class'],
      });
    } catch {
      return text;
    }
  }

  /* ── Utilities ── */
  copyCode(btn) {
    const code = decodeURIComponent(btn.dataset.code);
    navigator.clipboard.writeText(code).then(() => {
      btn.classList.add('copied');
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Copied!`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>Copy`;
      }, 2000);
    });
  }

  copyMessage(btn, content) {
    navigator.clipboard.writeText(content).then(() => {
      btn.classList.add('copied');
      const origHTML = btn.innerHTML;
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Copied!`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = origHTML;
      }, 2000);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  generateId() {
    return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  }

  /* ── Voice Input ── */
  setupVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        this.elements.messageInput.value = transcript;
        this.autoResizeTextarea();
        this.updateSendButton();
      };

      this.recognition.onerror = () => {
        this.stopVoice();
        this.showToast('Voice recognition error', 'error');
      };

      this.recognition.onend = () => {
        this.stopVoice();
      };
    } else {
      this.elements.voiceBtn.style.display = 'none';
    }
  }

  toggleVoice() {
    if (this.isRecording) {
      this.stopVoice();
    } else {
      this.startVoice();
    }
  }

  startVoice() {
    if (!this.recognition) return;
    try {
      this.recognition.start();
      this.isRecording = true;
      this.elements.voiceBtn.classList.add('recording');
      this.showToast('Listening...', 'info');
    } catch {
      this.showToast('Unable to start voice input', 'error');
    }
  }

  stopVoice() {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {}
    this.isRecording = false;
    this.elements.voiceBtn.classList.remove('recording');
  }

  /* ── UI Helpers ── */
  autoResizeTextarea() {
    const ta = this.elements.messageInput;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--input-max-height'))) + 'px';
  }

  updateSendButton() {
    const hasText = this.elements.messageInput.value.trim().length > 0;
    this.elements.sendBtn.disabled = !hasText;
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.elements.chatArea.scrollTop = this.elements.chatArea.scrollHeight;
    });
  }

  updateScrollButton() {
    const area = this.elements.chatArea;
    const isNearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
    this.elements.scrollBottomBtn.classList.toggle('visible', !isNearBottom);
  }

  /* ── Export ── */
  exportChat() {
    if (!this.currentSessionId) {
      this.showToast('No conversation to export', 'info');
      return;
    }

    const session = this.sessions.get(this.currentSessionId);
    if (!session || !session.messages?.length) {
      this.showToast('No messages to export', 'info');
      return;
    }

    let markdown = `# ${session.title || 'SynapseAI Conversation'}\n`;
    markdown += `*Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*\n\n---\n\n`;

    session.messages.forEach(msg => {
      const name = msg.role === 'user' ? '**You**' : '**SynapseAI**';
      markdown += `### ${name}\n\n${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(session.title || 'SynapseAI-Chat').replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Conversation exported', 'success');
  }

  /* ── Toast ── */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${type === 'success' ? '<polyline points="20 6 9 17 4 12"></polyline>' :
          type === 'error' ? '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>' :
          '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'}
      </svg>
      <span>${message}</span>`;
    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /* ── Confirm Dialog ── */
  showConfirm(title, message, onConfirm) {
    this.elements.confirmTitle.textContent = title;
    this.elements.confirmMessage.textContent = message;
    this.elements.confirmModal.classList.remove('hidden');
    
    this.elements.confirmOk.onclick = () => {
      this.hideConfirm();
      onConfirm();
    };
  }

  hideConfirm() {
    this.elements.confirmModal.classList.add('hidden');
  }

  /* ── PDF Upload (Chat) ── */
  async handleChatPdfUpload(file) {
    this.showToast('Processing PDF...', 'info');
    this.elements.pdfAttachBtn.classList.add('uploading');
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      this.attachedPdfText = data.text;
      this.attachedPdfName = data.fileName;
      this.elements.pdfFileName.textContent = data.fileName;
      this.elements.pdfPageCount.textContent = `${data.pages} page${data.pages > 1 ? 's' : ''}`;
      this.elements.pdfAttachmentBar.style.display = 'flex';
      this.elements.pdfAttachBtn.classList.add('has-file');
      this.showToast(`PDF loaded: ${data.fileName}`, 'success');
    } catch (err) {
      this.showToast(err.message || 'Failed to process PDF', 'error');
    } finally {
      this.elements.pdfAttachBtn.classList.remove('uploading');
      this.elements.pdfFileInput.value = '';
    }
  }

  removeChatPdf() {
    this.attachedPdfText = null;
    this.attachedPdfName = null;
    this.elements.pdfAttachmentBar.style.display = 'none';
    this.elements.pdfAttachBtn.classList.remove('has-file');
    this.elements.pdfFileInput.value = '';
  }

  async handleMcqPdfUpload(file) {
    this.elements.mcqPdfDrop.classList.add('uploading');
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      this.mcqPdfText = data.text;
      this.mcqPdfName = data.fileName;
      this.elements.mcqPdfDropContent.classList.add('hidden');
      this.elements.mcqPdfAttached.classList.remove('hidden');
      this.elements.mcqPdfName.textContent = data.fileName;
      this.showToast(`PDF loaded for quiz: ${data.fileName}`, 'success');
    } catch (err) {
      this.showToast(err.message || 'Failed to process PDF', 'error');
    } finally {
      this.elements.mcqPdfDrop.classList.remove('uploading');
      this.elements.mcqPdfInput.value = '';
    }
  }

  removeMcqPdf() {
    this.mcqPdfText = null;
    this.mcqPdfName = null;
    this.elements.mcqPdfDropContent.classList.remove('hidden');
    this.elements.mcqPdfAttached.classList.add('hidden');
    this.elements.mcqPdfInput.value = '';
  }

  /* ── Study Plan ── */
  openStudyPlan() {
    this.elements.studyPlanModal.classList.remove('hidden');
    // Default exam date to 30 days from now
    if (!this.elements.spExamDate.value) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      this.elements.spExamDate.value = d.toISOString().split('T')[0];
    }
  }

  closeStudyPlan() {
    this.elements.studyPlanModal.classList.add('hidden');
  }

  async generateStudyPlan() {
    const examDate = this.elements.spExamDate.value;
    const hours = this.elements.spHours.value;
    const subjects = this.elements.spSubjects.value.trim();
    const weakTopics = this.elements.spWeak.value.trim();
    const goal = this.elements.spGoal.value.trim();
    const level = this.elements.spLevel.querySelector('.sp-pill.active')?.dataset.val || 'Intermediate';

    if (!examDate || !subjects) {
      this.showToast('Please fill in exam date and subjects', 'error');
      return;
    }

    const today = new Date();
    const exam = new Date(examDate);
    const daysLeft = Math.max(1, Math.ceil((exam - today) / (1000 * 60 * 60 * 24)));
    const weeksCount = Math.min(Math.ceil(daysLeft / 7), 8);

    // Build the JSON-structured prompt
    const prompt = `I need a structured study plan. Return ONLY a valid JSON object, no markdown, no code fences, no extra text.

Details:
- Exam/Goal: ${goal || 'Upcoming exam'}
- Exam Date: ${examDate} (${daysLeft} days away)
- Subjects: ${subjects}
- Weak Topics: ${weakTopics || 'None specified'}
- Hours Per Day: ${hours}
- Level: ${level}

Return this exact JSON structure:
{
  "title": "Study Plan title",
  "examDate": "${examDate}",
  "daysLeft": ${daysLeft},
  "hoursPerDay": ${hours},
  "dailySchedule": [
    {"time": "9:00 - 10:30", "subject": "Mathematics", "topic": "Calculus - Limits", "type": "study"},
    {"time": "10:30 - 10:45", "subject": "Break", "topic": "", "type": "break"},
    ...more slots to fill ${hours} hours
  ],
  "weeklyPlan": [
    {
      "week": 1,
      "phase": "Foundation Building",
      "days": [
        {"day": "Mon", "subjects": [{"name": "Math", "topic": "Algebra basics", "hours": 2}, {"name": "Physics", "topic": "Mechanics intro", "hours": 2}]},
        {"day": "Tue", "subjects": [...]},
        {"day": "Wed", "subjects": [...]},
        {"day": "Thu", "subjects": [...]},
        {"day": "Fri", "subjects": [...]},
        {"day": "Sat", "subjects": [...]},
        {"day": "Sun", "subjects": [{"name": "Revision", "topic": "Week review", "hours": ${hours}}]}
      ]
    }
    ...for ${weeksCount} weeks
  ],
  "subjectBreakdown": [
    {"subject": "Mathematics", "totalHours": 40, "topics": ["Calculus", "Algebra", "Statistics"], "priority": "high"},
    ...
  ],
  "tips": ["tip 1", "tip 2", "tip 3"]
}

Rules:
- dailySchedule should have realistic time slots filling ${hours} hours with short breaks
- weeklyPlan should cover ${weeksCount} weeks. Each week has 7 days (Mon-Sun). Sunday is always revision.
- Prioritize weak topics (${weakTopics || 'none'}) with more hours
- "type" in dailySchedule can be "study", "break", "revision", or "practice"
- subjectBreakdown: set priority to "high" for weak-topic subjects
- Return ONLY the JSON, nothing else`;

    this.closeStudyPlan();
    this.newChat();
    this.elements.welcomeScreen.classList.add('hidden');
    this.elements.messagesContainer.classList.add('active');
    this.currentSessionId = this.generateId();

    const userDisplay = `Generate a study plan for ${goal || 'my exam'} on ${examDate} — ${subjects}`;
    this.appendMessage('user', userDisplay);

    const typingEl = this.showTypingIndicator();
    this.isGenerating = true;
    this.elements.sendBtn.classList.add('hidden');
    this.elements.stopBtn.classList.remove('hidden');

    try {
      this.abortController = new AbortController();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, sessionId: this.currentSessionId }),
        signal: this.abortController.signal,
      });

      typingEl.remove();

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.details || err.error || 'Failed to get response');
      }

      const data = await response.json();
      let raw = data.response;

      // Strip code fences
      raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      let plan;
      try {
        plan = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) plan = JSON.parse(m[0]);
        else throw new Error('AI did not return valid timetable data. Please try again.');
      }

      this.saveMessageToSession('user', prompt);
      this.saveMessageToSession('assistant', JSON.stringify(plan));
      this.updateSessionTitle(`Study Plan: ${goal || subjects.split(',')[0].trim()}`);

      // Render visual timetable
      this.renderTimetable(plan);

    } catch (error) {
      typingEl?.remove();
      if (error.name === 'AbortError') {
        this.showToast('Generation stopped', 'info');
      } else {
        this.appendMessage('assistant', `**Error:** ${error.message}\n\nPlease try again.`);
        this.showToast('Failed to generate study plan', 'error');
      }
    } finally {
      this.isGenerating = false;
      this.abortController = null;
      this.elements.sendBtn.classList.remove('hidden');
      this.elements.stopBtn.classList.add('hidden');
      this.scrollToBottom();
    }
  }

  /* ── Visual Timetable Renderer ── */
  renderTimetable(plan) {
    const container = document.createElement('div');
    container.className = 'message message-assistant timetable-container';

    // Color palette for subjects
    const subjectColors = {};
    const palette = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#3b82f6'];
    let colorIdx = 0;
    const getColor = (subj) => {
      const key = subj.toLowerCase().trim();
      if (key === 'break' || key === 'revision') return key === 'break' ? '#64748b' : '#8b5cf6';
      if (!subjectColors[key]) { subjectColors[key] = palette[colorIdx % palette.length]; colorIdx++; }
      return subjectColors[key];
    };

    // Header
    let html = `
      <div class="tt-header">
        <div class="tt-header-left">
          <div class="tt-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div>
            <div class="tt-title">${this.escapeHtml(plan.title || 'Your Study Plan')}</div>
            <div class="tt-meta">${plan.daysLeft} days left · ${plan.hoursPerDay}h/day · ${plan.weeklyPlan?.length || 0} weeks</div>
          </div>
        </div>
        <div class="tt-countdown">
          <span class="tt-countdown-num">${plan.daysLeft}</span>
          <span class="tt-countdown-label">days to exam</span>
        </div>
      </div>`;

    // Subject legend
    if (plan.subjectBreakdown?.length) {
      html += `<div class="tt-legend">`;
      plan.subjectBreakdown.forEach(s => {
        const color = getColor(s.subject);
        html += `<div class="tt-legend-item${s.priority === 'high' ? ' tt-priority-high' : ''}">
          <span class="tt-legend-dot" style="background:${color}"></span>
          <span class="tt-legend-name">${this.escapeHtml(s.subject)}</span>
          <span class="tt-legend-hours">${s.totalHours}h</span>
          ${s.priority === 'high' ? '<span class="tt-priority-badge">Priority</span>' : ''}
        </div>`;
      });
      html += `</div>`;
    }

    // Daily Schedule (the model day timetable)
    if (plan.dailySchedule?.length) {
      html += `<div class="tt-section">
        <div class="tt-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Daily Schedule
        </div>
        <div class="tt-daily-grid">`;

      plan.dailySchedule.forEach(slot => {
        const color = getColor(slot.subject);
        const isBreak = slot.type === 'break';
        html += `<div class="tt-daily-slot${isBreak ? ' tt-slot-break' : ''}" style="--slot-color:${color}">
          <div class="tt-slot-time">${this.escapeHtml(slot.time)}</div>
          <div class="tt-slot-info">
            <div class="tt-slot-subject">${this.escapeHtml(slot.subject)}</div>
            ${slot.topic ? `<div class="tt-slot-topic">${this.escapeHtml(slot.topic)}</div>` : ''}
          </div>
          <div class="tt-slot-type tt-type-${slot.type}">${slot.type}</div>
        </div>`;
      });

      html += `</div></div>`;
    }

    // Weekly Plan grid
    if (plan.weeklyPlan?.length) {
      html += `<div class="tt-section">
        <div class="tt-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          Weekly Plan
        </div>`;

      plan.weeklyPlan.forEach(week => {
        html += `<div class="tt-week">
          <div class="tt-week-header">
            <span class="tt-week-num">Week ${week.week}</span>
            <span class="tt-week-phase">${this.escapeHtml(week.phase)}</span>
          </div>
          <div class="tt-week-grid">
            <div class="tt-week-row tt-week-row-header">
              ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="tt-week-cell-header">${d}</div>`).join('')}
            </div>
            <div class="tt-week-row tt-week-row-body">`;

        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        dayNames.forEach(dayName => {
          const dayData = week.days?.find(d => d.day === dayName);
          if (dayData && dayData.subjects?.length) {
            html += `<div class="tt-week-cell">`;
            dayData.subjects.forEach(s => {
              const color = getColor(s.name);
              html += `<div class="tt-cell-block" style="--block-color:${color}" title="${this.escapeHtml(s.topic)} (${s.hours}h)">
                <span class="tt-cell-subj">${this.escapeHtml(s.name)}</span>
                <span class="tt-cell-topic">${this.escapeHtml(s.topic)}</span>
                <span class="tt-cell-hours">${s.hours}h</span>
              </div>`;
            });
            html += `</div>`;
          } else {
            html += `<div class="tt-week-cell tt-cell-empty">—</div>`;
          }
        });

        html += `</div></div></div>`;
      });

      html += `</div>`;
    }

    // Tips
    if (plan.tips?.length) {
      html += `<div class="tt-section tt-tips">
        <div class="tt-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          Study Tips
        </div>
        <div class="tt-tips-list">`;
      plan.tips.forEach((tip, i) => {
        html += `<div class="tt-tip"><span class="tt-tip-num">${i + 1}</span><span>${this.escapeHtml(tip)}</span></div>`;
      });
      html += `</div></div>`;
    }

    container.innerHTML = html;
    this.elements.messagesContainer.appendChild(container);
    this.scrollToBottom();
  }

  /* ── MCQ Generator ── */
  openMCQ() {
    this.elements.mcqModal.classList.remove('hidden');
  }

  closeMCQ() {
    this.elements.mcqModal.classList.add('hidden');
  }

  async generateMCQ() {
    const topic = this.elements.mcqTopic.value.trim();
    const count = parseInt(this.elements.mcqCount.value) || 5;
    const difficulty = this.elements.mcqDifficulty.querySelector('.sp-pill.active')?.dataset.val || 'Medium';
    const context = this.elements.mcqContext.value.trim();

    if (!topic) {
      this.showToast('Please enter a topic', 'error');
      return;
    }

    this.closeMCQ();

    // New chat for quiz
    this.newChat();
    this.elements.welcomeScreen.classList.add('hidden');
    this.elements.messagesContainer.classList.add('active');
    this.currentSessionId = this.generateId();

    // User message
    this.appendMessage('user', `Generate ${count} ${difficulty} MCQs on: ${topic}`);

    // Typing indicator
    const typingEl = this.showTypingIndicator();
    this.isGenerating = true;
    this.elements.sendBtn.classList.add('hidden');
    this.elements.stopBtn.classList.remove('hidden');

    const prompt = `Generate exactly ${count} multiple choice questions about "${topic}".
Difficulty: ${difficulty}
${context ? `Additional context: ${context}` : ''}
${this.mcqPdfText ? `\nThe following is the content of an attached PDF document named "${this.mcqPdfName}". Use this content as the primary source for generating questions:\n\n---BEGIN PDF CONTENT---\n${this.mcqPdfText.substring(0, 30000)}\n---END PDF CONTENT---` : ''}

You MUST respond ONLY with a valid JSON array. No markdown, no code fences, no extra text.
Each element must have this exact structure:
{"q":"question text","options":["A) ...","B) ...","C) ...","D) ..."],"answer":0,"explanation":"why this is correct"}

"answer" is the 0-based index of the correct option.
Respond with the JSON array only.`;

    // Clear MCQ PDF after use
    this.removeMcqPdf();

    try {
      this.abortController = new AbortController();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, sessionId: this.currentSessionId }),
        signal: this.abortController.signal,
      });

      typingEl.remove();

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.details || err.error || 'Failed');
      }

      const data = await response.json();
      let raw = data.response;

      // Strip code fences if AI wraps them
      raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      let questions;
      try {
        questions = JSON.parse(raw);
      } catch {
        // Try to extract JSON array from response
        const m = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (m) questions = JSON.parse(m[0]);
        else throw new Error('AI did not return valid quiz data. Please try again.');
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('No questions generated. Please try again.');
      }

      // Save to session
      this.saveMessageToSession('user', prompt);
      this.saveMessageToSession('assistant', JSON.stringify(questions));
      this.updateSessionTitle(`Quiz: ${topic}`);

      // Render interactive MCQ
      this.renderMCQQuiz(questions, topic, difficulty);

    } catch (error) {
      typingEl?.remove();
      if (error.name === 'AbortError') {
        this.showToast('Generation stopped', 'info');
      } else {
        this.appendMessage('assistant', `**Error:** ${error.message}`);
        this.showToast('Failed to generate quiz', 'error');
      }
    } finally {
      this.isGenerating = false;
      this.abortController = null;
      this.elements.sendBtn.classList.remove('hidden');
      this.elements.stopBtn.classList.add('hidden');
      this.scrollToBottom();
    }
  }

  renderMCQQuiz(questions, topic, difficulty) {
    const quizDiv = document.createElement('div');
    quizDiv.className = 'message message-assistant mcq-quiz-container';

    const header = `
      <div class="mcq-header">
        <div class="mcq-header-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div class="mcq-header-text">
          <span class="mcq-title">${this.escapeHtml(topic)}</span>
          <span class="mcq-meta">${questions.length} questions · ${difficulty}</span>
        </div>
        <div class="mcq-score-badge" id="mcqScoreBadge" style="display:none">
          <span id="mcqScoreText">0/0</span>
        </div>
      </div>`;

    let questionsHTML = '';
    questions.forEach((q, qi) => {
      const optionsHTML = q.options.map((opt, oi) => {
        const letter = String.fromCharCode(65 + oi);
        const cleanOpt = opt.replace(/^[A-D]\)\s*/, '');
        return `<button class="mcq-option" data-qi="${qi}" data-oi="${oi}">
          <span class="mcq-option-letter">${letter}</span>
          <span class="mcq-option-text">${this.escapeHtml(cleanOpt)}</span>
          <span class="mcq-option-icon"></span>
        </button>`;
      }).join('');

      questionsHTML += `
        <div class="mcq-question" data-qi="${qi}" data-answer="${q.answer}">
          <div class="mcq-q-header">
            <span class="mcq-q-num">${qi + 1}</span>
            <span class="mcq-q-text">${this.escapeHtml(q.q)}</span>
          </div>
          <div class="mcq-options">${optionsHTML}</div>
          <div class="mcq-explanation" style="display:none">
            <div class="mcq-explanation-content">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span>${this.escapeHtml(q.explanation)}</span>
            </div>
            <button class="mcq-learn-more" data-topic="${this.escapeHtml(q.q)}">Learn More</button>
          </div>
        </div>`;
    });

    const footer = `
      <div class="mcq-footer">
        <button class="mcq-check-all" id="mcqCheckAll">Check Answers</button>
        <button class="mcq-retry" id="mcqRetry" style="display:none">Try Again</button>
      </div>`;

    quizDiv.innerHTML = header + '<div class="mcq-questions">' + questionsHTML + '</div>' + footer;
    this.elements.messagesContainer.appendChild(quizDiv);

    // State
    let answered = 0;
    let correct = 0;
    const total = questions.length;
    const selections = new Array(total).fill(-1);

    // Option click handler
    quizDiv.querySelectorAll('.mcq-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const qi = parseInt(btn.dataset.qi);
        const qEl = quizDiv.querySelector(`.mcq-question[data-qi="${qi}"]`);
        if (qEl.classList.contains('checked')) return;

        // Deselect previous
        qEl.querySelectorAll('.mcq-option').forEach(o => o.classList.remove('selected'));
        btn.classList.add('selected');
        selections[qi] = parseInt(btn.dataset.oi);
      });
    });

    // Check answers
    quizDiv.querySelector('#mcqCheckAll').addEventListener('click', () => {
      answered = 0;
      correct = 0;

      questions.forEach((q, qi) => {
        const qEl = quizDiv.querySelector(`.mcq-question[data-qi="${qi}"]`);
        if (qEl.classList.contains('checked')) return;

        const sel = selections[qi];
        if (sel === -1) return; // not answered

        qEl.classList.add('checked');
        answered++;

        const isCorrect = sel === q.answer;
        if (isCorrect) correct++;

        qEl.querySelectorAll('.mcq-option').forEach((o, oi) => {
          if (oi === q.answer) {
            o.classList.add('correct');
            o.querySelector('.mcq-option-icon').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          }
          if (oi === sel && !isCorrect) {
            o.classList.add('wrong');
            o.querySelector('.mcq-option-icon').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
          }
        });

        // Show explanation
        qEl.querySelector('.mcq-explanation').style.display = 'block';
      });

      if (answered === 0) {
        this.showToast('Select answers first', 'info');
        return;
      }

      // Update score
      const badge = quizDiv.querySelector('#mcqScoreBadge');
      badge.style.display = 'flex';
      badge.querySelector('#mcqScoreText').textContent = `${correct}/${answered}`;
      badge.className = 'mcq-score-badge ' + (correct === answered ? 'perfect' : correct >= answered / 2 ? 'good' : 'needs-work');

      // Show retry if all answered
      if (answered === total) {
        quizDiv.querySelector('#mcqCheckAll').style.display = 'none';
        quizDiv.querySelector('#mcqRetry').style.display = 'inline-flex';
      }

      this.scrollToBottom();
    });

    // Retry
    quizDiv.querySelector('#mcqRetry').addEventListener('click', () => {
      this.elements.mcqTopic.value = topic;
      this.openMCQ();
    });

    // Learn more buttons
    quizDiv.querySelectorAll('.mcq-learn-more').forEach(btn => {
      btn.addEventListener('click', () => {
        const qText = btn.dataset.topic;
        this.elements.messageInput.value = `Explain in detail: ${qText}`;
        this.autoResizeTextarea();
        this.updateSendButton();
        this.sendMessage();
      });
    });

    this.scrollToBottom();
  }
}

// Initialize the app
window.addEventListener('DOMContentLoaded', () => {
  window.synapseAI = new SynapseAI();
});
