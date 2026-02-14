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

// Initialize AI clients
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Available models configuration
const MODELS = {
  'groq-llama': { provider: 'groq', model: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
  'groq-llama8b': { provider: 'groq', model: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
};
const DEFAULT_MODEL = 'groq-llama';

// HuggingFace chat completion helper
async function hfChatCompletion(model, messages, options = {}) {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) throw new Error('HF_TOKEN not set');

  // Build prompt in ChatML-style format (works with most instruction-tuned models)
  let prompt = '';
  for (const msg of messages) {
    if (msg.role === 'system') {
      prompt += `<|system|>\n${msg.content}</s>\n`;
    } else if (msg.role === 'user') {
      prompt += `<|user|>\n${msg.content}</s>\n`;
    } else if (msg.role === 'assistant') {
      prompt += `<|assistant|>\n${msg.content}</s>\n`;
    }
  }
  prompt += '<|assistant|>\n';

  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
      'x-wait-for-model': 'true',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: options.max_tokens || 2048,
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 0.95,
        return_full_text: false,
        stop: ['</s>', '<|user|>', '<|system|>'],
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HF API error: ${response.status}`);
  }

  const data = await response.json();
  const text = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
  return { choices: [{ message: { content: text || '' } }] };
}

// HuggingFace streaming chat completion
async function* hfChatCompletionStream(model, messages, options = {}) {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) throw new Error('HF_TOKEN not set');

  let prompt = '';
  for (const msg of messages) {
    if (msg.role === 'system') {
      prompt += `<|system|>\n${msg.content}</s>\n`;
    } else if (msg.role === 'user') {
      prompt += `<|user|>\n${msg.content}</s>\n`;
    } else if (msg.role === 'assistant') {
      prompt += `<|assistant|>\n${msg.content}</s>\n`;
    }
  }
  prompt += '<|assistant|>\n';

  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
      'x-wait-for-model': 'true',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: options.max_tokens || 2048,
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 0.95,
        return_full_text: false,
        stop: ['</s>', '<|user|>', '<|system|>'],
      },
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HF API error: ${response.status}`);
  }

  const data = await response.json();
  const text = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
  
  // Simulate streaming by yielding chunks
  const content = text || '';
  const chunkSize = 10;
  for (let i = 0; i < content.length; i += chunkSize) {
    yield { choices: [{ delta: { content: content.slice(i, i + chunkSize) } }] };
  }
}

// Get AI client for model
function getClientForModel(modelId) {
  const config = MODELS[modelId] || MODELS[DEFAULT_MODEL];
  return { config, provider: config.provider, model: config.model };
}

// Multer setup for PDF uploads (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

// Video model - use text-to-video-ms-1.7b which has better free tier support
const VIDEO_MODEL = process.env.HF_VIDEO_MODEL || 'ali-vilab/text-to-video-ms-1.7b';

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

// Generate title for conversation (always uses Groq for speed)
async function generateTitle(message) {
  try {
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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

// List available models
app.get('/api/models', (req, res) => {
  const models = Object.entries(MODELS).map(([id, cfg]) => ({
    id,
    name: cfg.name,
    provider: cfg.provider,
  }));
  res.json({ models, default: DEFAULT_MODEL });
});

// Chat endpoint (non-streaming)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = randomUUID(), modelId } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const session = getOrCreateSession(sessionId);
    const { provider, model } = getClientForModel(modelId);

    // Add user message to context
    session.messages.push({ role: 'user', content: message });

    // Generate title from first message
    let titlePromise = null;
    if (!session.title) {
      session.title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
      titlePromise = generateTitle(message);
    }

    // Get response from Groq
    const result = await groq.chat.completions.create({
      model,
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

    // Wait for AI title if still pending
    if (titlePromise) {
      const aiTitle = await titlePromise;
      if (aiTitle) session.title = aiTitle;
    }

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
    const { message, sessionId = randomUUID(), modelId } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const session = getOrCreateSession(sessionId);
    const { provider, model } = getClientForModel(modelId);

    // Add user message to context
    session.messages.push({ role: 'user', content: message });

    // Track if this is a new conversation needing a title
    const needsTitle = !session.title;
    let titlePromise = null;
    if (needsTitle) {
      session.title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
      titlePromise = generateTitle(message);
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
      model,
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

    // Send AI-generated title if available
    if (titlePromise) {
      const aiTitle = await titlePromise;
      if (aiTitle) {
        session.title = aiTitle;
        res.write(`data: ${JSON.stringify({ type: 'title-update', title: aiTitle })}\n\n`);
      }
    }

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

// AI Image Generation (Groq prompt enhancement + Hugging Face inference)
const IMAGE_MODEL = process.env.HF_IMAGE_MODEL || 'stabilityai/stable-diffusion-xl-base-1.0';

app.post('/api/image', async (req, res) => {
  try {
    const { prompt, style, enhance = true } = req.body || {};
    const hfToken = process.env.HF_TOKEN;

    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!hfToken) {
      return res.status(400).json({
        error: 'Missing Hugging Face token. Set HF_TOKEN in your environment.',
      });
    }

    let finalPrompt = prompt.trim();
    
    // Enhance prompt with Groq only if enhance flag is true
    if (enhance) {
      const enhancement = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You enhance user prompts for a text-to-image AI model. Respond with ONLY the improved prompt, no quotes, no extra text. Add artistic details, lighting, composition, and style cues.'
          },
          {
            role: 'user',
            content: `Improve this prompt for high-quality image generation. Preserve intent, add vivid visual details.
Prompt: ${prompt}
${style ? `Style: ${style}` : ''}`
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      finalPrompt = enhancement.choices[0]?.message?.content?.trim() || prompt.trim();
    } else if (style) {
      finalPrompt = `${prompt.trim()}, ${style.trim()}`;
    }

    // Call HF inference
    const hfResponse = await fetch(`https://router.huggingface.co/hf-inference/models/${IMAGE_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
        Accept: 'image/png',
        'x-wait-for-model': 'true',
      },
      body: JSON.stringify({ inputs: finalPrompt }),
    });

    const contentType = hfResponse.headers.get('content-type') || '';
    if (!hfResponse.ok) {
      let details = 'Image generation failed.';
      if (contentType.includes('application/json')) {
        const errData = await hfResponse.json();
        details = errData?.error || errData?.message || details;
      } else {
        const text = await hfResponse.text();
        if (text) details = text;
      }
      return res.status(hfResponse.status).json({ error: details });
    }

    if (contentType.includes('application/json')) {
      const errData = await hfResponse.json();
      return res.status(502).json({ error: errData?.error || 'Model did not return image data' });
    }

    const buffer = Buffer.from(await hfResponse.arrayBuffer());
    res.setHeader('Content-Type', contentType || 'image/png');
    if (enhance) {
      res.setHeader('X-Enhanced-Prompt', encodeURIComponent(finalPrompt));
    }
    res.send(buffer);
  } catch (error) {
    console.error('Image error:', error);
    res.status(500).json({ error: 'Failed to generate image', details: error.message });
  }
});

// AI Video Generation (Groq prompt enhancement + Hugging Face inference)
app.post('/api/video', async (req, res) => {
  try {
    const { prompt, style } = req.body || {};
    const hfToken = process.env.HF_TOKEN;

    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!hfToken) {
      return res.status(400).json({
        error: 'Missing Hugging Face token. Set HF_TOKEN in your environment.',
      });
    }

    // Use Groq for prompt enhancement (always fast)
    const enhancement = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You enhance user prompts for a text-to-video model. Respond with ONLY the improved prompt, no quotes, no extra text.'
        },
        {
          role: 'user',
          content: `Improve this prompt for cinematic video generation. Preserve intent, add vivid visual details, camera cues, and lighting.
Prompt: ${prompt}
${style ? `Style constraints: ${style}` : ''}`
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
      top_p: 0.9,
    });

    const enhancedPrompt = enhancement.choices[0]?.message?.content?.trim() || prompt.trim();

    // Call HF inference - add wait-for-model header since video models need loading time
    const hfResponse = await fetch(`https://router.huggingface.co/hf-inference/models/${VIDEO_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
        Accept: 'video/mp4',
        'x-wait-for-model': 'true',
      },
      body: JSON.stringify({ inputs: enhancedPrompt }),
    });

    const contentType = hfResponse.headers.get('content-type') || '';
    if (!hfResponse.ok) {
      let details = 'Video generation failed.';
      if (contentType.includes('application/json')) {
        const errData = await hfResponse.json();
        details = errData?.error || errData?.message || details;
      } else {
        const text = await hfResponse.text();
        if (text) details = text;
      }
      return res.status(hfResponse.status).json({ error: details });
    }

    if (contentType.includes('application/json')) {
      const errData = await hfResponse.json();
      return res.status(502).json({ error: errData?.error || 'Model did not return video data' });
    }

    const buffer = Buffer.from(await hfResponse.arrayBuffer());
    res.setHeader('Content-Type', contentType || 'video/mp4');
    res.setHeader('X-Enhanced-Prompt', encodeURIComponent(enhancedPrompt));
    res.send(buffer);
  } catch (error) {
    console.error('Video error:', error);
    res.status(500).json({ error: 'Failed to generate video', details: error.message });
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
