import type { InputHTMLAttributes } from 'react';

type NicknameInputAntiAutofillProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'autoComplete' | 'name' | 'autoCorrect' | 'spellCheck'
> & {
  'data-form-type'?: string;
  'data-lpignore'?: string;
};

/** ニックネーム入力でブラウザの氏名・カード等の自動入力提案を抑止する */
export const nicknameInputAntiAutofillProps: NicknameInputAntiAutofillProps = {
  autoComplete: 'off',
  name: 'hossii-nickname',
  autoCorrect: 'off',
  spellCheck: false,
  'data-form-type': 'other',
  'data-lpignore': 'true',
};
