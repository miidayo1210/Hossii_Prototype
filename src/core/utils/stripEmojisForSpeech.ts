/**
 * Web Speech API 向けに、Unicode の絵文字（Extended_Pictographic）を除いたテキストを返す。
 */
export function stripEmojisForSpeech(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    // 国旗など（Regional Indicator のペア）は Extended_Pictographic に含まれないことがある
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/\u200d/g, '')
    .replace(/\ufe0f/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
