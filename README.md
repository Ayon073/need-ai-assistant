# Need — আপনার AI সহকারী

Need-এর প্রথম সংস্করণে বাংলা chat, **রোজকার জীবন** ও **লেখালেখি** mode এবং AI API সংযোগ আছে। কথোপকথন server-এ সংরক্ষণ করা হয় না। ওয়েব সার্চ, ক্যালেন্ডার ও reminder এখনো যোগ করা হয়নি।

## চালু করুন

প্রথমে Node.js 18 বা তার পরের সংস্করণ ইনস্টল থাকতে হবে। PowerShell-এ এই ফোল্ডারে এসে চালান:

```powershell
$env:OPENAI_API_KEY = "আপনার-API-key"
$env:OPENAI_MODEL = "gpt-4o-mini"
npm.cmd start
```

তারপর browser-এ `http://localhost:3000` খুলুন। API key শুধু server-এ ব্যবহার হয়; এটি browser-এ পাঠানো হয় না। key-টি source code-এ লিখবেন না।

Provider যদি OpenAI-compatible API দেয়, প্রয়োজন হলে `OPENAI_BASE_URL`-ও সেট করুন। উদাহরণ:

```powershell
$env:OPENAI_BASE_URL = "https://api.openai.com/v1"
```

AI API key না থাকলেও interface খুলবে, তবে chat-এর উত্তর পেতে provider-এর API key এবং সক্রিয় billing/credits প্রয়োজন। ভুল key বা provider error হলে app-এ ত্রুটি দেখাবে।

## Billing ছাড়া local AI চালান (Ollama)

Ollama আপনার নিজের কম্পিউটারে model চালায়; API key বা provider billing লাগে না। তবে model প্রথমবার নামাতে internet লাগবে এবং model চালানোর জন্য পর্যাপ্ত RAM/খালি disk space থাকা দরকার।

1. [Ollama download page](https://ollama.com/download/windows) থেকে Windows-এর Ollama ইনস্টল করুন।
2. PowerShell-এ Need folder খুলে model নামান:

```powershell
ollama pull qwen2.5:3b
```

3. Ollama চালু আছে নিশ্চিত করে **একই PowerShell window**-এ Need শুরু করুন:

```powershell
$env:NEED_PROVIDER = "ollama"
$env:OPENAI_MODEL = "qwen2.5:3b"
npm.cmd start
```

4. `http://localhost:3000` খুলে chat করুন। API key সেট করার প্রয়োজন নেই।

Model ডাউনলোড ও উত্তর তৈরি আপনার কম্পিউটারের resources ব্যবহার করবে। কম্পিউটার ধীর হলে ছোট model বেছে নেওয়া বা কম message context রাখা সাহায্য করতে পারে। একই machine-এ OpenAI ব্যবহার করতে চাইলে নতুন PowerShell window-তে `Remove-Item Env:NEED_PROVIDER` চালিয়ে OpenAI setup অনুযায়ী server চালু করুন।

## বর্তমানে যা আছে

- বাংলা-প্রথম responsive chat interface
- দৈনন্দিন সাহায্য ও লেখালেখির আলাদা mode
- উদাহরণ prompt, নতুন chat এবং conversation reset
- server-side API key ব্যবহার; chat history শুধু browser session-এর memory-তে থাকে
- API billing ছাড়া local Ollama model ব্যবহার

## পরের ধাপ

প্রথমে Need-কে ব্যবহার করে chat ও দুইটি mode যাচাই করুন। এরপর একবারে একটি feature যোগ করুন—যেমন web search; calendar/reminder যোগ করার সময় ব্যবহারকারীর অনুমতি এবং কাজ নিশ্চিত করার ধাপ রাখুন।
