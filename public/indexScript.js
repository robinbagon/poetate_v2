// Only execute this section if the form element exists (index page)
const form = document.getElementById('poemForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('content').value.trim();

    if (!content) {
      alert('Please enter a poem before submitting.');
      return;
    }

    // Disable the submit button to prevent multiple submissions
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
      const response = await fetch('/api/poems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save poem: ${response.statusText}`);
      }

      const poem = await response.json();

      if (poem && poem._id) {

      const authRes = await fetch('/api/auth/user');
        
        if (authRes.status === 401) {
            // User is a guest! Save this ID in their browser memory
            // so they can "claim" it when they log in or register.
            localStorage.setItem('pendingPoemId', poem._id);
            console.log('Anonymous poem detected. ID stored for later claim.');
        }
        // Redirect to annotation page with poem ID
        window.location.href = 'annotation.html?poemId=' + poem._id;
      } else {
        throw new Error('Poem ID not found in the response.');
      }
    } catch (error) {
      console.error('Failed to save the poem:', error.message);
      alert('Failed to save the poem. Please try again.');
    } finally {
      // Re-enable the submit button
      submitButton.disabled = false;
      submitButton.textContent = 'Submit';
    }
  });
}