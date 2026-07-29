(function(root){
  const RETRY_DELAYS = [3000, 10000, 30000];
  const ENTITY_LABELS = {
    owners: 'tutor',
    pets: 'paciente',
    appointments: 'turno',
    groomingAppointments: 'turno de peluquería',
    reminders: 'aviso',
    inventory: 'producto',
    invoices: 'recibo',
    settings: 'configuración'
  };

  function retryDelay(attempt){
    const index = Math.max(0, Math.min(Number(attempt)||0, RETRY_DELAYS.length-1));
    return RETRY_DELAYS[index];
  }

  function isRetryableStatus(status){
    const code = Number(status) || 0;
    return code === 0 || code === 408 || code === 425 || code === 429 || code >= 500;
  }

  function contextLabel(context){
    if(!context)return 'guardar los cambios';
    const entity = ENTITY_LABELS[context.table] || 'registro';
    return context.operation === 'delete' ? `eliminar el ${entity}` : `guardar el ${entity}`;
  }

  function view(status, options){
    options = options || {};
    const context = contextLabel(options.context);
    const retrySeconds = Math.ceil((options.retryDelayMs||0)/1000);
    const states = {
      local: {
        label: 'Guardado local',
        detail: 'Este equipo conserva los cambios; no hay servidor configurado.',
        retryable: false
      },
      queued: {
        label: 'Cambios pendientes',
        detail: 'Los cambios están en este equipo y esperan confirmación de la nube.',
        retryable: false
      },
      saving: {
        label: 'Guardando…',
        detail: `VetCare está intentando ${context} en la nube.`,
        retryable: false
      },
      saved: {
        label: 'Guardado',
        detail: 'Todos los cambios están confirmados en la nube.',
        retryable: false
      },
      offline: {
        label: 'Sin conexión',
        detail: 'Los cambios siguen en este equipo y se reintentarán al recuperar Internet.',
        retryable: true
      },
      error: {
        label: 'Error al guardar',
        detail: retrySeconds
          ? `No se pudo ${context}. Reintento automático en ${retrySeconds} s.`
          : `No se pudo ${context}.`,
        retryable: true
      },
      conflict: {
        label: 'Conflicto',
        detail: `Otro equipo modificó este ${ENTITY_LABELS[options.context?.table]||'registro'}. Revisalo antes de continuar.`,
        retryable: false
      }
    };
    return states[status] || states.queued;
  }

  root.VetCareSync = Object.freeze({ retryDelay, isRetryableStatus, contextLabel, view });
})(typeof globalThis !== 'undefined' ? globalThis : window);
