import { state } from '@core/State.js';
import { createDefaultProject } from '@core/presets/ProjectPresets.js';
import { eventBus } from '@core/EventBus.js';

export function firstLaunch() {
  state.set('isFirstLaunch', false);
  eventBus.emit('save:request:state');
}