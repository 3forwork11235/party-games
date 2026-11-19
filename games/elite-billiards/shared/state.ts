import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { CoreState } from '@party/core/server';

export class BallState extends Schema {
  /** 0 — биток, 1..N — прицельные. */
  @type('uint8') id = 0;
  /** BallKind: cue | small | std | big | giant | gold. */
  @type('string') kind = 'std';
  @type('float64') x = 0;
  @type('float64') y = 0;
  @type('float64') r = 0;
  @type('uint8') value = 0;
  @type('boolean') potted = false;
  /** playerId, кто забил ('' — никто/биток). */
  @type('string') pottedBy = '';
}

export class EliteBilliardsState extends CoreState {
  @type([BallState]) balls = new ArraySchema<BallState>();
  /** Порядок ходов (playerId), задаётся в onGameStart. */
  @type(['string']) order = new ArraySchema<string>();
  @type('string') shooterId = '';
  /** 'aim' | 'rolling' | '' (вне round). */
  @type('string') stage = '';
  @type('number') shotNo = 0;
  /** Биток «с руки»: стрелок ставит его в «доме» перед ударом. */
  @type('boolean') cueInHand = false;
  /** Очки за текущую раскладку: playerId → очки (могут быть < 0 из-за штрафов). */
  @type({ map: 'number' }) rackScore = new MapSchema<number>();
  /** Итог последнего удара для HUD. */
  @type('string') lastShooterId = '';
  @type('number') lastPoints = 0;
  /** '' | 'scratch' | 'noHit' | 'timeout'. */
  @type('string') lastFoul = '';
  /** Epoch ms, когда раскладка закончится принудительно. */
  @type('number') rackEndsAt = 0;
}
