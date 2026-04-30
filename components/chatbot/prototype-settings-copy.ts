import type { ChatLocale } from "./chatbot-copy"

export function getPrototypeSettingsCopy(locale: ChatLocale) {
  return locale === "fr"
    ? {
        dialogTitle: "Paramètres du prototype",
        dialogDescription:
          "Choisissez le placement des sources, la version audio et la couleur d’accent pour la démo. Enregistrer applique les changements et réinitialise le prototype ; Annuler ferme sans enregistrer.",
        sourceVersion: "Version des sources",
        audioVersion: "Version audio",
        primaryColor: "Couleur principale",
        cancel: "Annuler",
        save: "Enregistrer",
        settingsAria: "Paramètres du prototype",
        audioOptionV1: "V1 — icône et modal d’action flottant",
        audioOptionV2: "V2 — lecteur plein écran",
        audioOptionV3: "V3 — audio plein écran",
        audioOptionV4: "V4 — audio plein écran",
      }
    : {
        dialogTitle: "Prototype settings",
        dialogDescription:
          "Choose source placement, audio version, and primary accent color for the demo. Save applies changes and resets the prototype run; Cancel closes without saving.",
        sourceVersion: "Source version",
        audioVersion: "Audio version",
        primaryColor: "Primary color",
        cancel: "Cancel",
        save: "Save",
        settingsAria: "Prototype settings",
        audioOptionV1: "V1 — icon and floating action modal",
        audioOptionV2: "V2 — full screen reader",
        audioOptionV3: "V3 — full screen audio",
        audioOptionV4: "V4 — full screen audio",
      }
}
