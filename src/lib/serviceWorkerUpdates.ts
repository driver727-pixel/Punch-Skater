export const SERVICE_WORKER_SKIP_WAITING = "punch-skater:skip-waiting";
export const SERVICE_WORKER_UPDATE_READY_EVENT = "punch-skater:service-worker-update-ready";

export function notifyServiceWorkerUpdateReady(registration: ServiceWorkerRegistration) {
  window.dispatchEvent(
    new CustomEvent<ServiceWorkerRegistration>(SERVICE_WORKER_UPDATE_READY_EVENT, {
      detail: registration,
    }),
  );
}
