// More intentional code smells for issue generation
var crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('md5').update(password).digest('hex'); // weak hash
}

function generateToken() {
  return Math.random().toString(36); // insecure random
}

function validateInput(input) {
  if (input == undefined) return false; // == instead of ===
  if (input == '') return false;
  if (input.length > 0) {
    return true;
  }
}

function hardcodedSecret() {
  var apiKey = 'sk-1234567890abcdef'; // hardcoded secret
  var dbPassword = 'admin123'; // hardcoded password
  return { apiKey, dbPassword };
}

function xssVulnerable(userHtml) {
  document.innerHTML = userHtml; // XSS vulnerability
}

function noReturnPath(x) {
  if (x > 0) {
    return 'positive';
  } else if (x < 0) {
    return 'negative';
  }
  // missing return for x === 0
}

module.exports = { hashPassword, generateToken, validateInput, hardcodedSecret, xssVulnerable, noReturnPath };
