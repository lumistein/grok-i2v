/* ==========================================
   GROK I2V PERSONAL STUDIO — Application
   ========================================== */

(() => {
  'use strict';

  // ========== State ==========
  const state = {
    apiKey: localStorage.getItem('grok_i2v_api_key') || '',
    imageData: null, // base64 data URI
    imageFileName: '',
    feedItems: JSON.parse(localStorage.getItem('grok_i2v_feed') || '[]'),
    generating: false,
    resolution: localStorage.getItem('grok_i2v_resolution') || '720p',
    columns: parseInt(localStorage.getItem('grok_i2v_columns') || '1', 10),
    activePollIds: new Map(), // requestId -> intervalId
  };

  // ========== DOM Refs ==========
  const $ = (id) => document.getElementById(id);
  const el = {
    apiKeyInput: $('apiKeyInput'),
    saveApiKey: $('saveApiKey'),
    toggleApiKey: $('toggleApiKey'),
    apiKeyHint: $('apiKeyHint'),
    imageUploadZone: $('imageUploadZone'),
    uploadPlaceholder: $('uploadPlaceholder'),
    imagePreview: $('imagePreview'),
    clearImageBtn: $('clearImageBtn'),
    imageFileInput: $('imageFileInput'),
    pasteImageBtn: $('pasteImageBtn'),
    promptInput: $('promptInput'),
    durationSlider: $('durationSlider'),
    durationValue: $('durationValue'),
    aspectRatioSelect: $('aspectRatioSelect'),
    resolutionControl: $('resolutionControl'),
    settingsToggle: $('settingsToggle'),
    settingsContent: $('settingsContent'),
    generateBtn: $('generateBtn'),
    generateContent: $('generateContent'),
    generateLoading: $('generateLoading'),
    generateProgress: $('generateProgress'),
    feedGrid: $('feedGrid'),
    emptyState: $('emptyState'),
    statusPill: $('statusPill'),
    statusText: $('statusText'),
    lightbox: $('lightbox'),
    lightboxBackdrop: $('lightboxBackdrop'),
    lightboxVideo: $('lightboxVideo'),
    lightboxDownload: $('lightboxDownload'),
    lightboxClose: $('lightboxClose'),
    clearFeedBtn: $('clearFeedBtn'),
    toastContainer: $('toastContainer'),
  };

  // ========== Toast ==========
  function toast(message, type = 'info') {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
    el.toastContainer.appendChild(t);
    setTimeout(() => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 200); }, 4000);
  }

  // ========== Status ==========
  function setStatus(text, mode = 'ready') {
    el.statusText.textContent = text;
    el.statusPill.className = `status-pill ${mode}`;
  }

  // Cryptographic helpers for PKCE
  function dec2hex(dec) {
    return ('0' + dec.toString(16)).substr(-2);
  }

  function generateVerifier() {
    const array = new Uint32Array(56);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec2hex).join('');
  }

  async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  }

  function base64urlencode(a) {
    let str = "";
    const bytes = new Uint8Array(a);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async function generateChallenge(verifier) {
    const hashed = await sha256(verifier);
    return base64urlencode(hashed);
  }

  // ========== API Key & OAuth Login ==========
  function initApiKey() {
    const elTabs = {
      tabGrokLogin: $('tabGrokLogin'),
      tabApiKey: $('tabApiKey'),
      grokLoginContainer: $('grokLoginContainer'),
      apiKeyContainer: $('apiKeyContainer'),
      btnGrokLogin: $('btnGrokLogin'),
      authCodeWrap: $('authCodeWrap'),
      authCodeInput: $('authCodeInput'),
      btnCompleteLogin: $('btnCompleteLogin'),
      grokLoginHint: $('grokLoginHint'),
    };

    // Tab switching
    elTabs.tabGrokLogin.addEventListener('click', () => {
      elTabs.tabGrokLogin.classList.add('active');
      elTabs.tabGrokLogin.style.background = 'rgba(255,255,255,0.1)';
      elTabs.tabGrokLogin.style.color = '#fff';
      
      elTabs.tabApiKey.classList.remove('active');
      elTabs.tabApiKey.style.background = 'transparent';
      elTabs.tabApiKey.style.color = 'rgba(255,255,255,0.4)';
      
      elTabs.grokLoginContainer.style.display = 'block';
      elTabs.apiKeyContainer.style.display = 'none';
    });

    elTabs.tabApiKey.addEventListener('click', () => {
      elTabs.tabApiKey.classList.add('active');
      elTabs.tabApiKey.style.background = 'rgba(255,255,255,0.1)';
      elTabs.tabApiKey.style.color = '#fff';
      
      elTabs.tabGrokLogin.classList.remove('active');
      elTabs.tabGrokLogin.style.background = 'transparent';
      elTabs.tabGrokLogin.style.color = 'rgba(255,255,255,0.4)';
      
      elTabs.apiKeyContainer.style.display = 'block';
      elTabs.grokLoginContainer.style.display = 'none';
    });

    // Populate saved credentials
    if (state.apiKey) {
      if (state.apiKey.startsWith('xai-')) {
        // Switch to API Key tab
        elTabs.tabApiKey.click();
        el.apiKeyInput.value = state.apiKey;
      } else {
        // Assume OAuth token (Grok Login)
        elTabs.tabGrokLogin.click();
        elTabs.authCodeWrap.style.display = 'flex';
        elTabs.authCodeInput.value = '••••••••••••••••••••';
        elTabs.grokLoginHint.textContent = 'Grok 계정 로그인 연동됨 ✓';
        elTabs.grokLoginHint.style.color = 'var(--accent)';
      }
    }

    // Mode 1: OAuth Login Initiate
    elTabs.btnGrokLogin.addEventListener('click', (e) => {
      // Prevent default action and stop event propagation
      e.preventDefault();
      e.stopPropagation();

      // Open a blank window immediately inside the synchronous click context with empty URL
      const loginWindow = window.open('', '_blank');
      if (!loginWindow) {
        toast('팝업이 차단되었습니다! 브라우저 설정이나 주소창 옆 아이콘에서 팝업을 허용해 주세요.', 'error');
        return;
      }

      // Show temporary loading indicator in the new window
      try {
        loginWindow.document.write(`
          <html>
            <head>
              <title>Connecting to xAI...</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff; margin: 0; }
                .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem; }
                @keyframes spin { to { transform: rotate(360deg); } }
              </style>
            </head>
            <body>
              <div class="spinner"></div>
              <h2>Connecting to xAI...</h2>
              <p style="color: #888; font-size: 0.9rem;">Establishing secure PKCE connection</p>
            </body>
          </html>
        `);
      } catch (err) {
        // Safe fallback if document.write is blocked
      }

      (async () => {
        try {
          const verifier = generateVerifier();
          localStorage.setItem('grok_oauth_verifier', verifier);
          
          const challenge = await generateChallenge(verifier);
          const stateStr = Math.random().toString(36).substring(2, 15);
          const nonce = Math.random().toString(36).substring(2, 15);
          
          const consentUrl = `https://accounts.x.ai/sign-in?redirect=oauth2-provider&return_to=${encodeURIComponent(
            `/oauth2/consent?response_type=code&client_id=b1a00492-073a-47ea-816f-4c329264a828&redirect_uri=http://127.0.0.1:38769/callback&scope=openid profile email offline_access grok-cli:access api:access&state=${stateStr}&code_challenge=${challenge}&code_challenge_method=S256&nonce=${nonce}&referrer=banana-grok`
          )}`;
          
          // Redirect the blank window to the authorization URL
          loginWindow.location.href = consentUrl;
          
          // Show auth code input field
          elTabs.authCodeWrap.style.display = 'flex';
          elTabs.authCodeInput.value = '';
          elTabs.authCodeInput.focus();
          elTabs.grokLoginHint.textContent = '로그인 완료 후 생성된 코드를 아래에 입력하세요.';
          elTabs.grokLoginHint.style.color = 'rgba(255, 255, 255, 0.6)';
          toast('xAI 로그인 창이 열렸습니다. 인증 후 코드를 복사해 주세요.', 'info');
        } catch (err) {
          console.error('Login initiation failed:', err);
          loginWindow.close();
          toast('로그인 요청 생성 실패', 'error');
        }
      })();
    });



    // Mode 1: OAuth Complete (Token exchange)
    elTabs.btnCompleteLogin.addEventListener('click', async () => {
      const code = elTabs.authCodeInput.value.trim();
      const verifier = localStorage.getItem('grok_oauth_verifier');
      
      if (!code) { toast('인증 코드를 입력해 주세요.', 'warning'); return; }
      if (code === '••••••••••••••••••••') { toast('이미 로그인 연동이 완료되어 있습니다.', 'info'); return; }
      if (!verifier) { toast('로그인 세션 정보가 없습니다. 다시 로그인을 진행해 주세요.', 'error'); return; }
      
      try {
        elTabs.btnCompleteLogin.disabled = true;
        elTabs.grokLoginHint.textContent = '인증 토큰 교환 중...';
        
        const resp = await fetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, code_verifier: verifier }),
        });
        
        const data = await resp.json();
        elTabs.btnCompleteLogin.disabled = false;
        
        if (!resp.ok) {
          throw new Error(data.error || 'Token exchange failed');
        }
        
        const accessToken = data.access_token;
        state.apiKey = accessToken;
        localStorage.setItem('grok_i2v_api_key', accessToken);
        
        elTabs.authCodeInput.value = '••••••••••••••••••••';
        elTabs.grokLoginHint.textContent = 'Grok 계정 로그인 연동 성공 ✓';
        elTabs.grokLoginHint.style.color = 'var(--accent)';
        toast('Grok 계정이 성공적으로 연동되었습니다!', 'success');
        updateGenerateBtn();
      } catch (err) {
        console.error('Auth completion failed:', err);
        elTabs.grokLoginHint.textContent = `연동 실패: ${err.message}`;
        elTabs.grokLoginHint.style.color = 'var(--error)';
        toast(`연동 실패: ${err.message}`, 'error');
      }
    });

    // Mode 2: Manual API Key Save
    el.saveApiKey.addEventListener('click', () => {
      const key = el.apiKeyInput.value.trim();
      if (!key) { toast('Please enter an API key', 'warning'); return; }
      state.apiKey = key;
      localStorage.setItem('grok_i2v_api_key', key);
      toast('API key saved', 'success');
      updateGenerateBtn();
    });
  }

  // ========== Image Upload ==========
  function initImageUpload() {
    // Click upload
    el.imageUploadZone.addEventListener('click', (e) => {
      if (e.target.closest('.btn-clear-image')) return;
      if (!state.imageData) el.imageFileInput.click();
    });

    // File input change
    el.imageFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) loadImageFile(file);
      e.target.value = '';
    });

    // Drag & Drop
    el.imageUploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.imageUploadZone.classList.add('dragover');
    });

    el.imageUploadZone.addEventListener('dragleave', () => {
      el.imageUploadZone.classList.remove('dragover');
    });

    el.imageUploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      el.imageUploadZone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file?.type?.startsWith('image/')) loadImageFile(file);
    });

    // Clear
    el.clearImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearImage();
    });

    // Paste button
    el.pasteImageBtn.addEventListener('click', async () => {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find(t => t.startsWith('image/'));
          if (!imageType) continue;
          const blob = await item.getType(imageType);
          const ext = imageType.split('/')[1] || 'png';
          const file = new File([blob], `pasted.${ext}`, { type: imageType });
          loadImageFile(file);
          toast('Image pasted from clipboard', 'success');
          return;
        }
        toast('No image in clipboard', 'warning');
      } catch (err) {
        toast('Clipboard access denied', 'error');
      }
    });

    // Global paste
    document.addEventListener('paste', (e) => {
      const file = e.clipboardData?.files?.[0];
      if (file?.type?.startsWith('image/')) {
        loadImageFile(file);
        toast('Image pasted', 'info');
      }
    });
  }

  function loadImageFile(file) {
    if (!file.type.startsWith('image/')) { toast('Not a valid image file', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { toast('Image too large (max 20MB)', 'error'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      state.imageData = e.target.result;
      state.imageFileName = file.name;
      showImage(e.target.result);
      updateGenerateBtn();
    };
    reader.readAsDataURL(file);
  }

  function showImage(src) {
    el.imagePreview.src = src;
    el.imagePreview.style.display = 'block';
    el.uploadPlaceholder.style.display = 'none';
    el.clearImageBtn.style.display = 'flex';
    el.imageUploadZone.classList.add('has-image');
  }

  function clearImage() {
    state.imageData = null;
    state.imageFileName = '';
    el.imagePreview.src = '';
    el.imagePreview.style.display = 'none';
    el.uploadPlaceholder.style.display = 'flex';
    el.clearImageBtn.style.display = 'none';
    el.imageUploadZone.classList.remove('has-image');
    updateGenerateBtn();
  }

  // ========== Settings ==========
  function initSettings() {
    // Duration slider
    el.durationSlider.addEventListener('input', () => {
      el.durationValue.textContent = el.durationSlider.value + 's';
    });

    // Resolution segmented control
    el.resolutionControl.querySelectorAll('.seg-btn').forEach(btn => {
      if (btn.dataset.value === state.resolution) {
        el.resolutionControl.querySelector('.seg-btn.active')?.classList.remove('active');
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        el.resolutionControl.querySelector('.seg-btn.active')?.classList.remove('active');
        btn.classList.add('active');
        state.resolution = btn.dataset.value;
        localStorage.setItem('grok_i2v_resolution', state.resolution);
      });
    });

    // Settings toggle
    el.settingsToggle.addEventListener('click', () => {
      const collapsed = !el.settingsContent.classList.contains('collapsed');
      el.settingsContent.classList.toggle('collapsed', collapsed);
      el.settingsToggle.classList.toggle('collapsed', collapsed);
    });

    // Column controls
    document.querySelectorAll('.col-btn').forEach(btn => {
      if (parseInt(btn.dataset.cols) === state.columns) {
        document.querySelector('.col-btn.active')?.classList.remove('active');
        btn.classList.add('active');
        el.feedGrid.dataset.cols = state.columns;
      }
      btn.addEventListener('click', () => {
        document.querySelector('.col-btn.active')?.classList.remove('active');
        btn.classList.add('active');
        el.feedGrid.dataset.cols = btn.dataset.cols;
        state.columns = parseInt(btn.dataset.cols);
        localStorage.setItem('grok_i2v_columns', state.columns);
      });
    });

    // Clear feed
    el.clearFeedBtn.addEventListener('click', () => {
      if (!state.feedItems.length) return;
      if (confirm('Clear all videos from the feed?')) {
        state.feedItems = [];
        saveFeed();
        renderFeed();
      }
    });
  }

  // ========== Generate ==========
  function updateGenerateBtn() {
    const canGenerate = state.apiKey && state.imageData && !state.generating;
    el.generateBtn.disabled = !canGenerate;
  }

  function initGenerate() {
    el.generateBtn.addEventListener('click', () => {
      if (state.generating) return;
      generateVideo();
    });
  }

  async function generateVideo() {
    if (!state.apiKey) { toast('Please set your API key first', 'warning'); return; }
    if (!state.imageData) { toast('Please upload a reference image', 'warning'); return; }

    const prompt = el.promptInput.value.trim() || 'Animate this image with natural, cinematic motion';
    const duration = parseInt(el.durationSlider.value, 10);
    const resolution = state.resolution;
    const aspectRatio = el.aspectRatioSelect.value;

    state.generating = true;
    el.generateContent.style.display = 'none';
    el.generateLoading.style.display = 'flex';
    el.generateProgress.textContent = 'Submitting...';
    el.generateBtn.disabled = true;
    setStatus('Submitting...', 'generating');

    // Create a placeholder card
    const placeholderId = 'gen_' + Date.now();
    const cardData = {
      id: placeholderId,
      prompt,
      duration,
      resolution,
      aspectRatio,
      status: 'generating',
      createdAt: new Date().toISOString(),
      videoUrl: null,
      requestId: null,
    };
    state.feedItems.unshift(cardData);
    renderFeed();

    try {
      // Build request body
      const body = {
        model: 'grok-imagine-video',
        prompt,
        image: { url: state.imageData }, // base64 data URI
        duration,
        resolution,
      };
      if (aspectRatio !== 'auto') body.aspect_ratio = aspectRatio;

      const resp = await fetch('/api/videos/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': state.apiKey,
        },
        body: JSON.stringify(body),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error?.message || data.error || `HTTP ${resp.status}`);
      }

      const requestId = data.request_id || data.id;
      if (!requestId) throw new Error('No request_id returned');

      cardData.requestId = requestId;
      saveFeed();

      // Start polling
      pollForResult(placeholderId, requestId);
    } catch (err) {
      console.error('Generate error:', err);
      cardData.status = 'error';
      cardData.error = err.message;
      saveFeed();
      renderFeed();
      toast(`Generation failed: ${err.message}`, 'error');
      finishGenerating();
    }
  }

  function pollForResult(cardId, requestId) {
    const startTime = Date.now();
    let pollCount = 0;
    let errorCount = 0;
    const MAX_ERRORS = 8;

    const poll = async () => {
      pollCount++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      el.generateProgress.textContent = `Generating... ${elapsed}s`;
      setStatus(`Generating (${elapsed}s)`, 'generating');

      // Update elapsed on card
      const cardEl = document.querySelector(`[data-card-id="${cardId}"] .generating-elapsed`);
      if (cardEl) cardEl.textContent = formatTime(elapsed);

      try {
        const resp = await fetch(`/api/videos/${requestId}`, {
          headers: { 'x-api-key': state.apiKey },
        });

        const data = await resp.json();
        errorCount = 0;

        if (data.status === 'done' || data.state === 'done') {
          // Video ready!
          const videoUrl = data.video?.url || data.result_url || data.url || data.output?.url;
          const card = state.feedItems.find(f => f.id === cardId);
          if (card) {
            card.status = 'done';
            card.videoUrl = videoUrl;
          }
          saveFeed();
          renderFeed();
          finishGenerating();
          toast('Video generated successfully!', 'success');
          return;
        }

        if (data.status === 'failed' || data.state === 'failed') {
          throw new Error(data.error?.message || data.error || 'Video generation failed');
        }

        // Still processing — keep polling
        const delay = pollCount < 10 ? 3000 : pollCount < 30 ? 5000 : 8000;
        state.activePollIds.set(requestId, setTimeout(poll, delay));
      } catch (err) {
        errorCount++;
        if (errorCount >= MAX_ERRORS) {
          const card = state.feedItems.find(f => f.id === cardId);
          if (card) {
            card.status = 'error';
            card.error = err.message;
          }
          saveFeed();
          renderFeed();
          finishGenerating();
          toast(`Generation failed: ${err.message}`, 'error');
          return;
        }
        // Retry
        state.activePollIds.set(requestId, setTimeout(poll, 5000));
      }
    };

    poll();
  }

  function finishGenerating() {
    state.generating = false;
    el.generateContent.style.display = 'flex';
    el.generateLoading.style.display = 'none';
    updateGenerateBtn();
    setStatus('Ready', 'ready');
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  // ========== Feed ==========
  function saveFeed() {
    // Don't save base64 image data in feed to avoid huge localStorage
    const cleanedFeed = state.feedItems.map(item => {
      const clean = { ...item };
      return clean;
    });
    try {
      localStorage.setItem('grok_i2v_feed', JSON.stringify(cleanedFeed));
    } catch (e) {
      console.warn('Feed too large for localStorage, trimming...');
      state.feedItems = state.feedItems.slice(0, 20);
      localStorage.setItem('grok_i2v_feed', JSON.stringify(state.feedItems));
    }
  }

  function renderFeed() {
    el.feedGrid.innerHTML = '';
    el.emptyState.classList.toggle('hidden', state.feedItems.length > 0);

    state.feedItems.forEach(item => {
      const card = document.createElement('div');
      card.className = `feed-card${item.status === 'generating' ? ' generating' : ''}`;
      card.dataset.cardId = item.id;

      if (item.status === 'generating') {
        card.innerHTML = `
          <div class="feed-card-generating">
            <div class="generating-spinner"></div>
            <div class="generating-text">Generating video...</div>
            <div class="generating-elapsed">${formatTime(0)}</div>
          </div>
          <div class="feed-card-info">
            <div class="feed-card-prompt">${escapeHtml(item.prompt)}</div>
            <div class="feed-card-meta">
              <div class="feed-card-tags">
                <span class="meta-tag">${item.duration}s</span>
                <span class="meta-tag">${item.resolution}</span>
                ${item.aspectRatio !== 'auto' ? `<span class="meta-tag">${item.aspectRatio}</span>` : ''}
              </div>
            </div>
          </div>`;
      } else if (item.status === 'error') {
        card.innerHTML = `
          <div class="feed-card-generating" style="background: rgba(248,113,113,0.05);">
            <i class="fa-solid fa-circle-xmark" style="font-size:2rem;color:var(--error);"></i>
            <div class="generating-text" style="color:var(--error);">Failed</div>
            <div class="generating-elapsed" style="color:var(--text-tertiary);font-size:0.7rem;max-width:80%;text-align:center;">${escapeHtml(item.error || 'Unknown error')}</div>
          </div>
          <div class="feed-card-info">
            <div class="feed-card-prompt">${escapeHtml(item.prompt)}</div>
            <div class="feed-card-meta">
              <div class="feed-card-tags">
                <span class="meta-tag">${item.duration}s</span>
                <span class="meta-tag">${item.resolution}</span>
              </div>
              <div class="feed-card-actions">
                <button class="card-action-btn delete" title="Remove" data-action="delete" data-id="${item.id}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>`;
      } else if (item.status === 'done' && item.videoUrl) {
        const videoSrc = getVideoSrc(item.videoUrl);
        card.innerHTML = `
          <div class="feed-card-video" data-action="play" data-url="${escapeAttr(videoSrc)}" data-original-url="${escapeAttr(item.videoUrl)}">
            <video muted loop playsinline preload="metadata" crossorigin="anonymous">
              <source src="${escapeAttr(videoSrc)}" type="video/mp4">
            </video>
            <div class="card-play-overlay"><i class="fa-solid fa-expand"></i></div>
          </div>
          <div class="feed-card-info">
            <div class="feed-card-prompt">${escapeHtml(item.prompt)}</div>
            <div class="feed-card-meta">
              <div class="feed-card-tags">
                <span class="meta-tag">${item.duration}s</span>
                <span class="meta-tag">${item.resolution}</span>
                ${item.aspectRatio && item.aspectRatio !== 'auto' ? `<span class="meta-tag">${item.aspectRatio}</span>` : ''}
              </div>
              <div class="feed-card-actions">
                <button class="card-action-btn" title="Download" data-action="download" data-url="${escapeAttr(item.videoUrl)}">
                  <i class="fa-solid fa-download"></i>
                </button>
                <button class="card-action-btn delete" title="Remove" data-action="delete" data-id="${item.id}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>`;

        // Auto-play on hover + fallback to proxy if direct URL fails
        const videoEl = card.querySelector('video');
        if (videoEl) {
          videoEl.addEventListener('error', () => {
            const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(item.videoUrl)}`;
            if (videoEl.querySelector('source')?.src !== proxyUrl) {
              videoEl.querySelector('source').src = proxyUrl;
              videoEl.load();
            }
          }, { once: true });
          card.querySelector('.feed-card-video').addEventListener('mouseenter', () => videoEl.play().catch(() => {}));
          card.querySelector('.feed-card-video').addEventListener('mouseleave', () => { videoEl.pause(); videoEl.currentTime = 0; });
        }
      }

      el.feedGrid.appendChild(card);
    });

    // Bind actions
    el.feedGrid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        if (action === 'delete') {
          const id = btn.dataset.id;
          state.feedItems = state.feedItems.filter(f => f.id !== id);
          saveFeed();
          renderFeed();
        } else if (action === 'play') {
          openLightbox(btn.dataset.url);
        } else if (action === 'download') {
          e.stopPropagation();
          downloadVideo(btn.dataset.url);
        }
      });
    });
  }

  // ========== Lightbox ==========
  function initLightbox() {
    el.lightboxBackdrop.addEventListener('click', closeLightbox);
    el.lightboxClose.addEventListener('click', closeLightbox);
    el.lightboxDownload.addEventListener('click', () => {
      downloadVideo(el.lightboxVideo.src);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el.lightbox.style.display !== 'none') closeLightbox();
    });
  }

  function openLightbox(videoUrl) {
    el.lightboxVideo.src = videoUrl;
    el.lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    el.lightboxVideo.pause();
    el.lightboxVideo.src = '';
    el.lightbox.style.display = 'none';
    document.body.style.overflow = '';
  }

  // Resolve video source: try direct URL, proxy is used as fallback on error
  function getVideoSrc(originalUrl) {
    // xAI video URLs are typically publicly accessible signed URLs
    // Try direct first; <video> error handler falls back to proxy
    return originalUrl;
  }

  async function downloadVideo(url) {
    try {
      toast('Downloading video...', 'info');
      // Try direct download first
      let resp;
      try {
        resp = await fetch(url, { mode: 'cors' });
      } catch {
        // CORS blocked — use proxy
        resp = await fetch(`/api/proxy-video?url=${encodeURIComponent(url)}`);
      }
      if (!resp.ok) {
        // Fallback to proxy on non-ok response
        resp = await fetch(`/api/proxy-video?url=${encodeURIComponent(url)}`);
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `grok_i2v_${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Download complete', 'success');
    } catch (err) {
      toast(`Download failed: ${err.message}`, 'error');
    }
  }

  // ========== Utilities ==========
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ========== Init ==========
  function init() {
    initApiKey();
    initImageUpload();
    initSettings();
    initGenerate();
    initLightbox();
    updateGenerateBtn();
    setStatus('Ready', 'ready');
    renderFeed();

    // Restore settings
    el.feedGrid.dataset.cols = state.columns;
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
