<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PrysmisAI API Documentation</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="API.css">
</head>
<body>
<header class="hdr">
<div class="hdr-inner">
<a href="/dashboard/aibuild/index.html" class="hdr-logo">
<span class="hdr-wordmark">PrysmisAI</span>
<span class="hdr-pill">API</span>
</a>
<button class="back-btn" id="backBtn">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
Go Back
</button>
</div>
</header>

<div class="page">
<nav class="sidenav">
<p class="sidenav-label">On this page</p>
<a class="sidenav-link active" href="#overview">Overview</a>
<a class="sidenav-link" href="#endpoint">Endpoint</a>
<a class="sidenav-link" href="#request">Request</a>
<a class="sidenav-link" href="#models">Models</a>
<a class="sidenav-link" href="#examples">Examples</a>
<a class="sidenav-link" href="#response">Response</a>
<a class="sidenav-link" href="#errors">Errors</a>
</nav>

<main class="content">

<section class="section" id="overview">
<span class="eyebrow">Documentation</span>
<h1 class="page-title">PrysmisAI API</h1>
<p class="page-desc">A single OpenAI-compatible endpoint that routes to multiple AI models. No API keys. No sign-up. Just send requests and get responses.</p>
<div class="note note-blue">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
<p>This API is fully compatible with the OpenAI Chat Completions spec. Swap the base URL and everything works.</p>
</div>
</section>

<div class="divider"></div>

<section class="section" id="endpoint">
<h2 class="section-title">Endpoint</h2>
<p class="section-text">One endpoint handles all completions:</p>
<div class="endpoint-card">
<span class="method-badge">POST</span>
<code class="endpoint-url">https://prysmisai.wtf/v1/chat/completions</code>
<button class="copy-url-btn" data-copy="https://prysmisai.wtf/v1/chat/completions">Copy</button>
</div>
<p class="section-text mt">Model can also be passed as a query param:</p>
<div class="endpoint-card">
<span class="method-badge">POST</span>
<code class="endpoint-url">https://prysmisai.wtf/v1/chat/completions?model=gpt-5.2</code>
</div>
</section>

<div class="divider"></div>

<section class="section" id="request">
<h2 class="section-title">Request Format</h2>
<p class="section-text">JSON body. All fields:</p>
<table class="tbl">
<thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Default</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>model</code></td><td>string</td><td><span class="opt">optional</span></td><td><code>gpt-5.2</code></td><td>Model ID to use</td></tr>
<tr><td><code>messages</code></td><td>array</td><td><span class="req">required</span></td><td>-</td><td>Conversation history</td></tr>
<tr><td><code>temperature</code></td><td>number</td><td><span class="opt">optional</span></td><td><code>0.7</code></td><td>Randomness 0-2</td></tr>
<tr><td><code>max_tokens</code></td><td>number</td><td><span class="opt">optional</span></td><td><code>4096</code></td><td>Max output tokens</td></tr>
</tbody>
</table>
<p class="section-text mt">Message object shape:</p>
<table class="tbl">
<thead><tr><th>Field</th><th>Values</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>role</code></td><td><code>system</code> <code>user</code> <code>assistant</code></td><td>Who authored the message</td></tr>
<tr><td><code>content</code></td><td>string or array</td><td>Text content. Use an array for vision (image + text)</td></tr>
</tbody>
</table>
</section>

<div class="divider"></div>

<section class="section" id="models">
<h2 class="section-title">Available Models</h2>
<p class="section-text">Pass the model ID as the <code>model</code> field. If the chosen model fails, the API auto-falls back through the chain.</p>
<div class="model-tiers">
<div class="model-tier-block">
<div class="tier-header tier-free">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
Free Models
</div>
<div class="model-rows">
<div class="model-row">
<code class="model-id">gpt-5.2</code>
<span class="model-label">ChatGPT 5.2</span>
<span class="model-note">Latest from OpenAI</span>
</div>
<div class="model-row">
<code class="model-id">gpt-4o</code>
<span class="model-label">GPT-4o</span>
<span class="model-note">Fast multimodal</span>
</div>
<div class="model-row">
<code class="model-id">gpt-4o-mini</code>
<span class="model-label">GPT-4o Mini</span>
<span class="model-note">Lightweight</span>
</div>
<div class="model-row">
<code class="model-id">claude-sonnet-4-5</code>
<span class="model-label">Claude Sonnet 4.5</span>
<span class="model-note">Anthropic balanced</span>
</div>
<div class="model-row">
<code class="model-id">claude-haiku-3-5</code>
<span class="model-label">Claude Haiku 3.5</span>
<span class="model-note">Fast and efficient</span>
</div>
<div class="model-row">
<code class="model-id">o3-mini</code>
<span class="model-label">o3 Mini</span>
<span class="model-note">OpenAI reasoning</span>
</div>
</div>
</div>
<div class="model-tier-block">
<div class="tier-header tier-premium">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
Premium Models
</div>
<div class="model-rows">
<div class="model-row model-row-premium">
<code class="model-id">claude-opus-4-5</code>
<span class="model-label">Claude Opus 4.5</span>
<span class="model-note">Most powerful Anthropic</span>
</div>
<div class="model-row model-row-premium">
<code class="model-id">gemini-3.1-pro-preview</code>
<span class="model-label">Gemini 3.1 Pro</span>
<span class="model-note">Google latest</span>
</div>
</div>
</div>
</div>
<div class="note note-green mt">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
<p>Fallback order: <code>gpt-5.2</code> then <code>gpt-4o</code> then <code>claude-sonnet-4-5</code> then <code>gpt-4o-mini</code></p>
</div>
</section>

<div class="divider"></div>

<section class="section" id="examples">
<h2 class="section-title">Examples</h2>

<p class="ex-label">JavaScript</p>
<div class="codebox">
<div class="codebox-header">
<span class="codebox-lang">JS</span>
<button class="codebox-copy" data-target="ex1">Copy</button>
</div>
<pre id="ex1"><code><span class="ck">const</span> <span class="cv">response</span> = <span class="ck">await</span> fetch(<span class="cs">'https://prysmisai.wtf/v1/chat/completions'</span>, {
  method: <span class="cs">'POST'</span>,
  headers: { <span class="cs">'Content-Type'</span>: <span class="cs">'application/json'</span> },
  body: JSON.stringify({
    model: <span class="cs">'gpt-5.2'</span>,
    messages: [
      { role: <span class="cs">'system'</span>, content: <span class="cs">'You are a helpful assistant.'</span> },
      { role: <span class="cs">'user'</span>, content: <span class="cs">'Write me a Roblox health bar script.'</span> }
    ],
    max_tokens: <span class="cn">4096</span>
  })
});

<span class="ck">const</span> <span class="cv">data</span> = <span class="ck">await</span> response.json();
console.log(data.choices[<span class="cn">0</span>].message.content);</code></pre>
</div>

<p class="ex-label mt">Python</p>
<div class="codebox">
<div class="codebox-header">
<span class="codebox-lang">PY</span>
<button class="codebox-copy" data-target="ex2">Copy</button>
</div>
<pre id="ex2"><code><span class="ck">import</span> requests

res = requests.post(<span class="cs">'https://prysmisai.wtf/v1/chat/completions'</span>, json={
    <span class="cs">'model'</span>: <span class="cs">'claude-sonnet-4-5'</span>,
    <span class="cs">'messages'</span>: [
        {<span class="cs">'role'</span>: <span class="cs">'user'</span>, <span class="cs">'content'</span>: <span class="cs">'Create a Roblox shop system.'</span>}
    ],
    <span class="cs">'max_tokens'</span>: <span class="cn">4096</span>
})

<span class="ck">print</span>(res.json()[<span class="cs">'choices'</span>][<span class="cn">0</span>][<span class="cs">'message'</span>][<span class="cs">'content'</span>])</code></pre>
</div>

<p class="ex-label mt">cURL</p>
<div class="codebox">
<div class="codebox-header">
<span class="codebox-lang">SH</span>
<button class="codebox-copy" data-target="ex3">Copy</button>
</div>
<pre id="ex3"><code>curl -X POST https://prysmisai.wtf/v1/chat/completions \
  -H <span class="cs">"Content-Type: application/json"</span> \
  -d <span class="cs">'{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 2048
  }'</span></code></pre>
</div>
</section>

<div class="divider"></div>

<section class="section" id="response">
<h2 class="section-title">Response Format</h2>
<p class="section-text">Standard OpenAI Chat Completions response:</p>
<div class="codebox">
<div class="codebox-header">
<span class="codebox-lang">JSON</span>
</div>
<pre><code>{
  <span class="ck">"id"</span>: <span class="cs">"chatcmpl-..."</span>,
  <span class="ck">"object"</span>: <span class="cs">"chat.completion"</span>,
  <span class="ck">"model"</span>: <span class="cs">"gpt-5.2"</span>,
  <span class="ck">"choices"</span>: [
    {
      <span class="ck">"index"</span>: <span class="cn">0</span>,
      <span class="ck">"message"</span>: {
        <span class="ck">"role"</span>: <span class="cs">"assistant"</span>,
        <span class="ck">"content"</span>: <span class="cs">"Response text..."</span>
      },
      <span class="ck">"finish_reason"</span>: <span class="cs">"stop"</span>
    }
  ],
  <span class="ck">"usage"</span>: {
    <span class="ck">"prompt_tokens"</span>: <span class="cn">24</span>,
    <span class="ck">"completion_tokens"</span>: <span class="cn">180</span>,
    <span class="ck">"total_tokens"</span>: <span class="cn">204</span>
  }
}</code></pre>
</div>
<p class="section-text mt">Get the text: <code>data.choices[0].message.content</code></p>
</section>

<div class="divider"></div>

<section class="section" id="errors">
<h2 class="section-title">Errors</h2>
<table class="tbl">
<thead><tr><th>Status</th><th>When</th></tr></thead>
<tbody>
<tr><td><span class="badge-400">400</span></td><td>Missing or invalid messages array</td></tr>
<tr><td><span class="badge-500">500</span></td><td>All model fallbacks exhausted</td></tr>
</tbody>
</table>
<p class="section-text mt">Error body:</p>
<div class="codebox">
<pre><code>{ <span class="ck">"error"</span>: <span class="cs">"No valid messages provided"</span> }</code></pre>
</div>
</section>

<div style="height:4rem"></div>
</main>
</div>
<script src="API.js"></script>
</body>
</html>
