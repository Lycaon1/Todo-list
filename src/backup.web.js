// Web / home-screen app version. Must start sharing straight from the button tap
// (no awaits before navigator.share), or Safari blocks it.
export function saveBackupFile(filename, text) {
  const file = new File([text], filename, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    return navigator
      .share({ files: [file], title: filename })
      .then(() => 'saved')
      .catch((e) => (e && e.name === 'AbortError' ? 'canceled' : download(file, filename)));
  }
  return Promise.resolve(download(file, filename));
}

function download(file, filename) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
}

// Resolves with the file's text, or null if nothing was chosen
export function pickBackupFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/plain';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) resolve(null);
      else file.text().then(resolve, reject);
    };
    input.click();
  });
}
