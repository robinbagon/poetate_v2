export function highlightText(offsets) {
  const poemContent = document.getElementById('poemContent');
  const range = document.createRange();
  const textNode = poemContent.childNodes[0];
  range.setStart(textNode, offsets.start);
  range.setEnd(textNode, offsets.end);

  const span = document.createElement('span');
  span.className = 'highlight';
  range.surroundContents(span);
}

export function removeHighlight() {
  const highlight = document.querySelector('.highlight');
  if (highlight) {
    highlight.outerHTML = highlight.innerHTML;
  }
}
