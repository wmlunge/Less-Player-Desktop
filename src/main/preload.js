// preload.js

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
/*
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
      const element = document.getElementById(selector)
      if (element) element.innerText = text
    }
  
    for (const dependency of ['chrome', 'node', 'electron']) {
      replaceText(`${dependency}-version`, process.versions[dependency])
    }
  })
*/

const { contextBridge, ipcRenderer } = require('electron')
const { isMacOS, isWinOS, useCustomTrafficLight } = require('./env')

contextBridge.exposeInMainWorld('electronAPI', {
  //ipcRenderer,
  ipcRenderer: {
    ...ipcRenderer,
    on: ipcRenderer.on.bind(ipcRenderer),
  },
  isMacOS,
  isWinOS,
  useCustomTrafficLight
})
