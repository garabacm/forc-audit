# Forc Advisory — Tech Cost Red Flag Audit
## Deployment Guide

---

## What's in this folder

```
forc-audit/
  api/
    generate.js       ← Vercel backend (proxies Anthropic API safely)
  public/
    index.html        ← The audit tool (embed this in Framer)
  vercel.json         ← Vercel config
  README.md           ← This file
```

---

## Step 1: Deploy to Vercel

### 1a. Install Vercel CLI
Open your terminal and run:
```
npm install -g vercel
```

### 1b. Log in to Vercel
```
vercel login
```
Follow the prompts — it'll open a browser to authenticate.

### 1c. Deploy the project
Navigate into the forc-audit folder:
```
cd forc-audit
vercel
```

When prompted:
- "Set up and deploy?" → Yes
- "Which scope?" → Your personal account
- "Link to existing project?" → No
- "Project name?" → forc-audit (or anything you like)
- "In which directory is your code?" → ./ (just press Enter)
- "Want to override settings?" → No

Vercel will deploy and give you a URL like:
`https://forc-audit-abc123.vercel.app`

### 1d. Add your Anthropic API key as an environment variable
Go to vercel.com → your project → Settings → Environment Variables

Add:
- Name: `ANTHROPIC_API_KEY`
- Value: your actual API key (starts with sk-ant-)
- Environment: Production, Preview, Development (tick all three)

Then redeploy:
```
vercel --prod
```

---

## Step 2: Update the HTML file

Open `public/index.html` and find this line near the top of the script:

```javascript
const API_URL = 'YOUR_VERCEL_URL/api/generate';
```

Replace it with your actual Vercel URL:

```javascript
const API_URL = 'https://forc-audit-abc123.vercel.app/api/generate';
```

---

## Step 3: Embed in Framer

### Option A — Full page (recommended)
1. In Framer, add a new page called "audit" or "tech-cost-audit"
2. Add a "Custom Code" component
3. Paste the entire contents of index.html
4. Set the component to full width and full height

### Option B — Embed as iframe
Host the index.html file separately (e.g. on GitHub Pages or as a Vercel static file) and embed via iframe in Framer:

```html
<iframe 
  src="https://your-audit-url.vercel.app" 
  width="100%" 
  height="800px" 
  frameborder="0"
  style="border-radius: 12px;">
</iframe>
```

---

## Step 4: Test it

1. Go to your Vercel URL directly to confirm the API works
2. Complete the full audit
3. Confirm the AI findings brief generates at the end
4. Update the "Book a 30-minute call" link in index.html to your Calendly URL

---

## Troubleshooting

**Findings brief doesn't appear**
- Check your ANTHROPIC_API_KEY is set in Vercel environment variables
- Make sure you redeployed after adding the key
- Check the API_URL in index.html matches your Vercel URL exactly

**CORS errors in browser console**
- The vercel.json file handles CORS headers — make sure it's in the root of your project folder

**Vercel CLI not found**
- Make sure Node.js is installed: node.js.org
- Try `npx vercel` instead of `vercel`

---

## Updating the CTA link

In index.html, find:
```html
<a class="btn-cta" href="https://forcadvisory.com" target="_blank">
```

Replace with your Calendly link:
```html
<a class="btn-cta" href="https://calendly.com/your-link" target="_blank">
```
