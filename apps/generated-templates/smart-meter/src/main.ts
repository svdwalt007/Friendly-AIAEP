/**
 * @file Smart Meter generated template entry point.
 * @license MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
