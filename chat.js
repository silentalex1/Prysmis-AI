const fetch = require('node-fetch')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }
  const { message, ai, apis } = req.body
  if (!message || !ai) {
    res.status(400).json({ error: 'Missing parameters' })
    return
  }

  async function callOpenAI(apiKey, prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.8
      })
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || null
  }

  try {
    let reply = ''
    if (ai === 'chatgpt' && apis?.chatgpt) {
      reply = await callOpenAI(apis.chatgpt, message)
      if (!reply) reply = "OpenAI API returned no result"
    } else if (ai === 'simple') {
      reply = `SimpleAI: You said "${message}"`
    } else if (ai === 'reverse') {
      reply = message.split('').reverse().join('')
    } else if (ai === 'uppercase') {
      reply = message.toUpperCase()
    } else {
      reply = "AI not supported or API key missing"
    }

    res.status(200).json({ success: true, reply })
  } catch {
    res.status(500).json({ success: false, reply: 'AI error' })
  }
}
