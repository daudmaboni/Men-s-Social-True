// Kept separate from theme.ts (a client file) so the server layout can put it in <head>.

const KEY = "ms_theme";

/** Runs before the page paints (also the font style and text size, Step 66: the Studio has its own) (inline in <head>), so dark mode never flashes white. */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var t=d?"dark":"light";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;var a=localStorage.getItem("ms_accent");if(a==="blue"||a==="red")document.documentElement.dataset.accent=a;if(localStorage.getItem("ms_lang")==="sw")document.documentElement.lang="sw";var st=location.pathname.indexOf("/studio")===0;var f=localStorage.getItem(st?"ms_admin_font":"ms_font");if(f&&/^[a-z0-9-]{2,30}$/.test(f))document.documentElement.dataset.font=f;var z=localStorage.getItem(st?"ms_admin_size":"ms_size");if(/^(sm|lg|xl|xxl|x3|x4)$/.test(z||""))document.documentElement.dataset.size=z;}catch(e){}})();`;
