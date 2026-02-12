import express from 'express';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
}));

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Multer setup for PDF uploads (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

// Model
const MODEL_NAME = 'llama-3.3-70b-versatile';

// Store chat sessions in memory
const chatSessions = new Map();

// System instruction for SynapseAI
const SYSTEM_INSTRUCTION = `You are SynapseAI, a highly intelligent, helpful, and friendly AI assistant. 
You provide clear, accurate, and well-structured responses. 
You can help with coding, writing, analysis, math, creative tasks, and general knowledge.
When providing code, always use proper markdown code blocks with language specification.
Be conversational but professional. Use markdown formatting for better readability.
If you don't know something, say so honestly rather than making things up.`;

// Create or get chat session
function getOrCreateSession(sessionId) {
  if (!chatSessions.has(sessionId)) {
    chatSessions.set(sessionId, {
      messages: [{ role: 'system', content: SYSTEM_INSTRUCTION }],
      history: [],
      title: null,
      createdAt: new Date().toISOString(),
    });
  }
  return chatSessions.get(sessionId);
}

// Generate title for conversation
async function generateTitle(message) {
  try {
    const result = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'user', content: `Generate a very short title (max 5 words) for a conversation that starts with: "${message.substring(0, 200)}". Return ONLY the title, no quotes, no extra text.` }
      ],
      max_tokens: 30,
      temperature: 0.5,
    });
    return result.choices[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

// Chat endpoint (non-streaming)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = randomUUID() } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const session = getOrCreateSession(sessionId);

    // Add user message to context
    session.messages.push({ role: 'user', content: message });

    // Generate title from first message
    if (!session.title) {
      session.title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
      generateTitle(message).then(t => { if (t) session.title = t; });
    }

    // Get response from Groq
    const result = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: session.messages,
      max_tokens: 8192,
      temperature: 0.7,
      top_p: 0.95,
    });

    const response = result.choices[0]?.message?.content || 'No response generated.';

    // Add assistant message to context
    session.messages.push({ role: 'assistant', content: response });

    // Store in display history
    session.history.push(
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response, timestamp: new Date().toISOString() }
    );

    res.json({
      response,
      sessionId,
      title: session.title,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      details: error.message 
    });
  }
});

// Stream chat endpoint
app.post('/api/chat/stream', async (req, res) => {
  let headersSet = false;
  try {
    const { message, sessionId = randomUUID() } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const session = getOrCreateSession(sessionId);

    // Add user message to context
    session.messages.push({ role: 'user', content: message });

    // Generate title from first message (non-blocking)
    if (!session.title) {
      session.title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
      generateTitle(message).then(t => { if (t) session.title = t; });
    }

    // Set up SSE immediately
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    headersSet = true;

    // Send session info
    res.write(`data: ${JSON.stringify({ type: 'session', sessionId, title: session.title })}\n\n`);

    // Stream response from Groq
    const stream = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: session.messages,
      max_tokens: 8192,
      temperature: 0.7,
      top_p: 0.95,
      stream: true,
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
      }
    }

    // Add assistant message to context
    session.messages.push({ role: 'assistant', content: fullResponse });

    // Store in display history
    session.history.push(
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: fullResponse, timestamp: new Date().toISOString() }
    );

    res.write(`data: ${JSON.stringify({ type: 'done', fullResponse })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    const userMsg = error?.status === 429
      ? 'API rate limit exceeded. Please wait a moment and try again.'
      : error.message || 'Unknown error';
    if (headersSet) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: userMsg })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'Failed to generate response', details: userMsg });
    }
  }
});

// Get session history
app.get('/api/sessions/:sessionId', (req, res) => {
  const session = chatSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({
    sessionId: req.params.sessionId,
    title: session.title,
    history: session.history,
    createdAt: session.createdAt,
  });
});

// List all sessions
app.get('/api/sessions', (req, res) => {
  const sessions = [];
  for (const [id, session] of chatSessions) {
    sessions.push({
      sessionId: id,
      title: session.title,
      messageCount: session.history.length,
      createdAt: session.createdAt,
      lastMessage: session.history.length > 0 
        ? session.history[session.history.length - 1].timestamp 
        : session.createdAt,
    });
  }
  sessions.sort((a, b) => new Date(b.lastMessage) - new Date(a.lastMessage));
  res.json(sessions);
});

// Delete session
app.delete('/api/sessions/:sessionId', (req, res) => {
  chatSessions.delete(req.params.sessionId);
  res.json({ success: true });
});

// PDF Upload & Text Extraction
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
    await parser.load();
    const result = await parser.getText();
    const numPages = result?.pages?.length || 0;
    // Strip page markers like "-- 1 of 3 --" added by pdf-parse
    let text = (result?.text || '').replace(/--\s*\d+\s*of\s*\d+\s*--/g, '').trim();
    parser.destroy();

    if (!text.trim()) {
      return res.status(400).json({ error: 'Could not extract text from PDF. The file may be image-based or empty.' });
    }

    res.json({
      text: text.trim(),
      pages: numPages,
      fileName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    console.error('PDF parse error:', error);
    if (error.message === 'Only PDF files are allowed') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to process PDF file' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', name: 'SynapseAI' });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║     ⚡ SynapseAI Server Running ⚡       ║
  ║                                          ║
  ║     http://localhost:${PORT}               ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
  `);
});
