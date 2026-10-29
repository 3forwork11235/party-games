import { describe, expect, it } from 'vitest';
import { validateInitData } from '../src/telegramAuth.js';

// Вектор посчитан независимо по алгоритму Telegram (HMAC "WebAppData" → токен → data_check_string).
const TOKEN = '123456:TEST_TOKEN';
const HASH = '9cde476108c410ea8e51d8ea0e3e7f543ef28a0acafb7c291bfd49ab332bcfe5';
const USER = '{"id":42,"first_name":"A","language_code":"ru"}';
const INIT = new URLSearchParams({
  auth_date: '1700000000',
  query_id: 'AAH',
  user: USER,
  hash: HASH,
}).toString();
const NOW = 1700000100;

describe('validateInitData', () => {
  it('принимает корректную подпись', () => {
    const r = validateInitData(INIT, TOKEN, { nowSec: NOW });
    expect(r?.user.id).toBe(42);
    expect(r?.authDate).toBe(1700000000);
  });

  it('отклоняет чужой токен', () => {
    expect(validateInitData(INIT, '123456:OTHER', { nowSec: NOW })).toBeNull();
  });

  it('отклоняет подменённые данные', () => {
    const tampered = INIT.replace('AAH', 'BBH');
    expect(validateInitData(tampered, TOKEN, { nowSec: NOW })).toBeNull();
  });

  it('отклоняет отсутствие hash и мусор', () => {
    expect(validateInitData('auth_date=1&user=%7B%7D', TOKEN, { nowSec: NOW })).toBeNull();
    expect(validateInitData('', TOKEN)).toBeNull();
  });

  it('отклоняет устаревшие данные', () => {
    expect(validateInitData(INIT, TOKEN, { nowSec: NOW + 90000 })).toBeNull();
    expect(validateInitData(INIT, TOKEN, { nowSec: NOW + 90000, maxAgeSec: 0 })?.user.id).toBe(42);
  });
});
