import { bootstrapApplication } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AppComponent } from './app.component';

ModuleRegistry.registerModules([AllCommunityModule]);
bootstrapApplication(AppComponent, { providers: [provideNoopAnimations()] }).catch(error => {
  console.error(error);
  const alert = document.createElement('p');
  alert.setAttribute('role', 'alert');
  alert.textContent = 'The operations workbench could not start. Reload to try again.';
  document.body.append(alert);
});
