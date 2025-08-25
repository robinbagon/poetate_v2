export function renderPoem(poemText) {
  const poemContentDiv = document.getElementById('poemContent');
  poemContentDiv.innerHTML = '';

  const lines = poemText.split('\n');
  let wordIndex = 0;

  lines.forEach(line => {
    const lineDiv = document.createElement('div');
    lineDiv.classList.add('poem-line');

    const words = line.split(' ');
    words.forEach((word, idx) => {
      const span = document.createElement('span');
      span.className = 'poem-word';
      span.dataset.wordIndex = wordIndex++;
      span.textContent = word;

      // ✅ Add space *inside* span (unless it's the last word)
      if (idx < words.length - 1) {
        span.textContent += ' ';
      }

      lineDiv.appendChild(span);
    });

    poemContentDiv.appendChild(lineDiv);
  });
}
