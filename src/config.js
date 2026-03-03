module.exports = {
  // Panel Settings
  panelPort: process.env.PORT || 3000,
  panelUrl: process.env.PANEL_URL || 'http://localhost:3000',
  panelSecret: process.env.SESSION_SECRET || 'wabot-secret-2024',
  githubRepo: process.env.GITHUB_REPO || '',

  // Bot Info
  botName: 'CHALAH MD',
  botVersion: '2.0.0',
  prefix: '.',
  watermark: '> 💎 *CHALAH MD* | wa.me/94742271802',
  ownerNumber: '94742271802',
  ownerName: 'CHALAH',

  // Images (URL or base64)
  menuImage: 'https://i.imgur.com/your-menu-image.jpg',
  connectImage: 'https://i.imgur.com/your-connect-image.jpg',

  // Bot Features
  alwaysOnline: true,
  autoTyping: true,
  autoSeen: true,
  autoStatusSeen: true,
  autoStatusLike: true,
  autoStatusLikeEmoji: '❤️',
  autoStatusSave: false,
  autoStatusReply: true,
  autoStatusReplyMessage: 'අද දැකපු කැතම Status එක ඔයාගෙ ☺️',
  greetingAutoReply: true,
  greetingKeywords: ['hi','hello','hii','hey','hy','හෙලෝ','හායි'],

  // AI Auto Reply
  aiMode: true,

  // Anti Features
  antiCall: true,
  antiDelete: false,

  // One View
  oneViewReveal: true,

  // API
  apiKey: 'dex_hQO5V4ggt814y1XIMPZQKvSIyz1fdUI4qkHYXtJnruZmTLwp',
  apiBase: 'https://public-apis-site-1b025aa8b541.herokuapp.com/api',
};
