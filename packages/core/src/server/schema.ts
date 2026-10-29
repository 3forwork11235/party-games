import { MapSchema, Schema, type } from '@colyseus/schema';
import type { CorePhase, IPlayer } from '../shared/contracts.js';

export class Player extends Schema implements IPlayer {
  @type('string') id = '';
  @type('string') sessionId = '';
  @type('string') nick = '';
  @type('string') avatar = '';
  @type('string') frame = 'none';
  @type('string') nickColor = 'default';
  @type('number') score = 0;
  @type('number') roundScore = 0;
  @type('boolean') connected = true;
  @type('boolean') ready = false;
}

/** Базовое состояние комнаты. Игры наследуют и добавляют свои поля. */
export class CoreState extends Schema {
  @type('string') code = '';
  @type('string') phase: CorePhase = 'lobby';
  @type('number') phaseEndsAt = 0;
  @type('number') round = 0;
  @type('number') totalRounds = 0;
  @type('string') hostId = '';
  @type({ map: Player }) players = new MapSchema<Player>();
}
