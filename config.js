// Keys for the services the site uses. See SETUP.md for where each one comes from.
// These are public identifiers, safe to publish; your data is protected by firestore.rules.
// Leave firebase.apiKey empty to run in demo mode (no accounts, saves in this browser only).
export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyDA2m53nwjS12oGjBJtAmAXfzeKQkAUoNI",
    authDomain: "fe-other-disciplines-prep.firebaseapp.com",
    projectId: "fe-other-disciplines-prep",
    appId: "1:686085571792:web:ea4e2de3e19c5986f88ad5",
  },
  googleClientId: "686085571792-lsdpdi4u4rk52h5uj87ge2hj3eefs4k7.apps.googleusercontent.com",    // Google Cloud → APIs & Services → Credentials → OAuth client ID (Web)
  microsoftClientId: "22c618c9-0897-4c5c-af0d-134b5e9bde4a", // portal.azure.com → App registrations → Application (client) ID
};
