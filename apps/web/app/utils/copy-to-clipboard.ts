type ClipboardDependencies = {
  writeText?: (text: string) => Promise<void>;
  legacyCopy?: (text: string) => boolean;
};

const copyWithExecCommand = (text: string): boolean => {
  const documentRef = globalThis.document;

  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') {
    return false;
  }

  const textarea = documentRef.createElement('textarea');
  const activeElement = documentRef.activeElement as HTMLElement | null;

  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  documentRef.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return documentRef.execCommand('copy');
  } finally {
    textarea.remove();
    activeElement?.focus();
  }
};

export const copyToClipboard = async (
  text: string,
  dependencies: ClipboardDependencies = {},
): Promise<void> => {
  const writeText =
    dependencies.writeText ??
    globalThis.navigator?.clipboard?.writeText.bind(globalThis.navigator.clipboard);
  const legacyCopy = dependencies.legacyCopy ?? copyWithExecCommand;

  if (writeText) {
    try {
      await writeText(text);
      return;
    } catch {
      // Fall back for denied permissions and partially supported WebViews.
    }
  }

  if (!legacyCopy(text)) {
    throw new Error('Clipboard is unavailable');
  }
};
