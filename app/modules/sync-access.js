/* Do not upload unbound browser state when Telegram omits a local account ID.
 * The ID is a namespace hint only, never proof of server-side authorization.
 */
globalThis.KafuEnhancements.installers.push({name:"personal-account-guard",install(){
  if (!IN_TG || !Number.isSafeInteger(TG.initDataUnsafe?.user?.id)) CloudSync.ok = () => false;
}});
