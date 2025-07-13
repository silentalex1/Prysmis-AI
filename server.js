const express = require('express');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

const validKeys = new Map();
const configuration = new Configuration({
  apiKey: process.env.PYRSMIS_AI_KEY
});
const openai = new OpenAIApi(configuration);

app.post('/api/pyrsmis/key/generate', (req, res) => {
  const key = `pyrsmisai_${crypto.randomUUID()}`;
  validKeys.set(key, true); // Store the generated key as valid
  res.json({ key });
});

app.post('/api/pyrsmis/key/save', (req, res) => {
  const { key, sessionId } = req.body;
  if (validKeys.has(key)) {
    validKeys.set(sessionId, key);
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/chat', async (req, res) => {
  const { prompt, sessionId } = req.body;
  const key = validKeys.get(sessionId);
  if (!key) {
    res.json({ response: 'Invalid or missing API key' });
    return;
  }
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150
    });
    res.json({ response: response.data.choices[0].message.content });
  } catch (error) {
    res.json({ response: 'Error processing request' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
