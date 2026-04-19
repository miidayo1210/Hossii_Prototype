/** Arduino シリアル行 → 投稿本文（将来コマンドを足しやすくする） */
export const SERIAL_LINE_TO_MESSAGE: Record<string, string> = {
  Hello: 'こんにちは',
};

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/** trim 後の行が既知コマンドなら投稿用メッセージ、さもなければ null */
export function messageForSerialLine(line: string): string | null {
  const key = line.trim();
  if (key in SERIAL_LINE_TO_MESSAGE) {
    return SERIAL_LINE_TO_MESSAGE[key as keyof typeof SERIAL_LINE_TO_MESSAGE];
  }
  return null;
}

/**
 * ポートから行を読み onLine を呼ぶ。done または signal abort で終了。
 * 読み取り終了後は reader を release する。
 */
export async function readSerialLinesFromPort(
  port: SerialPort,
  signal: AbortSignal,
  onLine: (line: string) => void,
): Promise<void> {
  if (!port.readable) return;

  const reader = port.readable.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const onAbort = () => {
    void reader.cancel();
  };
  signal.addEventListener('abort', onAbort);

  try {
    while (!signal.aborted) {
      let chunk: { done: boolean; value?: Uint8Array };
      try {
        chunk = await reader.read();
      } catch {
        break;
      }
      const { value, done } = chunk;
      if (done) {
        buffer += decoder.decode();
        if (buffer) onLine(buffer);
        break;
      }
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          onLine(part);
        }
      }
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

export async function requestAndOpenSerialPort(options: {
  baudRate?: number;
}): Promise<SerialPort> {
  const baudRate = options.baudRate ?? 9600;
  const serial = navigator.serial;
  if (!serial) {
    throw new Error('Web Serial API is not available');
  }
  const port = await serial.requestPort();
  await port.open({ baudRate });
  return port;
}
