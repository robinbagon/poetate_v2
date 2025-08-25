document.addEventListener('DOMContentLoaded', async () => {
    const contentDiv = document.getElementById('poemContent');
    const urlParams = new URLSearchParams(window.location.search);
    const poemId = urlParams.get('poemId');

    // Fetch poem content
    (async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const poemId = urlParams.get('poemId');
        
        // Ensure poemId exists in the URL
        if (poemId) {
            try {
                // Fetch poem content from the database
                const response = await fetch(`/api/poems/${poemId}`);
                if (!response.ok) throw new Error('Error fetching poem');
                const poem = await response.json();
                contentDiv.innerText = poem.content;
            } catch (error) {
                console.error("Failed to load the poem:", error.message);
                contentDiv.innerText = "Failed to load poem.";
            }
        } else {
            contentDiv.innerText = "Poem not found.";
        }
    })();
});