// Development entry point: keeping the worker at the site root gives it app-wide scope.
// The production build replaces this wrapper with the generated implementation.
importScripts('./js/service-worker.js');
