// --- Theme Toggle ---
const html = document.documentElement;
const iconMoon = document.getElementById('icon-moon');
const iconSun = document.getElementById('icon-sun');

function syncIcons() {
  const dark = html.classList.contains('dark');
  iconMoon.classList.toggle('hidden', dark);
  iconSun.classList.toggle('hidden', !dark);
}
syncIcons();

document.getElementById('theme-toggle').addEventListener('click', () => {
  html.classList.toggle('dark');
  localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
  syncIcons();
});

// --- Crypto ---
function b64Encode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64Decode(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
function b64urlEncode(buf) {
  return b64Encode(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return b64Decode(str);
}

async function encryptSecret(plaintext) {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)
  );
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return {
    encryptedSecret: b64Encode(ciphertext),
    iv: b64Encode(iv),
    keyFragment: b64urlEncode(rawKey),
  };
}

async function decryptSecret(encryptedSecretB64, ivB64, keyFragment) {
  const key = await crypto.subtle.importKey(
    'raw', b64urlDecode(keyFragment), { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64Decode(ivB64) }, key, b64Decode(encryptedSecretB64)
  );
  return new TextDecoder().decode(plaintext);
}

// --- Routing ---
function getRoute() {
  const m = window.location.pathname.match(/^\/s\/([0-9a-f-]{36})$/i);
  if (m) return { type: 'receive', id: m[1], key: window.location.hash.slice(1) };
  return { type: 'create' };
}

function show(viewId) {
  ['view-create', 'view-result', 'view-receive', 'view-notfound'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', id !== viewId);
  });
}

function goHome() {
  history.pushState({}, '', '/');
  document.getElementById('secret-input').value = '';
  document.getElementById('description-input').value = '';
  document.getElementById('create-error').classList.add('hidden');
  show('view-create');
}

// --- Share Handler ---
document.getElementById('btn-share').addEventListener('click', async () => {
  const plaintext = document.getElementById('secret-input').value.trim();
  const days = parseInt(document.getElementById('expiry-select').value);
  const errEl = document.getElementById('create-error');
  const btn = document.getElementById('btn-share');

  errEl.classList.add('hidden');

  if (!plaintext) {
    errEl.textContent = 'Please enter a secret.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Encrypting…';

  try {
    const description = document.getElementById('description-input').value.trim();
    const payload = JSON.stringify({ secret: plaintext, description });
    const { encryptedSecret, iv, keyFragment } = await encryptSecret(payload);
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encryptedSecret, iv, days }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Server error');
    const { id } = await res.json();
    document.getElementById('result-url').value = `${location.origin}/s/${id}#${keyFragment}`;
    show('view-result');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Encrypt & Share';
  }
});

// --- Copy Handler ---
document.getElementById('btn-copy').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('result-url').value).then(() => {
    document.getElementById('copy-icon').classList.add('hidden');
    document.getElementById('check-icon').classList.remove('hidden');
    document.getElementById('copy-label').textContent = 'Copied!';
    setTimeout(() => {
      document.getElementById('copy-icon').classList.remove('hidden');
      document.getElementById('check-icon').classList.add('hidden');
      document.getElementById('copy-label').textContent = 'Copy';
    }, 2000);
  });
});

document.getElementById('btn-new').addEventListener('click', goHome);
document.getElementById('btn-notfound-home').addEventListener('click', goHome);

// --- Reveal Handler ---
document.getElementById('btn-reveal').addEventListener('click', async () => {
  const route = getRoute();
  const errEl = document.getElementById('receive-error');
  const btn = document.getElementById('btn-reveal');

  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Loading…';

  try {
    const res = await fetch(`/api/shares/${route.id}`);
    if (res.status === 404) { show('view-notfound'); return; }
    if (!res.ok) throw new Error((await res.json()).error || 'Server error');
    const { encryptedSecret, iv } = await res.json();
    const raw = await decryptSecret(encryptedSecret, iv, route.key);
    const { secret, description } = JSON.parse(raw);
    document.getElementById('secret-text').textContent = secret;
    if (description) {
      document.getElementById('description-text').textContent = description;
      document.getElementById('description-output').classList.remove('hidden');
    }
    document.getElementById('decrypted-output').classList.remove('hidden');
    btn.classList.add('hidden');
  } catch (e) {
    errEl.textContent = 'Decryption failed: ' + e.message;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Reveal Secret';
  }
});

// --- Init ---
const route = getRoute();
show(route.type === 'receive' ? (route.key ? 'view-receive' : 'view-notfound') : 'view-create');
