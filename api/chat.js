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
  try {
    if (ai === 'chatgpt' && apis?.chatgpt) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apis.chatgpt
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: message }],
          max_tokens: 200,
          temperature: 0.7
        })
      })
      const data = await r.json()
      const reply = data.choices?.[0]?.message?.content || 'No response'
      res.status(200).json({ success: true, reply })
      return
    }
    if (ai === 'simple') {
      res.status(200).json({ success: true, reply: 'Simple AI: ' + message })
      return
    }
    if (ai === 'reverse') {
      res.status(200).json({ success: true, reply: message.split('').reverse().join('') })
      return
    }
    if (ai === 'uppercase') {
      res.status(200).json({ success: true, reply: message.toUpperCase() })
      return
    }
    res.status(200).json({ success: false, reply: 'Unsupported AI or missing API key' })
  } catch {
    res.status(500).json({ success: false, reply: 'Internal error' })
  }
}
