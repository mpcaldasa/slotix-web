import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { CONFIG, validateConfig } from './app/core/config';

async function start(): Promise<void> {
  const response = await fetch('/config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Configuration unavailable');
  const config = validateConfig(await response.json());
  await bootstrapApplication(App, {
    providers: [...appConfig.providers, { provide: CONFIG, useValue: config }],
  });
}
void start().catch(() => {
  document.body.textContent =
    'No se pudo iniciar Slotix. Revisa la configuración del servicio e intenta recargar.';
});
