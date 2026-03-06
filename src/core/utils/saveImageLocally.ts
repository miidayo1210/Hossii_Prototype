/**
 * 画像ファイルをローカル端末に保存する。
 * iOS Safari / PWA では Web Share API を優先し、非対応環境では <a download> にフォールバック。
 * 保存に失敗してもエラーをスローせず、コンソールに記録するだけにとどめる（投稿フローを止めない）。
 */
export async function saveImageLocally(file: File, filename?: string): Promise<void> {
  const name = filename ?? file.name;
  const namedFile = name !== file.name ? new File([file], name, { type: file.type }) : file;

  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [namedFile] })
    ) {
      await navigator.share({ files: [namedFile], title: name });
      return;
    }
  } catch (err) {
    // ユーザーがシェアをキャンセルした場合など（AbortError）は無視
    if (err instanceof Error && err.name !== 'AbortError') {
      console.warn('[saveImageLocally] Web Share API failed:', err);
    }
    return;
  }

  // フォールバック: <a download>（PC ブラウザ・Android Chrome など）
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.warn('[saveImageLocally] <a download> fallback failed:', err);
  }
}
