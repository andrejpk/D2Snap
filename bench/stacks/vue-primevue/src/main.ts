import { createApp } from "vue";
import PrimeVue from "primevue/config";
import App from "./App.vue";
import "./styles.css";

// Community components, in their supported unstyled mode, with Clawpilot CSS.
createApp(App).use(PrimeVue, { unstyled: true, ripple: false }).mount("#app");
