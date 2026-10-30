// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createAnswerInput } from '../src/widgets/answerInput.js';

function make() {
  const onSubmit = vi.fn();
  const c = createAnswerInput({ placeholder: 'p', submitLabel: 'Go', maxLength: 10, onSubmit });
  const input = c.el.querySelector('input') as HTMLInputElement;
  const btn = c.el.querySelector('button') as HTMLButtonElement;
  return { c, input, btn, onSubmit };
}

describe('answerInput', () => {
  it('Enter submits trimmed text', () => {
    const { input, onSubmit } = make();
    input.value = '  hi ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onSubmit).toHaveBeenCalledWith('hi');
  });
  it('does not submit empty', () => {
    const { input, btn, onSubmit } = make();
    input.value = '   ';
    btn.click();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('counter and attributes', () => {
    const { c, input } = make();
    expect(c.el.querySelector('.p-answer__count')?.textContent).toBe('0/10');
    c.setValue('abc');
    expect(c.el.querySelector('.p-answer__count')?.textContent).toBe('3/10');
    expect(input.getAttribute('maxlength')).toBe('10');
    expect(input.getAttribute('enterkeyhint')).toBe('send');
    expect(input.getAttribute('autocomplete')).toBe('off');
  });
  it('disabled blocks submit', () => {
    const { c, input, btn, onSubmit } = make();
    c.setValue('x');
    c.setDisabled(true);
    expect(btn.disabled).toBe(true);
    expect(input.disabled).toBe(true);
    btn.click();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
