// Keys for the services the site uses. See SETUP.md for where each one comes from.
// These are public identifiers, safe to publish; your data is protected by firestore.rules.
// Leave firebase.apiKey empty to run in demo mode (no accounts, saves in this browser only).
export const CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    appId: "",
  },
  googleClientId: "",    // Google Cloud → APIs & Services → Credentials → OAuth client ID (Web)
  microsoftClientId: "", // portal.azure.com → App registrations → Application (client) ID
};
