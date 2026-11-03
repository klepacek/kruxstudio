const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const control = d => d.vendorId === 0x3299 && [0x2731, 0x2736].includes(d.productId);
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1240, height: 750, minWidth: 900, minHeight: 600, backgroundColor: '#0e1013', autoHideMenuBar: true });
  const local = require('node:url').pathToFileURL(path.join(__dirname, 'index.html')).href;
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler((wc, perm) => wc === win.webContents && perm === 'hid');
  ses.on('select-hid-device', (event, details, pick) => {
    event.preventDefault();
    if (details.frame.url !== local) return pick('');
    const devices = details.deviceList.filter(d => control(d) || (d.vendorId === 0x1919 && d.productId === 0x1919));
    devices.sort((a,b) => Number(b.productId === 0x2731) - Number(a.productId === 0x2731));
    pick(devices[0]?.deviceId || '');
  });
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadFile('index.html');
});
app.on('window-all-closed', () => app.quit());



