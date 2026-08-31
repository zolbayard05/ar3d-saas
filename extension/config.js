// The ONE place this extension's API target lives. Pointed at the deployed
// production domain (not localhost) so a phone can actually reach the
// share link a generation returns — a localhost URL only ever resolves on
// this same machine, which is why QR/link scanning from a phone silently
// failed while this pointed at localhost. `host_permissions` in
// manifest.json already covers http(s)://*/* generally, so no change
// needed there when switching this value.
const REALIFY_API_BASE = "https://realify3d.vercel.app";
