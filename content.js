(() => {
  const icx = new ICX();
  
  const toast = (msg) => {
    const div = document.createElement('div');
    div.textContent = msg;
    Object.assign(div.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#1a1a1a',
      color: '#ffffff',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: 'system-ui, sans-serif',
      zIndex: 2147483647,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    });
    document.documentElement.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  };

  // Register basic handlers
  icx.on('ui:show', (params) => {
    toast(params.text || params.message || 'ICX Executed');
    return { ok: true };
  });

  icx.on('ui:link', (params) => {
    if (params.url) window.open(params.url, params.target || '_blank');
    return { ok: true };
  });

  // Style ICX links
  const style = document.createElement('style');
  style.textContent = `
    a[href^="icx://"] {
      text-decoration: underline;
      text-decoration-color: #667eea;
      text-decoration-thickness: 2px;
      cursor: pointer;
    }
    a[href^="icx://"]:hover {
      text-decoration-color: #8b5cf6;
    }
  `;
  document.head.appendChild(style);

  // Decode ICX URL
  const decode = (url) => {
    try {
      const base64 = url.slice(6).replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch (err) {
      console.error('ICX decode error:', err);
      throw new Error('Invalid ICX URL');
    }
  };

  // Execute ICX payload
  const execute = async (payload) => {
    const ops = payload?.cargo?.commands || 
                payload?.operations || 
                payload?.ops || 
                (Array.isArray(payload) ? payload : []);
    
    let executed = 0;
    for (const op of ops) {
      const intent = op.intent || `${op.s}:${op.a}`;
      const params = op.p || op.params || {};
      const result = await icx.resolve(intent, params);
      if (result.ok) executed++;
    }
    
    toast(`ICX: ${executed}/${ops.length} operations executed`);
  };

  // Handle clicks on ICX links
  document.addEventListener('click', async (e) => {
    const link = e.target.closest('a[href^="icx://"]');
    if (!link) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const payload = decode(link.href);
      await execute(payload);
    } catch (err) {
      console.error('ICX error:', err);
      toast(`ICX error: ${err.message}`);
    }
  }, true);
})();