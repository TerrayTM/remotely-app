const { remote } = require('electron');
const { connect, createSession, endSession, closeAPI, uploadFile } = require('./scripts/core');
const NoSleep = require('nosleep.js');

let noSleep = null;
let statusLabel = null;
let sessionStartButton = null;
let sessionEndButton = null;
let codeLabel = null;
let byLabel = null;
let authenticateLabel = null;
let passwordLabel = null;
let keepAwakeCheckBox = null;
let codeRevealLabel = null;
let fileDropLabel = null;
let copying = false;

const resetNoSleep = () => {
    if (noSleep) {
        noSleep.disable();

        noSleep = null;
    }
};

const setStatus = (text) => statusLabel.innerHTML = `Status: ${text}`;

const minimize = () => remote.getCurrentWindow().minimize();

const close = () => {
    if (statusLabel.innerHTML === 'Status: Connected' || statusLabel.innerHTML === 'Status: User Online') {
        if (confirm('Closing the application will close its connection. Are you sure?', 'Remotely')) {
            remote.getCurrentWindow().close();
        }
    } else {
        remote.getCurrentWindow().close();
    }
};

const connectionError = () => {
    setStatus('Server Error');
    resetNoSleep();

    codeLabel.innerHTML = 'XXXX-XXXX';
    sessionStartButton.disabled = false;
    keepAwakeCheckBox.disabled = false;
    codeRevealLabel.style.display = 'block';
    fileDropLabel.style.display = 'none';
};

const disconnect = () => {
    setStatus('Disconnected');
    resetNoSleep();

    codeLabel.innerHTML = 'XXXX-XXXX';
    sessionStartButton.disabled = false;
    sessionEndButton.disabled = true;
    passwordLabel.innerHTML = 'XXXXXX';
    authenticateLabel.classList.remove('active');
    keepAwakeCheckBox.disabled = false;
    codeRevealLabel.style.display = '';
    fileDropLabel.style.display = 'none';
};

const sessionCreated = (code, password) => {
    setStatus('Connected');

    codeLabel.innerHTML = `${code.substring(0, 4)}-${code.substring(4)}`;
    passwordLabel.innerHTML = password;
    authenticateLabel.classList.add('active');
    sessionEndButton.disabled = false;
};

const connected = () => createSession(connectionError, sessionCreated);

const userJoined = () => {
    setStatus("User Online");

    codeRevealLabel.style.display = 'none';
    fileDropLabel.style.display = 'block';
};

const userLeft = () => {
    setStatus("Connected");

    codeRevealLabel.style.display = '';
    fileDropLabel.style.display = 'none';
};

const passwordError = () => {
    disconnect();

    setStatus('Security Error');
};

const sessionStart = async () => {
    setStatus('Connecting...');

    sessionStartButton.disabled = true;
    keepAwakeCheckBox.disabled = true;

    if (!await connect(connectionError, disconnect, connected, userJoined, userLeft, passwordError)) {
        connectionError();
    }

    if (keepAwakeCheckBox.checked) {
        if (!noSleep) {
            noSleep = new NoSleep();
        }

        noSleep.enable();
    }
};

const sessionEnd = () => {
    endSession();
    resetNoSleep();

    sessionStartButton.disabled = false;
    sessionEndButton.disabled = true;
    passwordLabel.innerHTML = 'XXXXXX';
    authenticateLabel.classList.remove('active');
};

const fileOver = (event) => {
    event.stopPropagation();
    event.preventDefault();
};

const fileDropped = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.items) {
        for (let i = 0, length = event.dataTransfer.items.length; i < length; ++i) {
            if (event.dataTransfer.items[i].kind === 'file') {
                let file = event.dataTransfer.items[i].getAsFile();

                if (file.size > 1e+7) {
                    continue;
                }

                uploadFile(file);
            }
        }
    } else {
        for (let i = 0, length = event.dataTransfer.files.length; i < length; ++i) {
            let file = event.dataTransfer.files[i];

            if (file.size > 1e+7) {
                continue;
            }

            uploadFile(file);
        }
    }

    if (event.dataTransfer.items) {
        event.dataTransfer.items.clear();
    } else {
        event.dataTransfer.clearData();
    }
};

const code = () => {
    if (codeLabel.innerHTML !== 'XXXX-XXXX' && !copying) {
        copying = true;

        const textArea = document.createElement("textarea");

        textArea.style.position = 'fixed';
        textArea.style.top = 0;
        textArea.style.left = 0;
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = 0;
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        textArea.value = codeLabel.innerHTML.replace('-', '');

        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();

        document.execCommand('copy');

        document.body.removeChild(textArea);

        const previous = byLabel.innerHTML;

        byLabel.innerHTML = 'Copied to Clipboard!';

        setTimeout(() => {
            byLabel.innerHTML = previous;
            copying = false;
        }, 3000);
    }
};

document.getElementById('minimize').addEventListener('click', minimize);
document.getElementById('close').addEventListener('click', close);

sessionStartButton = document.getElementById('sessionStart')
sessionStartButton.addEventListener('click', sessionStart);

sessionEndButton = document.getElementById('sessionEnd')
sessionEndButton.addEventListener('click', sessionEnd);

codeLabel = document.getElementById('code');
codeLabel.addEventListener('click', code);

fileDropLabel = document.getElementById('fileDrop');
fileDropLabel.addEventListener('dragover', fileOver);
fileDropLabel.addEventListener('drop', fileDropped);

statusLabel = document.getElementById('status');
byLabel = document.getElementById('by');
authenticateLabel = document.getElementById('authenticate');
passwordLabel = document.getElementById('password');
keepAwakeCheckBox = document.getElementById('keepAwake');
codeRevealLabel = document.getElementById('codeReveal');

document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

window.onbeforeunload = () => {
    closeAPI();
};