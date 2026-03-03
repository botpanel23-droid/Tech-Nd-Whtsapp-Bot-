module.exports = {
  panelPort: process.env.PORT || 3000,
  panelUrl: process.env.PANEL_URL || 'http://localhost:3000',
  panelSecret: process.env.SESSION_SECRET || 'wabot-secret-2024',
  githubRepo: process.env.GITHUB_REPO || '',

  // Bot Features
  alwaysOnline: true,
  autoTyping: true,
  autoSeen: true,
  autoStatusSeen: true,
  autoStatusLike: true,
  autoStatusLikeEmoji: '❤️',
  autoStatusSave: false,
  autoStatusReply: true,
  autoStatusReplyMessage: '✨ Status කියෙව්වා! ❤️',
  greetingAutoReply: true,
  greetingKeywords: ['hi','hello','hii','hey','hy','හෙලෝ','හායි'],

  // AI Auto Reply
  aiMode: false,

  // API Keys
  apiKey: 'dex_hQO5V4ggt814y1XIMPZQKvSIyz1fdUI4qkHYXtJnruZmTLwp',
  apiBase: 'https://public-apis-site-1b025aa8b541.herokuapp.com/api',

  prefix: '.',
  botName: 'WA-BOT',
};
