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
        link.className = 'poem-title';
        
        // ✅ 1. Set the Title Text FIRST
        link.textContent = poem.title || poem.content.split('\n')[0] || '[Untitled]';

        if (isOwner) {
            link.href = `/annotation.html?poemId=${poem._id}`;
        } else {
            // ✅ 2. Handle the Badge for Shared Poems
            const badge = document.createElement('span');
            badge.className = 'permission-badge';
            
            if (poem.myMode === 'editable') {
                badge.textContent = 'Editor';
                badge.classList.add('badge-editable');
            } else {
                badge.textContent = 'Read Only';
                badge.classList.add('badge-readonly');
            }

            // ✅ 3. Append the badge AFTER the text is set
            link.appendChild(badge);

            // Persistent Link Logic
            if (poem.activeShareId) {
                link.href = `/share.html?share=${poem.activeShareId}`;
            } else {
                link.href = `/annotation.html?poemId=${poem._id}`;
            }
        } // End isOwner check

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'poem-buttons';

        if (isOwner) {
            const renameBtn = createBtn('custom-rename-btn', 'Rename', async () => {
                const newTitle = prompt('New title:', link.firstChild.textContent);
                if (newTitle && newTitle !== link.firstChild.textContent) {
                    const res = await fetch(`/api/poems/${poem._id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ title: newTitle })
                    });
                    if (res.ok) link.firstChild.textContent = newTitle;
                }
            });

            const share = async (mode) => {
    try {
        const res = await fetch(`/api/poems/${poem._id}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ mode })
        });
        
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        
        navigator.clipboard.writeText(`${window.location.origin}/share.html?share=${data.shareId}`);

        // ✅ Format the label for the alert
        // "readonly" becomes "Read-only", "editable" becomes "Editable"
        const displayMode = mode === 'readonly' 
            ? 'Read-only' 
            : mode.charAt(0).toUpperCase() + mode.slice(1);

        alert(`${displayMode} link copied!`);
        
    } catch (err) { 
        alert('Error sharing'); 
    }
};

            const deleteBtn = createBtn('custom-delete-btn', 'Delete', async () => {
                if (confirm('Delete this poem?')) {
                    const res = await fetch(`/api/poems/${poem._id}`, { method: 'DELETE', credentials: 'include' });
                    if (res.ok) li.remove();
                }
            });

            buttonContainer.append(renameBtn, createBtn('custom-eye', 'View Link', () => share('readonly')), createBtn('custom-pencil', 'Edit Link', () => share('editable')), deleteBtn);
        } else {
            const removeBtn = createBtn('custom-delete-btn', 'Remove from list', async () => {
                if (confirm('Remove this shared poem?')) {
                    const res = await fetch(`/api/poems/shared/${poem._id}`, { method: 'DELETE', credentials: 'include' });
                    if (res.ok) li.remove();
                }
            });
            buttonContainer.append(removeBtn);
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