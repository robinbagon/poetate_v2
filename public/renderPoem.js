export function renderPoem(poemText) {
  const poemContentDiv = document.getElementById('poemContent');
  poemContentDiv.innerHTML = '';

  const stanzas = poemText.split(/\n\s*\n/); // split on blank lines
  let wordIndex = 0;

  stanzas.forEach((stanza, stanzaIdx) => {
    const stanzaDiv = document.createElement('div');
    stanzaDiv.classList.add('poem-stanza');

    const lines = stanza.split('\n');
    lines.forEach(line => {
      const lineDiv = document.createElement('div');
      lineDiv.classList.add('poem-line');

      const words = line.split(' ');
      words.forEach((word, idx) => {
        const span = document.createElement('span');
        span.className = 'poem-word';
        span.dataset.wordIndex = wordIndex++;
        span.textContent = word;

        // add space unless last word
        if (idx < words.length - 1) {
          span.textContent += ' ';
        }

        lineDiv.appendChild(span);
      });

      stanzaDiv.appendChild(lineDiv);
    });

    poemContentDiv.appendChild(stanzaDiv);
  });
}
