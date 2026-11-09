/* =========================================================
   FORMULARIOS — envío de reservas, solicitudes de evento
   e inscripciones (reservas.html y eventos.html)
   =========================================================
   Maneja todos los formularios que tengan el atributo
   data-reservation-form. El tipo de cada uno se lee de
   data-reservation-type ("mesa", "evento" o "inscripcion").

   Cada envío se guarda como un documento nuevo en la colección
   "solicitudes" de Firestore, usando la API REST con fetch
   (sin librerías). Las reglas de seguridad de Firestore solo
   permiten CREAR documentos válidos desde la web; nadie puede
   leerlos ni borrarlos desde aquí.
   ========================================================= */

(function () {
  "use strict";

  var PROYECTO = "muscari-bistro";
  var API_KEY = "AIzaSyCvnbzagEcTEkS_Ey_XuxvkvKnEAKagPGk";
  var URL_COMMIT = "https://firestore.googleapis.com/v1/projects/" + PROYECTO + "/databases/(default)/documents:commit?key=" + API_KEY;
  var RUTA_DOCS = "projects/" + PROYECTO + "/databases/(default)/documents/solicitudes/";

  // Campos que se guardan como número.
  var CAMPOS_NUMERICOS = ["personas", "invitados"];

  var MESSAGES = {
    sending: "Enviando tu solicitud…",
    success: "¡Listo! Recibimos tu solicitud. Te contactaremos pronto para confirmar.",
    error: "No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.",
    invalid: "Revisa los campos marcados antes de continuar.",
  };

  function formToPayload(form, type) {
    var data = new FormData(form);
    var payload = { tipo: type };

    data.forEach(function (value, key) {
      payload[key] = typeof value === "string" ? value.trim() : value;
    });

    return payload;
  }

  function setStatus(statusEl, state, text) {
    if (!statusEl) return;

    statusEl.textContent = text;
    statusEl.setAttribute("data-state", state);
  }

  function setLoading(form, submitButton, isLoading) {
    submitButton.disabled = isLoading;
    form.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  function idNuevo() {
    var letras = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var bytes = new Uint8Array(20);
    var id = "";

    window.crypto.getRandomValues(bytes);
    bytes.forEach(function (b) { id += letras.charAt(b % letras.length); });

    return id;
  }

  function aValorFirestore(campo, valor) {
    if (CAMPOS_NUMERICOS.indexOf(campo) !== -1 && valor !== "" && !isNaN(Number(valor))) {
      return { integerValue: String(parseInt(valor, 10)) };
    }

    return { stringValue: String(valor) };
  }

  function sendToApi(type, payload) {
    var fields = {};

    Object.keys(payload).forEach(function (campo) {
      fields[campo] = aValorFirestore(campo, payload[campo]);
    });

    // Estado inicial fijo; la fecha de recepción la pone el servidor.
    fields.estado = { stringValue: "pendiente" };

    var cuerpo = {
      writes: [{
        update: { name: RUTA_DOCS + idNuevo(), fields: fields },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: "recibidoEn", setToServerValue: "REQUEST_TIME" }],
      }],
    };

    return fetch(URL_COMMIT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Firestore respondió con estado " + response.status);
      }

      return response;
    });
  }

  function handleSubmit(event) {
    var form = event.target;
    var type = form.getAttribute("data-reservation-type");
    var statusEl = form.querySelector("[data-form-status]");
    var submitButton = form.querySelector(".form-submit");

    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus(statusEl, "error", MESSAGES.invalid);
      return;
    }

    var payload = formToPayload(form, type);

    setLoading(form, submitButton, true);
    setStatus(statusEl, "sending", MESSAGES.sending);

    sendToApi(type, payload)
      .then(function () {
        setStatus(statusEl, "success", MESSAGES.success);
        form.reset();
      })
      .catch(function (error) {
        console.error("[formularios] Error al enviar:", error);
        setStatus(statusEl, "error", MESSAGES.error);
      })
      .finally(function () {
        setLoading(form, submitButton, false);
      });
  }

  function init() {
    document.querySelectorAll("[data-reservation-form]").forEach(function (form) {
      form.addEventListener("submit", handleSubmit);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
