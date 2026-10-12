import * as D2SnapAPI from "./api.js";
declare global {
    interface Window {
        D2Snap: typeof D2SnapAPI;
    }
}
