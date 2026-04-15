<!DOCTYPE html>
<html>
<head>
  <title>BB AI Chat</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

<div id="login">
  <input id="email" placeholder="email">
  <input id="password" type="password" placeholder="password">
  <button onclick="login()">Login</button>
  <button onclick="register()">Register</button>
</div>

<div id="chatUI" style="display:none;">
  <div id="chat"></div>
  <input id="text" placeholder="message..." />
  <button onclick="send()">Send</button>
</div>

<script src="app.js"></script>
</body>
</html>
