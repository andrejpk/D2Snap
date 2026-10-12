import { forComments } from "./util.normalizers.js";
const DEFAULT_SETTINGS = Object.freeze({
  keepPattern: null
});
var filter_comments_default = forComments((virtualComment, _liveComment, _context, settings = {}) => {
  const keepPattern = settings.keepPattern ?? DEFAULT_SETTINGS.keepPattern;
  if (keepPattern?.test(virtualComment.data)) return;
  virtualComment.parentNode?.removeChild(virtualComment);
});
export {
  DEFAULT_SETTINGS,
  filter_comments_default as default
};
