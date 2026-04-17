import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';

export function resolveStateType(type) {
  if(!type)
    return;
  
  const t = type.toLowerCase();
  switch(t) {
    case 'state':
      return state;
    case 'session':
      return session;
    default:
      return null;
  }
}