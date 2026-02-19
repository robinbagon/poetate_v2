// dashboard.js

async function loadDashboard() {
  try {
    // 1. Auth & Usage (Keeping your existing logic here)
    const userResponse = await fetch('/api/auth/user', { credentials: 'include' });
    if (!userResponse.ok) throw new Error('Not logged in');
    const user = await userResponse.json();
    document.getElementById('userEmail').textContent = user.email;

    const usageRes = await fetch('/api/poems/usage', { credentials: 'include' });
    const usage = await usageRes.json();
    const tierInfo = document.getElementById('usage-info');
    if (tierInfo) {
      tierInfo.innerHTML = `<p>Account: ${usage.tier} ⚡ Poems: ${usage.poemsUsed}/${usage.poemsAllowed}</p>`;
    }

    // --- 2. THE CLEAN LIST LOGIC ---

    // Fetch My Poems
    const poemsRes = await fetch('/api/poems/user', { credentials: 'include' });
    const poems = await poemsRes.json();
    renderPoemList(poems, 'poemList', true); 

    // Fetch Shared Poems
    const sharedRes = await fetch('/api/poems/shared-with-me', { credentials: 'include' });
    if (sharedRes.ok) {
      const sharedPoems = await sharedRes.json();
      renderPoemList(sharedPoems, 'sharedPoemList', false);
    }

  } catch (err) {
    console.error('Dashboard load failed:', err);
    window.location.href = '/login.html';
  }
}

// 3. Helper function to render any list of poems
function renderPoemList(list, elementId, isOwner) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = '';

  if (!list || list.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'empty-list-message';
    emptyMsg.textContent = isOwner ? 'Your poems will appear here.' : 'Shared poems will appear here.';
    container.appendChild(emptyMsg);
    return;
  }

  list.forEach(poem => {
    const li = document.createElement('li');
    li.className = 'poem-item';

    const link = document.createElement('a');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    if (isOwner) {
      link.href = `/annotation.html?poemId=${poem._id}`;
    } else {
      const shareLink = poem.shareLinks.find(l => l.mode === 'editable') || 
                        poem.shareLinks.find(l => l.mode === 'readonly');
      link.href = shareLink ? `/share.html?share=${shareLink.id}` : `/annotation.html?poemId=${poem._id}`;
    }
    
    link.className = 'poem-title';
    link.textContent = poem.title || poem.content.split('\n')[0] || '[Untitled]';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'poem-buttons';

    if (isOwner) {
      const renameBtn = createBtn('custom-rename-btn', 'Rename', async () => {
        const newTitle = prompt('New title:', link.textContent);
        if (newTitle && newTitle !== link.textContent) {
          const res = await fetch(`/api/poems/${poem._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title: newTitle })
          });
          if (res.ok) link.textContent = newTitle;
        }
      });

      const deleteBtn = createBtn('custom-delete-btn', 'Delete', async () => {
        if (confirm('Delete this poem?')) {
          const res = await fetch(`/api/poems/${poem._id}`, { method: 'DELETE', credentials: 'include' });
          if (res.ok) li.remove();
        }
      });

      // ✅ FIXED SHARE LOGIC
      const share = async (mode) => {
        try {
          const res = await fetch(`/api/poems/${poem._id}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ mode })
          });

          if (res.status === 401) {
            alert('Your session has expired. Please log in again.');
            window.location.href = '/login.html';
            return;
          }

          if (!res.ok) throw new Error('Failed to generate link');
          const data = await res.json();

          if (data.shareId) {
            navigator.clipboard.writeText(`${window.location.origin}/share.html?share=${data.shareId}`);
            alert(`${mode} link copied!`);
          } else {
            throw new Error('Share ID was undefined');
          }
        } catch (err) {
          console.error('Sharing error:', err);
          alert('Could not generate share link. Please refresh and try again.');
        }
      }; // ✅ Close the share function here

      const eyeBtn = createBtn('custom-eye', 'Copy View Link', () => share('readonly'));
      const pencilBtn = createBtn('custom-pencil', 'Copy Edit Link', () => share('editable'));

      buttonContainer.append(renameBtn, eyeBtn, pencilBtn, deleteBtn);
    } 

    li.append(link, buttonContainer);
    container.appendChild(li);
  });
}

// Mini-helper to create buttons quickly
function createBtn(className, title, onClick) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.title = title;
  // Use addEventListener inside the helper for better scoping
  btn.addEventListener('click', (e) => {
    e.preventDefault(); // Stop any accidental form submissions
    onClick();
  });
  return btn;
}

// --- BUTTON HANDLERS ---

// 🚪 Handle logout
const logoutButton = document.getElementById('logoutButton');
if (logoutButton) {
  logoutButton.onclick = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };
}

// ➕ Handle add poem button
const addPoemButton = document.getElementById('addPoemButton');
if (addPoemButton) {
  addPoemButton.onclick = () => {
    window.location.href = '/index.html';
  };
}

// 🚪 Handle logout & Add Poem (Keep your existing bottom logic)
loadDashboard();