export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

    browser.browserAction.onClicked.addListener(() => browser.tabs.create({'url': './popup/index.html'}))
    
});
