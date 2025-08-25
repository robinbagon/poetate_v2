// dashboard.js

async function loadDashboard() {
  try {
    const userResponse = await fetch('/api/auth/user', {
      credentials: 'include'
    });
    if (!userResponse.ok) throw new Error('Not logged in');
    const user = await userResponse.json();

    document.getElementById('userEmail').textContent = user.email;

    // ✅ Fetch tier + usage info
    const usageResponse = await fetch('/api/poems/usage', {
      credentials: 'include'
    });
    if (!usageResponse.ok) throw new Error('Failed to fetch usage info');
    const usage = await usageResponse.json();

    const tierInfo = document.getElementById('usage-info');
    if (tierInfo) {
      tierInfo.innerHTML = `
        <p>Account: ${usage.tier}
        ⚡ Poems: ${usage.poemsUsed} / ${usage.poemsAllowed}
        ${
          usage.subscriptionExpiry
            ? `⚡ Renew: ${new Date(
                usage.subscriptionExpiry
              ).toLocaleDateString()}</p>`
            : ''
        }
      `;
    }

    const poemsResponse = await fetch('/api/poems/user', {
      credentials: 'include'
    });

    if (!poemsResponse.ok) {
      throw new Error('Failed to fetch poems');
    }

    const poems = await poemsResponse.json();
    const poemList = document.getElementById('poemList');

    poems.forEach(poem => {
      const li = document.createElement('li');
      li.classList.add('poem-item');

      // Left: Poem title link
      const link = document.createElement('a');
      link.href = `/annotation.html?poemId=${poem._id}`;
      link.textContent = poem.content.split('\n')[0] || '[Untitled Poem]';
      link.className = 'poem-title';

      // Right: Buttons container
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'poem-buttons';

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.title = 'Delete';
      deleteBtn.classList.add('custom-delete-btn');
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this poem?')) {
          try {
            const res = await fetch(`/api/poems/${poem._id}`, { method: 'DELETE' });
            if (res.ok) {
              li.remove();
            } else {
              alert('Failed to delete poem.');
            }
          } catch (err) {
            console.error('Error deleting poem:', err);
          }
        }
      });

      // Read-only share button
      const readOnlyBtn = document.createElement('button');
      readOnlyBtn.title = 'Copy read-only link';
      readOnlyBtn.classList.add('custom-eye');
      readOnlyBtn.addEventListener('click', async () => {
        try {
          const res = await fetch(`/api/poems/${poem._id}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ mode: 'readonly' })
          });

          if (!res.ok) throw new Error('Failed to create share link');
          const data = await res.json();
          const shareLink = `${window.location.origin}/share.html?share=${data.shareId}`;
          await navigator.clipboard.writeText(shareLink);
          alert('Read-only link copied!');
        } catch (err) {
          console.error('Error creating read-only link:', err);
          alert('Failed to copy link.');
        }
      });

      // Editable share button
      const editableBtn = document.createElement('button');
      editableBtn.title = 'Copy editable link';
      editableBtn.classList.add('custom-pencil');
      editableBtn.addEventListener('click', async () => {
        try {
          const res = await fetch(`/api/poems/${poem._id}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ mode: 'editable' })
          });

          if (!res.ok) throw new Error('Failed to create share link');
          const data = await res.json();
          const shareLink = `${window.location.origin}/share.html?share=${data.shareId}`;
          await navigator.clipboard.writeText(shareLink);
          alert('Editable link copied!');
        } catch (err) {
          console.error('Error creating editable link:', err);
          alert('Failed to copy link.');
        }
      });

      buttonContainer.appendChild(readOnlyBtn);
      buttonContainer.appendChild(editableBtn);
      buttonContainer.appendChild(deleteBtn);

      li.appendChild(link);
      li.appendChild(buttonContainer);
      poemList.appendChild(li);
    });

  } catch (err) {
    console.error('Dashboard load failed:', err);
    window.location.href = '/login.html';
  }
}

// 🚪 Handle logout
const logoutButton = document.getElementById('logoutButton');
if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  });
}

// ➕ Handle add poem button
const addPoemButton = document.getElementById('addPoemButton');
if (addPoemButton) {
  addPoemButton.addEventListener('click', () => {
    window.location.href = '/index.html';
  });
}

// 🔁 Load dashboard
loadDashboard();
