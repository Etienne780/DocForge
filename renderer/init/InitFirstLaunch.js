import { state } from '@core/State.js';
import { createDefaultProject } from '@core/presets/ProjectPresets.js';
import { eventBus } from '@core/EventBus.js';

export function firstLaunch() {
  state.set('isFirstLaunch', false);
  eventBus.emit('save:request:state');

  // add default project
  const p = createDefaultProject();
  const projects = state.get('projects');
  projects.push(p);
  eventBus.emit('save:request:projects');
}