// Kept separate from theme.ts (a client file) so the server layout can put it in <head>.

const KEY = "ms_theme";

/** Runs before the page paints (inline in <head>), so dark mode never flashes white. */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var t=d?"dark":"light";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;var a=localStorage.getItem("ms_accent");if(a==="blue"||a==="red")document.documentElement.dataset.accent=a;}catch(e){}})();`;
